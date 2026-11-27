const select = (selector) => document.querySelector(selector);
const tabs = document.querySelectorAll('[data-platform]');
let items = [];
let active = 'All';

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function link(text, url) {
  const anchor = element('a', text);
  anchor.href = url;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  return anchor;
}

function renderBrief() {
  const visible = items.filter(item => active === 'All' || item.platform === active);
  select('#cards').replaceChildren(...visible.map(item => {
    const card = element('article', undefined, 'card');
    const tile = element('div', item.am, 'tile ' + item.color);
    tile.lang = 'am';
    const body = element('div', undefined, 'card-body');
    body.append(
      element('p', item.platform + ' · ' + item.format, 'kicker'),
      element('h3', item.title),
      element('p', item.idea),
      link('View example · ' + item.creator, item.url)
    );
    card.append(tile, body);
    return card;
  }));
  select('#brief-status').textContent = visible.length ? '' : 'No examples for this platform in this edition.';
}

async function getJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error('Request failed');
  return response.json();
}

async function loadBrief() {
  const edition = await getJson('/api/editorial');
  items = edition.items;
  select('#edition').textContent = new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'long', timeZone: 'UTC'
  }).format(new Date(edition.edition));
  for (const tab of tabs) tab.addEventListener('click', () => {
    active = tab.dataset.platform;
    for (const button of tabs) button.setAttribute('aria-pressed', String(button === tab));
    renderBrief();
  });
  renderBrief();
}

async function loadChart() {
  const chart = await getJson('/api/chart');
  const name = new Intl.DisplayNames(['en'], { type: 'region' }).of(chart.region);
  const status = select('#chart-status');
  if (chart.status === 'unconfigured') {
    status.textContent = 'The live chart for ' + name + ' has not been configured.';
    return;
  }
  if (chart.status === 'unavailable' || !chart.items.length) {
    status.textContent = 'YouTube chart results for ' + name + ' are currently unavailable.';
    return;
  }
  const date = new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Addis_Ababa'
  }).format(new Date(chart.updatedAt));
  status.textContent = name + ' · ' + (chart.status === 'stale' ? 'Last available snapshot' : 'Updated') +
    ' ' + date + ' EAT';

  const number = new Intl.NumberFormat('en');
  select('#rankings').replaceChildren(...chart.items.map(item => {
    const row = element('li');
    const thumbnail = document.createElement('img');
    thumbnail.src = 'https://i.ytimg.com/vi/' + item.id + '/mqdefault.jpg';
    thumbnail.alt = '';
    thumbnail.loading = 'lazy';
    const metadata = element('div');
    const views = typeof item.views === 'string' && /^\d+$/.test(item.views)
      ? ' · ' + number.format(BigInt(item.views)) + ' views' : '';
    metadata.append(link(item.title, 'https://www.youtube.com/watch?v=' + item.id),
      element('small', (item.channel ?? 'YouTube') + views));
    row.append(element('strong', String(item.rank)), thumbnail, metadata);
    return row;
  }));
}

loadBrief().catch(() => { select('#brief-status').textContent = 'Could not load the creator brief. Refresh to retry.'; });
loadChart().catch(() => { select('#chart-status').textContent = 'Could not reach the chart. Refresh to retry.'; });
