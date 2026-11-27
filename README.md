# Habesha Pulse

A deployable creator website with a curated Amharic comedy brief and an optional official YouTube regional chart. The first edition is included. TikTok is curated through links to public creator examples.

## Run locally

Install Node.js 24 or later, unzip the archive, then open a terminal in the `habesha-pulse` folder.

```sh
npm start
```

Open http://localhost:3000. There are no npm dependencies to install. Run `npm run check` for syntax checks and server integration tests.

## Configure the site

Copy `.env.example` to `.env` and restart. On PowerShell use `Copy-Item .env.example .env`. On macOS or Linux use `cp .env.example .env`.

| Setting | Default | Purpose |
|---|---|---|
| PORT | 3000 | HTTP listener port. Managed hosts may provide this. |
| HOST | 0.0.0.0 | Listener interface. Use 127.0.0.1 for local-only access. |
| YOUTUBE_API_KEY | empty | Enables the official chart. Keep it in your host's secret settings. |
| YOUTUBE_REGION | ET | Requested YouTube chart region. |
| EDITORIAL_PATH | data/editorial.json | JSON edition path, relative to the app root or absolute. |

To enable the chart, create a Google Cloud project, enable **YouTube Data API v3**, then create an API key under **APIs & Services → Credentials**. Restrict it to YouTube Data API v3 and enter the value in `YOUTUBE_API_KEY`. If you have fixed outbound IPs, you can also restrict the key to those IPs.

The app asks YouTube for its official `mostPopular` chart and preserves the returned order. It shows YouTube's worldwide video view totals. The chart covers the categories YouTube provides and its availability can vary by region. If Ethiopia returns no entries or the API fails, visitors see an unavailable status. A recently cached chart is labeled with its last successful fetch time. For a smoke test with your own key, visit `/api/chart` and inspect the status. The bundled integration tests simulate API responses.

## Publish a new edition

Edit `data/editorial.json`. Set `edition` to a date in YYYY-MM-DD format and use a unique `id` for every example. Each item includes platform (YouTube or TikTok), format, title, Amharic heading (`am`), creator, source URL, original filming idea, and a tile color (sun, mint, or plum). Restart or redeploy after editing. Mount an alternate file and set `EDITORIAL_PATH` if you publish separately from the image build.

## Deploy

Use a Node web service or Docker host. For a Node service, set the runtime to Node 24 and the start command to `npm start`. Configure the environment variables in the hosting dashboard and point its health check at `/healthz`. Serve the public site through your host's HTTPS endpoint.

For Docker:

```sh
docker build -t habesha-pulse .
docker run --rm -p 3000:3000 habesha-pulse
```

To enable your configured chart in the container, add `--env-file .env` before the image name. The Docker build excludes local env files, and the image runs as a non-root user. Cache lives in memory and is per instance. The starter uses unauthenticated public reads and has no database to provision. Content editing happens in the edition file. The interface uses English navigation and Amharic headings.

## Project layout

- `public/` contains the responsive frontend.
- `data/editorial.json` contains the weekly brief.
- `server.mjs` serves the site, configuration, health check and chart.
- `test/` contains HTTP integration tests.
