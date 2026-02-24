const searchForm = document.getElementById('searchForm');
const searchInput = document.getElementById('searchInput');
const statusEl = document.getElementById('status');
const resultsEl = document.getElementById('results');
const cardTemplate = document.getElementById('cardTemplate');
const detailsModal = document.getElementById('detailsModal');
const closeDetailsModalButton = document.getElementById('closeDetailsModal');
const detailsPoster = document.getElementById('detailsPoster');
const detailsTitle = document.getElementById('detailsTitle');
const detailsMeta = document.getElementById('detailsMeta');
const detailsDescription = document.getElementById('detailsDescription');
const countrySuggestions = document.getElementById('countrySuggestions');
const detailsSubscriptionSection = document.getElementById('detailsSubscriptionSection');
const detailsSubscriptionProviders = document.getElementById('detailsSubscriptionProviders');
const detailsRentSection = document.getElementById('detailsRentSection');
const detailsRentProviders = document.getElementById('detailsRentProviders');
const detailsBuySection = document.getElementById('detailsBuySection');
const detailsBuyProviders = document.getElementById('detailsBuyProviders');
const countryCheckForm = document.getElementById('countryCheckForm');
const countryCheckInput = document.getElementById('countryCheckInput');
const countryCheckResult = document.getElementById('countryCheckResult');
const configuredApiBase = String(window.APP_API_BASE || '').replace(/\/+$/, '');
const API_BASES = [...new Set([
  configuredApiBase,
  '',
  `${window.location.protocol}//127.0.0.1:3000`,
  `${window.location.protocol}//localhost:3000`,
].filter(Boolean))];

const fallbackPoster =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="342" height="513"><rect width="100%" height="100%" fill="%23dedede"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23666" font-family="Arial" font-size="22">No Poster</text></svg>';
let activeDetailsItem = null;

function setStatus(text) {
  statusEl.textContent = text;
}

function createProviderChip(provider) {
  const chip = document.createElement('span');
  chip.className = 'provider-chip';

  if (provider.logo) {
    const logo = document.createElement('img');
    logo.src = provider.logo;
    logo.alt = `${provider.name} logo`;
    chip.appendChild(logo);
  }

  const label = document.createElement('span');
  label.textContent = provider.name;
  chip.appendChild(label);

  return chip;
}

function renderSimpleChipList(container, items, emptyText) {
  container.innerHTML = '';
  if (!items.length) {
    const empty = document.createElement('span');
    empty.className = 'provider-chip';
    empty.textContent = emptyText;
    container.appendChild(empty);
    return;
  }

  for (const item of items) {
    container.appendChild(createProviderChip(item));
  }
}

function formatCountries(countriesList) {
  if (!countriesList.length) return 'Geen streaminglanden gevonden.';
  const limit = 6;
  const visible = countriesList.slice(0, limit);
  const hiddenCount = countriesList.length - visible.length;
  const suffix = hiddenCount > 0 ? ` +${hiddenCount} meer` : '';
  return `Beschikbaar in: ${visible.join(', ')}${suffix}`;
}

function normalizeText(value) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function checkCountryAvailability() {
  const searchValue = countryCheckInput.value.trim();
  if (!activeDetailsItem || !searchValue) {
    countryCheckResult.textContent = 'Vul een land in om te controleren.';
    return;
  }

  const normalizedSearch = normalizeText(searchValue);
  const match = (activeDetailsItem.streamingCountries || []).find(
    (country) => normalizeText(country) === normalizedSearch
  );

  if (match) {
    countryCheckResult.textContent = `Ja, beschikbaar in ${match}.`;
    countryCheckResult.dataset.state = 'yes';
  } else {
    countryCheckResult.textContent = `Nee, niet gevonden voor "${searchValue}".`;
    countryCheckResult.dataset.state = 'no';
  }
}

function openDetailsModal(item) {
  activeDetailsItem = item;
  detailsPoster.src = item.poster || fallbackPoster;
  detailsPoster.alt = `Poster van ${item.title}`;
  detailsTitle.textContent = item.title;
  detailsMeta.textContent = `${item.mediaType === 'movie' ? 'Film' : 'Serie'} • ${item.year}`;
  detailsDescription.textContent = item.description;

  const details = item.details || {};
  const subscriptionList =
    details.subscriptionProviders && details.subscriptionProviders.length
      ? details.subscriptionProviders
      : item.providers || [];

  renderSimpleChipList(
    detailsSubscriptionProviders,
    subscriptionList,
    'Geen streamingdiensten gevonden'
  );

  detailsSubscriptionSection.hidden = false;

  detailsRentProviders.innerHTML = '';
  const rentItems = details.rentProviders || [];
  if (rentItems.length) {
    detailsRentSection.hidden = false;
    for (const provider of rentItems) {
      const li = document.createElement('li');
      li.textContent = `${provider.name} - prijs: verschilt per titel/regio`;
      detailsRentProviders.appendChild(li);
    }
  } else {
    detailsRentSection.hidden = true;
  }

  const buyItems = details.buyProviders || [];
  if (buyItems.length) {
    detailsBuySection.hidden = false;
    renderSimpleChipList(detailsBuyProviders, buyItems, '');
  } else {
    detailsBuySection.hidden = true;
    detailsBuyProviders.innerHTML = '';
  }

  countrySuggestions.innerHTML = '';
  for (const country of item.streamingCountries || []) {
    const option = document.createElement('option');
    option.value = country;
    countrySuggestions.appendChild(option);
  }

  countryCheckInput.value = '';
  countryCheckResult.textContent = '';
  countryCheckResult.dataset.state = '';

  if (typeof detailsModal.showModal === 'function') {
    detailsModal.showModal();
  } else {
    detailsModal.setAttribute('open', 'open');
  }
}

