# Leaf UI - Local Development Setup

## Prerequisites

The Leaf containerized stack must be running (API, DB, nginx-basicauth):

```bash
cd datamart-leaf_containerized
podman-compose -f leaf-stack-basicauth.yml up -d
```

Verify the stack is healthy:

```bash
curl -sk https://localhost:8443/health   # should return "healthy"
curl -sk https://localhost:8443/api/config | head -c 100   # should return JSON
```

## Quick Start

```bash
cd leaf/src/ui-client

# 1. Install dependencies (first time only)
npm install --legacy-peer-deps

# 2. Create your proxy config from the example
cp src/setupProxy.js.example src/setupProxy.js

# 3. Edit src/setupProxy.js with your basicauth credentials
#    (see datamart-leaf_containerized/auth/basicauth/.env for users)

# 4. Clear any cached Leaf tokens in your browser
#    DevTools > Application > Local Storage > Clear (for localhost:3000)

# 5. Start the dev server
npm start
```

The app opens at `http://localhost:3000` with hot-reloading enabled.

## How It Works

### Architecture

```
Browser (localhost:3000)
  │
  ├── Static assets (JS/CSS/HTML) ──→ CRA dev server (hot reload)
  │
  └── /api/* requests ──→ setupProxy.js
                              │
                              ▼
                    nginx-basicauth (localhost:8443)
                    ├── /api/user: Basic Auth + SAML2 header injection → leaf-api
                    └── /api/*:    JWT passthrough → leaf-api
```

### Why setupProxy.js?

Create React App (CRA) automatically loads `src/setupProxy.js` if it exists.
This is a built-in CRA feature — no additional configuration is needed. CRA
calls the exported function during dev server startup, passing the Express app
instance so you can add custom middleware.

See: https://create-react-app.dev/docs/proxying-api-requests-in-development/#configuring-the-proxy-manually

### What setupProxy.js does

1. Intercepts all `/api/*` requests from the browser
2. Forwards them to `https://localhost:8443` (nginx-basicauth)
3. Attaches HTTP Basic Auth credentials (from env vars or defaults)
4. Accepts the self-signed SSL certificate (`secure: false`)

This replaces the simpler `"proxy"` field in `package.json`, which was removed
because it can't add auth headers or handle HTTPS with self-signed certs.

### Why not proxy directly to leaf-api (port 5001)?

The API expects authentication headers injected by nginx. Specifically,
`/api/user` requires nginx to translate Basic Auth credentials into SAML2-style
headers (`eppn`, `isMemberOf`, etc.) before forwarding to the API. Without
nginx in the middle, the API returns 403.

## Files

| File | Git tracked? | Purpose |
|------|-------------|---------|
| `src/setupProxy.js.example` | Yes | Template with placeholder credentials |
| `src/setupProxy.js` | No (gitignored) | Your local copy with real credentials |

## Environment Variables

You can override credentials via env vars instead of editing the file:

```bash
LEAF_DEV_USER=myuser LEAF_DEV_PASS=mypass npm start
```

## Troubleshooting

**"Not an authorized Leaf user" / 403 error**
- Ensure nginx-basicauth container is running: `podman ps | grep nginx`
- Check your credentials in `setupProxy.js` match `auth/basicauth/.env`
- Clear browser local storage for `localhost:3000`

**"No Leaf server was found"**
- Verify the stack is up: `curl -sk https://localhost:8443/api/config`
- Check that `setupProxy.js` exists (not just the `.example`)

**npm install fails with ERESOLVE**
- Use `npm install --legacy-peer-deps` (known peer dependency conflict)

**"Expired access token" error**
- Clear browser local storage — a stale cached JWT is being reused
