# Operations Runbook

This document is for running AI Town in a stable, service-managed mode on Linux.

## 1. Service Topology

- `ai-town-convex-backend.service`: local Convex backend (`127.0.0.1:3210`)
- `ai-town-convex-sync.service`: syncs/functions runner (`npx convex dev --url http://127.0.0.1:3210`)
- `ai-town-ollama.service`: local Ollama (`127.0.0.1:11434`)
- `ai-town-frontend-build.service`: one-shot frontend build to `/var/www/ai-town`
- `nginx`: serves `/var/www/ai-town` on `:8080`
- `caddy`: public reverse proxy (`/ai-town/*` -> nginx, `/api/*` -> Convex)

Related files:

- `deploy/systemd/*`
- `deploy/nginx/ai-town.conf`
- `deploy/caddy/Caddyfile`
- `scripts/build-frontend-prod.sh`
- `scripts/start-convex-local.sh`

## 2. First-Time Setup (Summary)

1. Install dependencies: `npm install`
2. Ensure Convex backend binary exists at `/root/bin/convex-local-backend/convex-local-backend`
3. Ensure Ollama binary exists at `/root/ollama/bin/ollama`
4. Pull required models:
   - `qwen2:7b`
   - `znbang/bge:large-zh-v1.5-q8_0`
5. Install service/unit/proxy files from `deploy/` to system locations
6. Enable and start services

For machine-specific setup details, see `DEPLOY_LOCAL_QWEN.md`.

## 3. Daily Operations

Check all core services:

```bash
systemctl --no-pager --full status \
  ai-town-convex-backend.service \
  ai-town-convex-sync.service \
  ai-town-ollama.service \
  ai-town-frontend-build.service \
  nginx \
  caddy
```

Restart backend path:

```bash
systemctl restart ai-town-convex-backend.service
systemctl restart ai-town-convex-sync.service
```

Rebuild frontend and reload:

```bash
systemctl restart ai-town-frontend-build.service
```

## 4. Health Checks

Proxy and frontend:

```bash
curl -sI http://127.0.0.1/ai-town/
curl -sI http://127.0.0.1:8080/ai-town/
```

Ollama:

```bash
curl -s http://127.0.0.1:11434/api/tags
```

Convex world status:

```bash
npx convex run world:defaultWorldStatus \
  --admin-key <ADMIN_KEY> \
  --url http://127.0.0.1:3210
```

## 5. Common Issues

### Agents not visible but page loads

- Verify frontend was rebuilt after latest code:
  - `systemctl restart ai-town-frontend-build.service`
- Hard refresh browser cache (`Ctrl+Shift+R`)
- Confirm world is running:
  - `npx convex run testing:resume --admin-key <ADMIN_KEY> --url http://127.0.0.1:3210`

### `engineNotRunning` log appears

- This can happen when idle world auto-stops and old `runStep` finishes late.
- Check current world status instead of relying on one log line.

### Embedding failures (`input length exceeds context length`)

- Current code truncates embedding input and degrades safely (no full loop crash).
- If needed, adjust limit in `convex/util/llm.ts` (`OLLAMA_EMBEDDING_MAX_CHARS`).

## 6. Log Commands

```bash
journalctl -u ai-town-convex-backend.service -f
journalctl -u ai-town-convex-sync.service -f
journalctl -u ai-town-ollama.service -f
journalctl -u nginx -f
journalctl -u caddy -f
```

## 7. Security Notes

- Do not put PAT tokens in commands committed to files.
- If a token is ever pasted in chat/shell history, revoke immediately and create a new one.
- Use short-lived/minimum-scope credentials for push automation.
