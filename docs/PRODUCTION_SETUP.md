# Production Setup — SI YBY NET (Simulasi EVE-NG)

Panduan lengkap deploy SI YBY NET ke production dengan MikroTik simulasi di EVE-NG.

## Topologi

```
Internet
     │
Cloudflare Tunnel (HTTPS)
     │
     ▼
┌─────────────────────────────────────┐
│  SI Server — 192.168.31.48          │
│  ├── Next.js Web App (:8080)        │
│  ├── BullMQ Worker                  │
│  ├── PostgreSQL 16                  │
│  └── Redis                          │
└──────────────┬──────────────────────┘
               │ LAN 192.168.31.0/24
               ▼
┌─────────────────────────────────────┐
│  PC EVE-NG Host — 192.168.31.7     │
│  │  port forward :8728 ──►         │
│  │                                  │
│  │  ┌────────────────────────────┐  │
│  │  │ EVE-NG — 192.168.122.146  │  │
│  │  │                            │  │
│  │  │  MikroTik CHR              │  │
│  │  │  192.168.122.60:8728       │  │
│  │  └────────────────────────────┘  │
│  │  (NAT network: 192.168.122.0/24)│
└─────────────────────────────────────┘
```

---

## 1. SI Server (192.168.31.48)

### 1.1 Install Dependencies

```bash
# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# pnpm
corepack enable && corepack prepare pnpm@latest --activate

# PM2
npm install -g pm2

# PostgreSQL 16
sudo apt install -y postgresql-16 postgresql-client-16

# Redis
sudo apt install -y redis-server
sudo systemctl enable redis-server
```

### 1.2 Setup PostgreSQL

```bash
sudo -u postgres psql <<'SQL'
CREATE USER si_ybynet WITH PASSWORD 'GANTI_PASSWORD_KUAT';
CREATE DATABASE si_ybynet OWNER si_ybynet;
GRANT ALL PRIVILEGES ON DATABASE si_ybynet TO si_ybynet;
SQL
```

### 1.3 Clone & Build

```bash
cd /var/www
git clone <repo-url> si-ybynet
cd si-ybynet

# Environment
cp .env.example .env.local
```

Edit `.env.local`:

```env
# Auth
AUTH_URL=https://si.ybynet.id        # Domain Cloudflare Tunnel kamu
AUTH_SECRET=<generate: openssl rand -base64 32>

# PostgreSQL
DATABASE_URL=postgresql://si_ybynet:GANTI_PASSWORD_KUAT@localhost:5432/si_ybynet

# Redis
REDIS_URL=redis://localhost:6379

# MikroTik — TIDAK DIPAKAI di runtime (settings dari DB)
# Tapi tetap isi untuk initial seed / fallback
MIKROTIK_HOST=192.168.31.7
MIKROTIK_PORT=8728
MIKROTIK_USER=si-api
MIKROTIK_PASSWORD=StrongAPIPass789!

# Fonnte WhatsApp
FONNTE_API_URL=https://api.fonnte.com/send
FONNTE_TOKEN=<token-fonnte-kamu>
```

```bash
# Install & build
pnpm install --frozen-lockfile
pnpm drizzle-kit migrate
pnpm build

# Compile worker
npx tsc -p tsconfig.worker.json   # atau sesuai config worker kamu
```

### 1.4 Start dengan PM2

```bash
# Port 8080 (sesuai topologi)
PORT=8080 pm2 start ecosystem.config.cjs

# Auto-start saat boot
pm2 save
pm2 startup
```

> **Note:** Ubah `ecosystem.config.cjs` jika port production bukan 3000:
> ```js
> args: "start -p 8080",
> ```

### 1.5 Verifikasi

```bash
pm2 status                         # Pastikan web + worker online
curl -s http://localhost:8080      # Harus return HTML
```

---

## 2. PC EVE-NG (192.168.31.7)

### 2.1 Port Forward MikroTik API

SI Server tidak bisa reach 192.168.122.60 langsung (beda subnet, di-NAT oleh EVE-NG).
PC harus jadi jembatan: forward port 8728 ke MikroTik di dalam EVE.

```bash
# Enable IP forwarding
sudo sysctl -w net.ipv4.ip_forward=1
echo 'net.ipv4.ip_forward=1' | sudo tee -a /etc/sysctl.conf

# Port forward 8728 → MikroTik di EVE
sudo iptables -t nat -A PREROUTING -d 192.168.31.7 -p tcp --dport 8728 \
  -j DNAT --to 192.168.122.60:8728

sudo iptables -t nat -A POSTROUTING -d 192.168.122.60 -p tcp --dport 8728 \
  -j MASQUERADE

sudo iptables -A FORWARD -p tcp -d 192.168.122.60 --dport 8728 \
  -j ACCEPT

# Persist iptables rules
sudo apt install -y iptables-persistent
sudo netfilter-persistent save
```

### 2.2 Verifikasi

