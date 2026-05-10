# Searchtastic

Searchtastic is a Next.js metasearch app that queries a SearXNG instance, removes blacklisted domains, and can prefer or require whitelisted domains.

## Local Development

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Set `SEARXNG_URL` to your SearXNG base URL:

```bash
SEARXNG_URL=http://localhost:8080
```

The app reads these files at runtime:

- `config/search-engines.json`
- `config/whitelist.txt`
- `config/blacklist.txt`

## SearXNG Test

The app expects JSON output from SearXNG:

```bash
curl "https://your-searxng-host/search?q=test&engines=google,bing&format=json"
```

## Railway Deployment

Create two Railway services.

### 1. SearXNG service

Use `deploy/searxng/Dockerfile` as the Dockerfile for this service.

Variables:

```bash
SEARXNG_SECRET=<long-random-string>
SEARXNG_BASE_URL=https://<your-searxng-domain>/
```

After deploy, confirm JSON works:

```bash
curl "https://<your-searxng-domain>/search?q=test&engines=google,bing&format=json"
```

### 2. Web service

Use the root `Dockerfile` for this service.

Variables:

```bash
SEARXNG_URL=https://<your-searxng-domain>
```

Deploy the web service after the SearXNG URL is available.