function closeDetailsModal() {
  if (typeof detailsModal.close === 'function') {
    detailsModal.close();
  } else {
    detailsModal.removeAttribute('open');
  }
}

function renderCards(items) {
  resultsEl.innerHTML = '';

  for (const item of items) {
    const node = cardTemplate.content.cloneNode(true);

    const poster = node.querySelector('.poster');
    const title = node.querySelector('.title');
    const meta = node.querySelector('.meta');
    const description = node.querySelector('.description');
    const countries = node.querySelector('.countries');
    const providersWrap = node.querySelector('.providers');
    const detailsButton = node.querySelector('.details-btn');

    poster.src = item.poster || fallbackPoster;
    poster.alt = `Poster van ${item.title}`;
    title.textContent = item.title;
    meta.textContent = `${item.mediaType === 'movie' ? 'Film' : 'Serie'} • ${item.year}`;
    description.textContent = item.description;
    countries.textContent = formatCountries(item.streamingCountries);

    if (!item.providers.length) {
      const noProviders = document.createElement('span');
      noProviders.className = 'provider-chip';
      noProviders.textContent = 'Geen streaming-info';
      providersWrap.appendChild(noProviders);
    } else {
      const visibleProviders = item.providers.slice(0, 6);
      for (const provider of visibleProviders) {
        providersWrap.appendChild(createProviderChip(provider));
      }
      if (item.providers.length > visibleProviders.length) {
        const more = document.createElement('button');
        more.type = 'button';
        more.className = 'provider-chip more-chip';
        more.textContent = `+${item.providers.length - visibleProviders.length} meer`;
        more.addEventListener('click', () => openDetailsModal(item));
        providersWrap.appendChild(more);
      }
    }

    if (item.streamingCountries.length > 6) {
      const countryMore = document.createElement('button');
      countryMore.type = 'button';
      countryMore.className = 'provider-chip more-chip';
      countryMore.textContent = `+${item.streamingCountries.length - 6} landen`;
      countryMore.addEventListener('click', () => openDetailsModal(item));
      providersWrap.appendChild(countryMore);
    }

    detailsButton.addEventListener('click', () => openDetailsModal(item));
    resultsEl.appendChild(node);
  }
}

async function fetchFromBackend(query) {
  let lastError = 'onbekend';

  for (const base of API_BASES) {
    try {
      const url = `${base}/api/search?query=${encodeURIComponent(query)}`;
      const response = await fetch(url);
      const contentType = response.headers.get('content-type') || '';

      if (!contentType.includes('application/json')) {
        lastError = `Geen JSON op ${base || 'huidige host'}`;
        continue;
      }

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Onbekende fout');
      }
      return data;
    } catch (error) {
      lastError = error.message;
    }
  }

  throw new Error(
    `Backend niet bereikbaar. Zet window.APP_API_BASE in public/config.js naar je live backend URL. Laatste fout: ${lastError}`
  );
}

searchForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const query = searchInput.value.trim();

  if (!query) {
    setStatus('Vul een zoekterm in.');
    resultsEl.innerHTML = '';
    return;
  }

  setStatus('Zoeken...');
  resultsEl.innerHTML = '';

  try {
    const data = await fetchFromBackend(query);

    if (!data.results?.length) {
      setStatus('Geen resultaten gevonden.');
      return;
    }

    setStatus(`${data.results.length} resultaat/resultaten gevonden.`);
    renderCards(data.results);
  } catch (error) {
    setStatus(`Fout: ${error.message}`);
  }
});

closeDetailsModalButton.addEventListener('click', closeDetailsModal);
detailsModal.addEventListener('click', (event) => {
  if (event.target === detailsModal) {
    closeDetailsModal();
  }
});

countryCheckForm.addEventListener('submit', (event) => {
  event.preventDefault();
  checkCountryAvailability();
});
