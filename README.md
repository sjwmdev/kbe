# Kalour Beauty Empire (kbe)

E-commerce platform for Kalour Beauty Empire: a Go (Clean Architecture) REST API
backed by PostgreSQL, and a React + Vite + TypeScript + Tailwind frontend
(customer site + admin dashboard).

## Prerequisites

- Go 1.24+
- Node.js 20+
- PostgreSQL 14+ (a local install, or a container — anything reachable via a `DATABASE_URL`)

## 1. Database

Create a database and run every migration in order:

```sh
createdb kbe
for f in backend/migrations/*.up.sql; do psql -d kbe -f "$f"; done
```

(To roll back a specific migration: `psql -d kbe -f backend/migrations/000N_name.down.sql`)

## 2. Backend

```sh
cd backend
cp .env.example .env   # then edit DATABASE_URL / JWT_SECRET as needed
```

Load the `.env` values into your shell (or use a tool like `direnv`), then:

```sh
# Create the one admin user (only needs to be run once)
ADMIN_USERNAME=kalour ADMIN_PASSWORD=your-password go run ./cmd/seed

# Start the API (default port 8080)
go run ./cmd/api
```

Verify it's up: `curl http://localhost:8080/health` → `{"status":"ok"}`

## 3. Frontend

In a second terminal:

```sh
cd frontend
cp .env.example .env   # defaults already point at http://localhost:8080
npm install
npm run dev
```

Open the printed URL (default `http://localhost:5173`).

- Customer site: `/`
- Admin login: `/admin/login` (use the username/password from the seed step above)

## Running both concurrently

Just keep the two `go run ./cmd/api` and `npm run dev` terminals open side by side —
Vite proxies nothing; the frontend talks to the backend directly over
`VITE_API_BASE_URL` (CORS is already configured on the backend for
`FRONTEND_ORIGIN`, default `http://localhost:5173`).

## Before going live

- Set `VITE_WHATSAPP_NUMBER` in `frontend/.env` to the real business WhatsApp
  number (country code, no leading `+`, no spaces).
- Set a strong, unique `JWT_SECRET` in `backend/.env`.
- Point `DATABASE_URL` at your production Postgres instance and re-run the
  migration there.

## Production deployment (Ubuntu + Nginx + Systemd)

Build both halves on the server (or upload the build output):

```sh
# Backend — produces a single static binary
cd backend
go build -o kbe-api ./cmd/api

# Frontend — produces static files in frontend/dist
cd ../frontend
npm ci
npm run build
```

Copy `backend/kbe-api`, `backend/.env` (with production `DATABASE_URL` /
`JWT_SECRET` / `FRONTEND_ORIGIN` / `UPLOADS_DIR`), and `frontend/dist` to the
server (e.g. `/opt/kbe/api`, `/opt/kbe/uploads`, `/opt/kbe/web`).

**Systemd** — run the API as a background service (`/etc/systemd/system/kbe-api.service`):

```ini
[Unit]
Description=Kalour Beauty Empire API
After=network.target postgresql.service

[Service]
Type=simple
User=kbe
WorkingDirectory=/opt/kbe/api
EnvironmentFile=/opt/kbe/api/.env
ExecStart=/opt/kbe/api/kbe-api
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```sh
sudo systemctl daemon-reload
sudo systemctl enable --now kbe-api
sudo systemctl status kbe-api
```

**Nginx** — serve the built frontend directly and reverse-proxy the API
(`/etc/nginx/sites-available/kbe`, then symlink into `sites-enabled`):

```nginx
server {
    listen 80;
    server_name your-domain.co.tz;

    root /opt/kbe/web;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /uploads/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location / {
        try_files $uri /index.html;
    }
}
```

`X-Forwarded-For` matters here: the backend's audit log records the
caller's IP via `clientIP()` in `middleware.go`, which trusts that header
specifically because it assumes traffic only ever arrives via a proxy that
sets it correctly, as above.

Point `frontend/.env`'s `VITE_API_BASE_URL` at the public domain (e.g.
`https://your-domain.co.tz`) before running `npm run build`, since it's
baked into the static bundle at build time, not read at runtime. Then run
`sudo certbot --nginx` to add TLS.

## Project layout

```
kbe/
├── backend/    Go API (Clean Architecture: domain / usecase / repository / delivery)
└── frontend/   React + Vite + TypeScript + Tailwind (customer site + admin dashboard)
```

See [kalour_website_plan.md](kalour_website_plan.md) for the full architectural plan.
