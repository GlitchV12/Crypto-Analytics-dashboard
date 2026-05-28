# StreamPulse — Real-Time Analytics Dashboard

High-concurrency web analytics platform. Streams live data via WebSockets, buffers writes through an in-memory queue, and batch-flushes to SQLite — handling 300+ simulated events/sec with zero data loss.

## Stack

| Layer     | Tech                              |
|-----------|-----------------------------------|
| Frontend  | React 18 + TypeScript + Vite      |
| Charts    | Recharts                          |
| Backend   | Go 1.22 (net/http + goroutines)   |
| Queue     | Go channel-backed in-process queue|
| DB        | SQLite (WAL mode)                 |
| Transport | WebSocket (gorilla/websocket)     |

---

## Local Development

### Prerequisites
- Go 1.22+ → https://go.dev/dl/
- Node.js 20+ → https://nodejs.org/

### Quick start

```bash
chmod +x setup.sh && ./setup.sh
```

Or manually:

```bash
# Terminal 1 — Go backend (port 8080)
cd backend
go mod tidy
go run ./cmd/server

# Terminal 2 — React frontend (port 5173)
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**

---

## Architecture

```
Browser  ──WS──►  Go Hub  ──broadcast──►  All dashboard clients
                    ▲
                    │ stats every 500ms
                    │
HTTP POST /api/ingest
Simulator (300 ev/s)
           │
           ▼
      Channel Queue (100k cap)
           │
           ▼ batch flush every 150ms
        SQLite (WAL)
```

- **Queue**: non-blocking `chan Event` with capacity 100 000; drops and counts if full
- **Batch writer**: drains up to 200 events per tick in a single SQL transaction
- **Broadcast**: stats snapshot pushed to every WebSocket client every 500ms
- **Simulator**: 8 goroutines producing ~300 events/sec of realistic fake traffic

---

## Deploying to Production

### Step 1 — Deploy Backend to Railway (free tier, supports WebSockets)

1. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub repo
2. Select the **`backend/`** folder (or point to root with `railway.toml` present)
3. Railway auto-detects the `Dockerfile` and builds it
4. Set environment variables in Railway dashboard:
   ```
   PORT=8080
   DB_PATH=/app/data/analytics.db
   ```
5. Add a **Volume** mount at `/app/data` so the DB persists across deploys
6. Copy the generated public URL, e.g. `https://analytics-backend-xxxx.railway.app`

### Step 2 — Deploy Frontend to Vercel

1. Go to [vercel.com](https://vercel.com) → New Project → Import GitHub repo
2. Set **Root Directory** to `frontend`
3. Framework preset: **Vite** (auto-detected)
4. Add environment variable:
   ```
   VITE_WS_URL=wss://analytics-backend-xxxx.railway.app/ws
   ```
5. Click **Deploy**

That's it. Vercel handles the static build; Railway runs the persistent Go server with WebSocket support.

---

## Why not run the backend on Vercel?

Vercel's serverless functions are stateless and have a 30-second execution limit. WebSocket connections require a persistent process. Railway (or Render / Fly.io) provides always-on containers — the right fit for a WebSocket server.

---

## Environment Variables

### Backend
| Variable  | Default             | Description                |
|-----------|---------------------|----------------------------|
| `PORT`    | `8080`              | HTTP/WS listen port        |
| `DB_PATH` | `./analytics.db`    | SQLite file path           |

### Frontend
| Variable       | Default (dev)               | Description               |
|----------------|-----------------------------|---------------------------|
| `VITE_WS_URL`  | Auto (same host `/ws`)      | Override WebSocket URL    |
| `VITE_API_URL` | Auto (same host `/api`)     | Override REST API base    |

---

## Endpoints

| Method | Path           | Description                        |
|--------|----------------|------------------------------------|
| GET    | `/ws`          | WebSocket — live stats stream      |
| POST   | `/api/ingest`  | Ingest a single analytics event    |
| GET    | `/api/stats`   | One-shot stats snapshot (JSON)     |
| GET    | `/health`      | Health check                       |

### Ingest payload example
```json
{
  "id":        "evt-001",
  "type":      "pageview",
  "page":      "/pricing",
  "userId":    "u12345",
  "country":   "US",
  "device":    "desktop",
  "browser":   "Chrome",
  "duration":  4200,
  "timestamp": 0
}
```
`timestamp` is overwritten server-side.
