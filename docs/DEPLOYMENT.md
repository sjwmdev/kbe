# Kalour Beauty Empire — Hetzner Deployment Guide

Step-by-step production deployment on a single Hetzner Cloud server
(Ubuntu 22.04/24.04). Replace every `<PLACEHOLDER>` with your real value —
**never commit real secrets**; they live only in `/srv/kalour/backend/.env`
on the server.

Architecture on the server:

```
Internet → Nginx (:443, TLS)
            ├── /            → static frontend build  (/srv/kalour/frontend-dist)
            ├── /api/…       → Go API      (127.0.0.1:8080, systemd service)
            └── /uploads/…   → Go API (serves uploaded images)
PostgreSQL 16 (localhost only)
```

---

## 1. First-time server setup

```sh
# as root on a fresh server — create a deploy user
adduser kalour
usermod -aG sudo kalour
rsync --archive --chown=kalour:kalour ~/.ssh /home/kalour   # copy SSH key
# from now on, log in as kalour and use sudo
```

### 1.1 Firewall (UFW)

```sh
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status verbose        # verify: only 22, 80, 443 open
```

Postgres and the Go API are **never** exposed publicly — they bind to
localhost only.

### 1.2 Install packages

```sh
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx postgresql postgresql-contrib git ufw

# Go (check https://go.dev/dl for the current 1.22+ version)
curl -LO https://go.dev/dl/go1.22.5.linux-amd64.tar.gz
sudo rm -rf /usr/local/go && sudo tar -C /usr/local -xzf go1.22.5.linux-amd64.tar.gz
echo 'export PATH=$PATH:/usr/local/go/bin' | sudo tee /etc/profile.d/go.sh
source /etc/profile.d/go.sh

# Node LTS (for building the frontend)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

### 1.3 Database

```sh
sudo -u postgres psql <<'SQL'
CREATE USER kalour_app WITH PASSWORD '<DB_PASSWORD>';
CREATE DATABASE kbe OWNER kalour_app;
SQL
```

Postgres listens on localhost by default — leave it that way.

---

## 2. Get the code and configure

```sh
sudo mkdir -p /srv/kalour && sudo chown kalour:kalour /srv/kalour
cd /srv/kalour
git clone https://github.com/sjwmdev/kbe.git .
```

### 2.1 Backend `.env`

```sh
cp backend/.env.example backend/.env
nano backend/.env
```

```ini
DATABASE_URL=postgres://kalour_app:<DB_PASSWORD>@localhost:5432/kbe?sslmode=disable
JWT_SECRET=<LONG_RANDOM_SECRET>        # e.g. output of: openssl rand -base64 48
PORT=8080
FRONTEND_ORIGIN=https://<YOUR_DOMAIN>
UPLOADS_DIR=/srv/kalour/backend/uploads
DEFAULT_BUSINESS_SLUG=kalour
```

```sh
chmod 600 backend/.env
mkdir -p backend/uploads
```

### 2.2 Frontend `.env`

```sh
cp frontend/.env.example frontend/.env
nano frontend/.env
```

```ini
VITE_API_BASE_URL=https://<YOUR_DOMAIN>
VITE_WHATSAPP_NUMBER=<COUNTRYCODE_NUMBER>     # e.g. 2557XXXXXXXX, no +
VITE_CONTACT_EMAIL=<CONTACT_EMAIL>
```

---

## 3. Run migrations

Migrations are plain SQL, applied in numeric order:

```sh
cd /srv/kalour/backend
for f in migrations/*.up.sql; do
  echo "applying $f"
  psql "postgres://kalour_app:<DB_PASSWORD>@localhost:5432/kbe" -f "$f" || break
done
```

(For later deploys, apply only the new files since the last deploy.)

### 3.1 Bootstrap the first admin (first deploy only)

```sh
cd /srv/kalour/backend
set -a; source .env; set +a
BUSINESS_SLUG=kalour ADMIN_EMAIL=<ADMIN_EMAIL> ADMIN_USERNAME=<ADMIN_USERNAME> \
  ADMIN_PASSWORD=<TEMP_ADMIN_PASSWORD> go run ./cmd/seed
```

The admin must change this password on first login (enforced by the app).

---

## 4. Build

```sh
# backend binary
cd /srv/kalour/backend
go build -o /srv/kalour/bin/kalour-api ./cmd/api

# frontend static build
cd /srv/kalour/frontend
npm ci
npm run build
rm -rf /srv/kalour/frontend-dist
cp -r dist /srv/kalour/frontend-dist
```

---

## 5. systemd service (backend)

`sudo nano /etc/systemd/system/kalour-api.service`:

```ini
[Unit]
Description=Kalour Beauty Empire API
After=network.target postgresql.service

[Service]
User=kalour
WorkingDirectory=/srv/kalour/backend
EnvironmentFile=/srv/kalour/backend/.env
ExecStart=/srv/kalour/bin/kalour-api
Restart=on-failure
RestartSec=3
NoNewPrivileges=true
ProtectSystem=full
ReadWritePaths=/srv/kalour/backend/uploads

[Install]
WantedBy=multi-user.target
```

```sh
sudo systemctl daemon-reload
sudo systemctl enable --now kalour-api
sudo systemctl status kalour-api          # must be active (running)
curl -s http://127.0.0.1:8080/health      # {"status":"ok"}
```

---

## 6. Nginx + SSL

`sudo nano /etc/nginx/sites-available/kalour`:

```nginx
server {
    listen 80;
    server_name <YOUR_DOMAIN> www.<YOUR_DOMAIN>;

    root /srv/kalour/frontend-dist;
    index index.html;

    # SPA: every non-file route falls back to index.html
    location / {
        try_files $uri /index.html;
    }

    # API and uploaded images → Go backend on localhost
    location /api/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 15m;          # image uploads
    }
    location /uploads/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        expires 7d;
    }

    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
}
```

```sh
sudo ln -s /etc/nginx/sites-available/kalour /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

# SSL via Let's Encrypt (also sets up auto-renewal + HTTPS redirect)
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d <YOUR_DOMAIN> -d www.<YOUR_DOMAIN>
```

Verify: `https://<YOUR_DOMAIN>` shows the storefront,
`https://<YOUR_DOMAIN>/admin/login` the dashboard.

---

## 7. Deploying updates

```sh
cd /srv/kalour
git pull

# 1. new migrations only (check which are new since last deploy)
psql "postgres://kalour_app:<DB_PASSWORD>@localhost:5432/kbe" -f backend/migrations/00NN_new_one.up.sql

# 2. rebuild backend + restart
cd backend && go build -o /srv/kalour/bin/kalour-api.new ./cmd/api \
  && mv /srv/kalour/bin/kalour-api.new /srv/kalour/bin/kalour-api
sudo systemctl restart kalour-api

# 3. rebuild frontend
cd ../frontend && npm ci && npm run build
rm -rf /srv/kalour/frontend-dist && cp -r dist /srv/kalour/frontend-dist

# 4. smoke test
curl -s https://<YOUR_DOMAIN>/api/v1/products?page=1 | head -c 200
```

---

## 8. Backups

Nightly database dump + weekly uploads copy, kept 14 days:

```sh
sudo mkdir -p /var/backups/kalour && sudo chown kalour:kalour /var/backups/kalour
crontab -e
```

```cron
# nightly DB dump at 02:30
30 2 * * * pg_dump "postgres://kalour_app:<DB_PASSWORD>@localhost:5432/kbe" | gzip > /var/backups/kalour/kbe-$(date +\%F).sql.gz
# weekly uploads archive (Sunday 03:00)
0 3 * * 0 tar -czf /var/backups/kalour/uploads-$(date +\%F).tar.gz -C /srv/kalour/backend uploads
# prune backups older than 14 days
0 4 * * * find /var/backups/kalour -type f -mtime +14 -delete
```

Restore a dump:
`gunzip -c kbe-YYYY-MM-DD.sql.gz | psql "postgres://kalour_app:<DB_PASSWORD>@localhost:5432/kbe"`
(into a freshly created empty database).

Copy backups off the server too (e.g. Hetzner Storage Box via `rclone`/`scp`).

---

## 9. Rollback

Code (backend or frontend misbehaving after a deploy):

```sh
cd /srv/kalour
git log --oneline -5                 # find the last good commit
git checkout <GOOD_COMMIT_HASH>
cd backend && go build -o /srv/kalour/bin/kalour-api ./cmd/api && sudo systemctl restart kalour-api
cd ../frontend && npm ci && npm run build && rm -rf /srv/kalour/frontend-dist && cp -r dist /srv/kalour/frontend-dist
# return to the branch once fixed: git checkout main
```

Database: each migration has a `.down.sql` — apply it to reverse a bad
migration, or restore last night's dump (§8). Take a manual `pg_dump`
**before** running new migrations on production.

---

## 10. Health & logs

```sh
sudo systemctl status kalour-api
sudo journalctl -u kalour-api -f            # live API logs
sudo tail -f /var/log/nginx/access.log
curl -s https://<YOUR_DOMAIN>/health
```

## Security checklist (recap)

- [ ] UFW: only 22/80/443 open; API and Postgres on localhost only
- [ ] `backend/.env` mode 600, never committed; `JWT_SECRET` long and random
- [ ] SSL active with auto-renew (`sudo certbot renew --dry-run`)
- [ ] First admin password changed after seeding
- [ ] Backups running and copied off-server
- [ ] `sudo apt upgrade` on a regular schedule
