#!/usr/bin/env bash
set -euo pipefail

echo "=========================================="
echo " Deploying Hill Trade Ledger...           "
echo "=========================================="

# Pull latest changes if running from a git repository
if [ -d .git ]; then
    echo "==> Fetching git updates..."
    git pull origin main
fi

# Install dependencies
echo "==> Installing dependencies..."
npm install

# Generate Prisma Client & Sync DB schema
echo "==> Updating database schema..."
npm run db:generate
npm run db:push

# Build server and client
echo "==> Building application..."
npm run build

# Start or reload PM2 process
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
