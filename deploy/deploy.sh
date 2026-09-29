#!/usr/bin/env bash
set -euo pipefail

# Always navigate to the repository root directory regardless of where the script is called from
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${ROOT_DIR}"

echo "=========================================="
echo " Deploying Hill Trade Ledger...           "
echo " Working directory: ${ROOT_DIR}           "
echo "=========================================="

# If .env was accidentally created inside deploy/, move it to the project root
if [ -f "${SCRIPT_DIR}/.env" ] && [ ! -f "${ROOT_DIR}/.env" ]; then
    echo "==> Moving .env from deploy/ to project root..."
    mv "${SCRIPT_DIR}/.env" "${ROOT_DIR}/.env"
elif [ -f "${SCRIPT_DIR}/.env" ] && [ -f "${ROOT_DIR}/.env" ]; then
    # Remove stale deploy/.env to avoid confusion
    rm -f "${SCRIPT_DIR}/.env"
fi

# 1. Pull latest changes if running from a git repository
if [ -d .git ]; then
    echo "==> Fetching git updates..."
    git pull origin main
fi

# 2. Ensure .env exists in the project root with production secrets and public IP
if [ ! -f "${ROOT_DIR}/.env" ]; then
    echo "==> .env not found. Generating production configuration in project root..."
    JWT_SECRET=$(openssl rand -hex 32)
    ENCRYPTION_KEY=$(openssl rand -hex 16)
    
    # Try fetching EC2 public IP from AWS metadata or external IP service
    PUBLIC_IP=$(curl -s --connect-timeout 2 http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || curl -s --connect-timeout 2 ifconfig.me 2>/dev/null || echo "localhost")
    
    cat <<EOF > "${ROOT_DIR}/.env"
DB_PROVIDER="sqlite"
DATABASE_URL="file:./dev.db"
PORT=3000
NODE_ENV=production
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=7d
ENCRYPTION_KEY=${ENCRYPTION_KEY}
CLIENT_URL=http://${PUBLIC_IP}
EOF
    echo "==> Created ${ROOT_DIR}/.env with generated JWT_SECRET, ENCRYPTION_KEY, and CLIENT_URL=http://${PUBLIC_IP}"
fi

# Export all environment variables from .env to child processes (Prisma, Node, PM2)
if [ -f "${ROOT_DIR}/.env" ]; then
    set -a
    source "${ROOT_DIR}/.env"
    set +a
fi

# 3. Install dependencies
echo "==> Installing dependencies..."
npm install

# 4. Generate Prisma Client & Sync DB schema
echo "==> Updating database schema..."
npm run db:generate
npm run db:push

# 5. Seed initial data if database is empty
USER_COUNT=$(npx tsx -e "import { PrismaClient } from '@prisma/client'; const p = new PrismaClient(); p.user.count().then(c => { console.log(c); p.\$disconnect(); }).catch(() => { console.log(0); p.\$disconnect(); });" 2>/dev/null || echo "0")
if [ "${USER_COUNT}" = "0" ]; then
    echo "==> Empty database detected (0 users). Seeding initial accounts & items..."
    npm run db:seed
else
    echo "==> Existing data detected (${USER_COUNT} users found). Preserving data."
fi

# 6. Build server and client
echo "==> Building application..."
npm run build

# 7. Start or reload PM2 process
echo "==> Reloading PM2..."
if pm2 list | grep -q "hill-trade-ledger"; then
    pm2 reload ecosystem.config.cjs --update-env
else
    pm2 start ecosystem.config.cjs
    pm2 save
fi

echo "=========================================="
echo " Deployment completed successfully!       "
echo " Status: pm2 status                       "
echo " Logs:   pm2 logs hill-trade-ledger       "
echo "=========================================="
