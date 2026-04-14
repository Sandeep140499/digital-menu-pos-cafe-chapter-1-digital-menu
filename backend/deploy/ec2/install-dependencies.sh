#!/usr/bin/env bash
# One-time server prep on Ubuntu 22.04/24.04 LTS (run on EC2 as a sudo-capable user).
# After this: clone your repo, configure backend/.env, then npm ci && npx prisma migrate deploy && npm run build && pm2 ...

set -euo pipefail

if ! command -v sudo >/dev/null 2>&1; then
  echo "sudo is required."
  exit 1
fi

sudo apt-get update
sudo apt-get install -y git nginx curl ca-certificates gnupg

if ! command -v node >/dev/null 2>&1 || ! node -e "process.exit(Number(process.version.slice(1).split('.')[0]) >= 20 ? 0 : 1)" 2>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

sudo npm i -g pm2

sudo apt-get install -y certbot python3-certbot-nginx

echo "Done. Node: $(node -v)  npm: $(npm -v)"
echo "Next: clone repo, cd backend, cp .env.example .env, set DATABASE_URL and secrets, then build and pm2 start (see repository README)."
