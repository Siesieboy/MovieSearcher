const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 3000);
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

function loadEnvFile() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;

  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (key && !process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile();

const TMDB_API_KEY = process.env.TMDB_API_KEY;
if (!TMDB_API_KEY) {
  console.warn('TMDB_API_KEY ontbreekt in .env');
}

function json(res, statusCode, data) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function serveStatic(req, res) {
  const publicDir = path.join(__dirname, 'public');
  const urlPath = req.url === '/' ? '/index.html' : req.url;
  const safePath = path.normalize(urlPath).replace(/^\.\.(\/|\\|$)/, '');
  const filePath = path.join(publicDir, safePath);

  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
  };

  res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
}

function addProvidersToMap(providerMap, bucket) {
  for (const provider of bucket) {
    providerMap.set(provider.provider_id, {
      id: provider.provider_id,
      name: provider.provider_name,
      logo: provider.logo_path ? `https://image.tmdb.org/t/p/w92${provider.logo_path}` : null,
    });
  }
}

async function handleSearch(req, res) {
  if (!TMDB_API_KEY) {
    return json(res, 500, { error: 'Server mist TMDB_API_KEY configuratie.' });
  }

  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  const query = (requestUrl.searchParams.get('query') || '').trim();

  if (!query) {
    return json(res, 400, { error: 'Query parameter is verplicht.' });
  }

  try {
    const searchUrl = new URL(`${TMDB_BASE_URL}/search/multi`);
    searchUrl.searchParams.set('api_key', TMDB_API_KEY);
    searchUrl.searchParams.set('query', query);
    searchUrl.searchParams.set('include_adult', 'false');
    searchUrl.searchParams.set('language', 'en-US');

    const searchResponse = await fetch(searchUrl);
    if (!searchResponse.ok) {
      return json(res, searchResponse.status, { error: 'Kon TMDB zoekresultaten niet ophalen.' });
    }

    const searchData = await searchResponse.json();
    const baseResults = (searchData.results || [])
      .filter((item) => item.media_type === 'movie' || item.media_type === 'tv')
      .slice(0, 18);

    const countryName = new Intl.DisplayNames(['nl'], { type: 'region' });

    const enrichedResults = await Promise.all(
      baseResults.map(async (item) => {
        const type = item.media_type;
        const watchUrl = `${TMDB_BASE_URL}/${type}/${item.id}/watch/providers?api_key=${TMDB_API_KEY}`;

        let providers = [];
        let streamingCountries = [];
        let subscriptionProviders = [];
        let rentProviders = [];
        let buyProviders = [];

        try {
          const watchResponse = await fetch(watchUrl);
          if (watchResponse.ok) {
            const watchData = await watchResponse.json();
            const regions = watchData.results || {};
            const subscriptionMap = new Map();
            const rentMap = new Map();
            const buyMap = new Map();

            streamingCountries = Object.entries(regions)
              .filter(
                ([, data]) =>
                  (data.flatrate || []).length > 0 ||
                  (data.free || []).length > 0 ||
                  (data.ads || []).length > 0 ||
                  (data.rent || []).length > 0 ||
                  (data.buy || []).length > 0
              )
              .map(([code]) => countryName.of(code) || code)
              .sort((a, b) => a.localeCompare(b));

            for (const regionData of Object.values(regions)) {
              addProvidersToMap(subscriptionMap, regionData.flatrate || []);
              addProvidersToMap(subscriptionMap, regionData.free || []);
              addProvidersToMap(subscriptionMap, regionData.ads || []);
              addProvidersToMap(rentMap, regionData.rent || []);
              addProvidersToMap(buyMap, regionData.buy || []);
            }

            subscriptionProviders = [...subscriptionMap.values()].sort((a, b) => a.name.localeCompare(b.name));
            rentProviders = [...rentMap.values()].sort((a, b) => a.name.localeCompare(b.name));
            buyProviders = [...buyMap.values()].sort((a, b) => a.name.localeCompare(b.name));

            providers = [...subscriptionProviders]
              .sort((a, b) => a.name.localeCompare(b.name))
              .slice(0, 12);
          }
        } catch {
          providers = [];
          streamingCountries = [];
          subscriptionProviders = [];
          rentProviders = [];
          buyProviders = [];
        }

        return {
          id: item.id,
          mediaType: type,
          title: item.title || item.name,
          year: (item.release_date || item.first_air_date || '').slice(0, 4) || 'Onbekend',
          description: item.overview || 'Geen beschrijving beschikbaar.',
          poster: item.poster_path ? `https://image.tmdb.org/t/p/w342${item.poster_path}` : null,
          streamingCountries,
          providers,
          details: {
            subscriptionProviders,
            rentProviders,
            buyProviders,
          },
        };
      })
    );

    return json(res, 200, { results: enrichedResults });
  } catch {
    return json(res, 500, { error: 'Er ging iets mis bij het ophalen van resultaten.' });
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url.startsWith('/api/health') && req.method === 'GET') {
    json(res, 200, { ok: true });
    return;
  }

  if (req.url.startsWith('/api/search') && req.method === 'GET') {
    await handleSearch(req, res);
    return;
  }

  if (req.method === 'GET') {
    serveStatic(req, res);
    return;
  }

  res.writeHead(405);
  res.end('Method Not Allowed');
});

server.listen(PORT, () => {
  console.log(`Server draait op http://localhost:${PORT}`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Poort ${PORT} is al in gebruik. Stop dat proces of kies een andere PORT in .env.`);
    return;
  }
  console.error('Server kon niet starten:', error.message);
});
