#!/usr/bin/env bash
set -euo pipefail

echo "=========================================="
echo " Deploying Hill Trade Ledger...           "
echo "=========================================="

# 1. Pull latest changes if running from a git repository
if [ -d .git ]; then
    echo "==> Fetching git updates..."
    git pull origin main
fi

# 2. Ensure .env exists with production secrets and public IP
if [ ! -f .env ]; then
    echo "==> .env not found. Generating production configuration..."
    JWT_SECRET=$(openssl rand -hex 32)
    ENCRYPTION_KEY=$(openssl rand -hex 16)
    
    # Try fetching EC2 public IP from AWS metadata or external IP service
    PUBLIC_IP=$(curl -s --connect-timeout 2 http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || curl -s --connect-timeout 2 ifconfig.me 2>/dev/null || echo "localhost")
    
    cat <<EOF > .env
DB_PROVIDER="sqlite"
DATABASE_URL="file:./dev.db"
PORT=3000
NODE_ENV=production
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=7d
ENCRYPTION_KEY=${ENCRYPTION_KEY}
CLIENT_URL=http://${PUBLIC_IP}
EOF
    echo "==> Created .env with generated JWT_SECRET, ENCRYPTION_KEY, and CLIENT_URL=http://${PUBLIC_IP}"
fi

# 3. Install dependencies
echo "==> Installing dependencies..."
npm install

# 4. Generate Prisma Client & Sync DB schema
echo "==> Updating database schema..."
npm run db:generate
npm run db:push

# 5. Seed initial data if fresh database
if [ ! -f prisma/dev.db ]; then
    echo "==> Fresh database detected. Seeding initial accounts & items..."
    npm run db:seed
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
