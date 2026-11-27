import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const assets = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/styles.css': ['styles.css', 'text/css; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8']
};
const headers = {
  'Content-Security-Policy': "default-src 'self'; img-src 'self' https://i.ytimg.com; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin'
};

async function loadEditorial(path) {
  const edition = JSON.parse(await readFile(resolve(root, path), 'utf8'));
  const ids = new Set();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(edition.edition) ||
      !Number.isFinite(Date.parse(edition.edition)) || !Array.isArray(edition.items)) {
    throw new Error('Editorial file needs an ISO edition date and an items array.');
  }
  for (const item of edition.items) {
    const fields = ['id', 'platform', 'format', 'title', 'am', 'creator', 'url', 'idea', 'color'];
    if (fields.some(field => typeof item?.[field] !== 'string' || !item[field].trim()) ||
        ids.has(item.id) || !['sun', 'mint', 'plum'].includes(item.color)) {
      throw new Error('Invalid editorial entry or duplicate ID.');
    }
    const hosts = { YouTube: ['www.youtube.com', 'youtu.be'], TikTok: ['www.tiktok.com'] };
    const url = new URL(item.url);
    if (url.protocol !== 'https:' || url.username || url.password ||
        !hosts[item.platform]?.includes?.(url.hostname)) {
      throw new Error('Editorial links must use the corresponding platform’s HTTPS domain.');
    }
    ids.add(item.id);
  }
  return edition;
}

export async function createApp({ env = process.env, fetcher = fetch } = {}) {
  const editorial = await loadEditorial(env.EDITORIAL_PATH || 'data/editorial.json');
  const region = (env.YOUTUBE_REGION || 'ET').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(region)) throw new Error('YOUTUBE_REGION must be a two-letter region code.');
  const apiKey = env.YOUTUBE_API_KEY?.trim();
  const staticFiles = new Map(await Promise.all(Object.entries(assets).map(async ([route, [name, type]]) =>
    [route, { type, body: await readFile(resolve(root, 'public', name)) }])));
  let snapshot;
  let expires = 0;
  let pending;

  async function updateChart() {
    const url = new URL('https://www.googleapis.com/youtube/v3/videos');
    url.search = new URLSearchParams({
      part: 'snippet,statistics', chart: 'mostPopular', maxResults: '25', regionCode: region
    });
    try {
      const response = await fetcher(url, {
        headers: { 'X-Goog-Api-Key': apiKey },
        signal: AbortSignal.timeout(5000)
      });
      if (!response.ok) throw new Error('Chart unavailable');
      const feed = await response.json();
      if (!Array.isArray(feed.items)) throw new Error('Invalid chart');
      snapshot = {
        status: 'live', region, updatedAt: new Date().toISOString(),
        items: feed.items.flatMap((item, index) => {
          if (!/^[\w-]{11}$/.test(item.id) || typeof item.snippet?.title !== 'string') return [];
          return [{
            rank: index + 1, id: item.id, title: item.snippet.title,
            channel: item.snippet.channelTitle, views: item.statistics?.viewCount ?? null
          }];
        })
      };
      expires = Date.now() + 15 * 60_000;
    } catch {
      const recent = snapshot?.updatedAt && Date.now() - Date.parse(snapshot.updatedAt) < 60 * 60_000;
      snapshot = recent
        ? { ...snapshot, status: 'stale' }
        : { status: 'unavailable', region, items: [] };
      expires = Date.now() + 60_000;
    }
    return snapshot;
  }

  function chart() {
    if (!apiKey) return { status: 'unconfigured', region, items: [] };
    if (Date.now() < expires) return snapshot;
    pending ??= updateChart().finally(() => { pending = undefined; });
    return pending;
  }

  return createServer(async (req, res) => {
    function send(code, type, body, extra = {}) {
      res.writeHead(code, { ...headers, 'Content-Type': type, ...extra });
      res.end(req.method === 'HEAD' ? undefined : body);
    }
    function json(code, body) {
      send(code, 'application/json; charset=utf-8', JSON.stringify(body), { 'Cache-Control': 'no-store' });
    }
    try {
      if (!['GET', 'HEAD'].includes(req.method)) {
        return send(405, 'text/plain', 'Method not allowed', { Allow: 'GET, HEAD' });
      }
      const path = req.url.split('?')[0];
      const asset = staticFiles.get(path);
      if (asset) return send(200, asset.type, asset.body, { 'Cache-Control': 'no-cache' });
      if (path === '/healthz') return json(200, { status: 'ok' });
      if (path === '/api/editorial') return json(200, editorial);
      if (path === '/api/chart') return json(200, await chart());
      return send(404, 'text/plain', 'Not found');
    } catch {
      return json(500, { error: 'Request failed' });
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT.');
  const server = await createApp();
  server.listen(port, process.env.HOST || '0.0.0.0', () => console.log('Habesha Pulse listening on port ' + port));
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      server.close();
      setTimeout(() => server.closeAllConnections(), 8000).unref();
    });
  }
}