```bash
# Dari PC sendiri — langsung ke MikroTik
nc -zv 192.168.122.60 8728
# Expected: Connection to 192.168.122.60 8728 port [tcp/*] succeeded!

# Dari SI Server (192.168.31.48) — lewat port forward
nc -zv 192.168.31.7 8728
# Expected: Connection to 192.168.31.7 8728 port [tcp/*] succeeded!
```

---

## 3. MikroTik di EVE-NG (192.168.122.60)

### 3.1 Buat User API

Dari console MikroTik di EVE-NG:

```mikrotik
/user add name=si-api password=StrongAPIPass789! group=full
```

### 3.2 Pastikan API Service Aktif

```mikrotik
/ip service print
# Pastikan "api" port 8728 enabled

/ip service enable api
```

### 3.3 Izinkan Akses dari Network 122.x

```mikrotik
# Cek firewall tidak blokir port 8728
/ip firewall filter print where dst-port=8728

# Jika ada rule yang block, disable atau tambah allow:
/ip firewall filter add chain=input protocol=tcp dst-port=8728 action=accept \
  comment="Allow RouterOS API" place-before=0
```

### 3.4 Verifikasi

```mikrotik
/system identity print
/system resource print
/ip address print
```

---

## 4. Cloudflare Tunnel (di SI Server)

### 4.1 Install cloudflared

```bash
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg \
  | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null

echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' \
  | sudo tee /etc/apt/sources.list.d/cloudflared.list

sudo apt update && sudo apt install -y cloudflared
```

### 4.2 Login & Buat Tunnel

```bash
cloudflared tunnel login
cloudflared tunnel create si-ybynet
cloudflared tunnel route dns si-ybynet si.ybynet.id   # ganti dengan domain kamu
```

### 4.3 Config

```bash
sudo mkdir -p /etc/cloudflared

sudo tee /etc/cloudflared/config.yml <<'EOF'
tunnel: <TUNNEL_ID>
credentials-file: /root/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: si.ybynet.id
    service: http://localhost:8080
  - service: http_status:404
EOF
```

> Ganti `<TUNNEL_ID>` dengan ID dari `cloudflared tunnel list`.

### 4.4 Jalankan sebagai Service

```bash
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared

# Verifikasi
sudo systemctl status cloudflared
curl -s https://si.ybynet.id    # Harus bisa diakses dari internet
```

---

## 5. Konfigurasi MikroTik di App

Setelah semua jalan, buka SI app → **Settings** → **MikroTik**:

| Field    | Value              |
|----------|--------------------|
| Host     | `192.168.31.7`     |
| Port     | `8728`             |
| User     | `si-api`           |
| Password | `StrongAPIPass789!`|

Klik **Test Koneksi** — harus muncul info router (identity, CPU, uptime, version).

---

## 6. Checklist Verifikasi

```bash
# ✓ PostgreSQL
sudo systemctl status postgresql

# ✓ Redis
sudo systemctl status redis-server
redis-cli ping   # PONG

# ✓ Next.js + Worker
pm2 status       # si-ybynet-web: online, si-ybynet-worker: online

# ✓ Cloudflare Tunnel
sudo systemctl status cloudflared
curl -s https://si.ybynet.id

# ✓ MikroTik API reachable
nc -zv 192.168.31.7 8728

# ✓ EVE-NG MikroTik running
# Buka console MikroTik di EVE → /system resource print
```

---

## 7. Auto-Start Setelah Reboot

| Komponen | Cara Auto-Start |
|----------|-----------------|
| PostgreSQL | `sudo systemctl enable postgresql` |
| Redis | `sudo systemctl enable redis-server` |
| PM2 (Next.js + Worker) | `pm2 save && pm2 startup` |
| Cloudflare Tunnel | `sudo systemctl enable cloudflared` |
| iptables (PC) | `iptables-persistent` (sudah di-save) |
| EVE-NG + MikroTik | Set auto-start di EVE-NG topology settings |

---

## Troubleshooting

### MikroTik API tidak bisa direach dari SI Server

```bash
# 1. Cek dari PC ke MikroTik
nc -zv 192.168.122.60 8728

# 2. Cek iptables rules di PC
sudo iptables -t nat -L -n | grep 8728
sudo iptables -L FORWARD -n | grep 8728

# 3. Cek ip_forward aktif
cat /proc/sys/net/ipv4/ip_forward    # harus 1

# 4. Cek MikroTik firewall
# Di console MikroTik:
/ip firewall filter print where action=drop
```

### Cloudflare Tunnel error

```bash
sudo journalctl -u cloudflared -f    # Live log
cloudflared tunnel info si-ybynet     # Status tunnel
```

### PM2 app crash

```bash
pm2 logs si-ybynet-web --lines 50
pm2 logs si-ybynet-worker --lines 50
```

### Connection timeout di Settings

- Pastikan port `8728` (bukan `8729`/API-SSL)
- Cek username/password MikroTik benar
- MikroTik API service harus enabled: `/ip service enable api`
