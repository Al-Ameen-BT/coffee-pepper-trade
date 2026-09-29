#!/usr/bin/env bash
set -euo pipefail

# Always navigate to the repository root directory regardless of where the script is called from
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${ROOT_DIR}"

echo "=========================================="
echo " Deploying Hill Trade Ledger (MySQL)      "
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

# 2. Provision / Verify MySQL Service and Database
echo "==> Verifying MySQL installation..."
if ! command -v mysql &>/dev/null; then
    echo "==> Installing MySQL server..."
    if [ "$EUID" -ne 0 ] && command -v sudo &>/dev/null; then
        sudo apt-get update && sudo apt-get install -y mysql-server
    else
        apt-get update && apt-get install -y mysql-server
    fi
fi

# Ensure MySQL service is running
if command -v systemctl &>/dev/null; then
    systemctl is-active --quiet mysql || systemctl start mysql || true
else
    service mysql status &>/dev/null || service mysql start || true
fi

MYSQL_CMD="mysql"
if [ "$EUID" -ne 0 ] && command -v sudo &>/dev/null; then
    MYSQL_CMD="sudo mysql"
fi

DB_NAME="hilltrade"
DB_USER="hilltrade"

# Extract existing password if already configured in .env
EXISTING_PASS=""
if [ -f "${ROOT_DIR}/.env" ]; then
    EXISTING_PASS=$(grep -E '^DATABASE_URL=' "${ROOT_DIR}/.env" | sed -nE 's/.*mysql:\/\/[^:]+:([^@]+)@.*/\1/p' || true)
fi

if [ -n "${EXISTING_PASS}" ]; then
    DB_PASS="${EXISTING_PASS}"
else
    DB_PASS="ht_$(openssl rand -hex 12)"
fi

echo "==> Setting up MySQL database '${DB_NAME}' and user '${DB_USER}'..."
$MYSQL_CMD -e "CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
$MYSQL_CMD -e "CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';"
$MYSQL_CMD -e "ALTER USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';"
$MYSQL_CMD -e "GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';"
$MYSQL_CMD -e "FLUSH PRIVILEGES;"
echo "==> MySQL database and permissions configured."

# 3. Ensure .env exists and is configured for MySQL
MYSQL_URL="mysql://${DB_USER}:${DB_PASS}@127.0.0.1:3306/${DB_NAME}"

if [ ! -f "${ROOT_DIR}/.env" ]; then
    echo "==> .env not found. Generating production configuration with MySQL..."
    JWT_SECRET=$(openssl rand -hex 32)
    ENCRYPTION_KEY=$(openssl rand -hex 16)
    
    # Try fetching EC2 public IP from AWS metadata or external IP service
    PUBLIC_IP=$(curl -s --connect-timeout 2 http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || curl -s --connect-timeout 2 ifconfig.me 2>/dev/null || echo "localhost")
    
    cat <<EOF > "${ROOT_DIR}/.env"
DB_PROVIDER="mysql"
DATABASE_URL="${MYSQL_URL}"
PORT=3000
NODE_ENV=production
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=7d
ENCRYPTION_KEY=${ENCRYPTION_KEY}
CLIENT_URL=http://${PUBLIC_IP}
EOF
    echo "==> Created ${ROOT_DIR}/.env with MySQL configuration."
else
    # Update existing .env if it was pointing to SQLite or had an invalid URL
    if grep -q "sqlite" "${ROOT_DIR}/.env" || grep -q 'DATABASE_URL="file:' "${ROOT_DIR}/.env" || grep -q 'DATABASE_URL=file:' "${ROOT_DIR}/.env" || grep -q 'DATABASE_URL=.*dev\.db' "${ROOT_DIR}/.env"; then
        echo "==> Migrating existing .env from SQLite to MySQL..."
        sed -i -E 's|^DB_PROVIDER=.*|DB_PROVIDER="mysql"|' "${ROOT_DIR}/.env"
        sed -i -E "s|^DATABASE_URL=.*|DATABASE_URL=\"${MYSQL_URL}\"|" "${ROOT_DIR}/.env"
        echo "==> Updated ${ROOT_DIR}/.env to MySQL."
    elif ! grep -q '^DATABASE_URL=' "${ROOT_DIR}/.env"; then
        echo "DATABASE_URL=\"${MYSQL_URL}\"" >> "${ROOT_DIR}/.env"
    fi
fi

# Export all environment variables from .env to child processes (Prisma, Node, PM2)
if [ -f "${ROOT_DIR}/.env" ]; then
    set -a
    source "${ROOT_DIR}/.env"
    set +a
fi

# 4. Install dependencies (force install devDependencies for build tools like typescript and vite)
echo "==> Installing dependencies (including build tools & type definitions)..."
NODE_ENV=development npm install --include=dev

# 5. Generate Prisma Client & Sync DB schema with MySQL
echo "==> Updating database schema (MySQL)..."
npm run db:generate
npm run db:push

# 6. Seed initial data if database is empty
USER_COUNT=$(npx tsx -e "import { PrismaClient } from '@prisma/client'; const p = new PrismaClient(); p.user.count().then(c => { console.log(c); p.\$disconnect(); }).catch(() => { console.log(0); p.\$disconnect(); });" 2>/dev/null || echo "0")
if [ "${USER_COUNT}" = "0" ]; then
    echo "==> Empty database detected (0 users). Seeding initial accounts & items into MySQL..."
    npm run db:seed
else
    echo "==> Existing data detected (${USER_COUNT} users found). Preserving data."
fi

# 7. Build server and client
echo "==> Building application..."
npm run build

# 8. Start or reload PM2 process
echo "==> Reloading PM2..."
if pm2 list | grep -q "hill-trade-ledger"; then
    pm2 reload ecosystem.config.cjs --update-env
else
    pm2 start ecosystem.config.cjs
    pm2 save
fi

echo "=========================================="
echo " Deployment completed successfully!       "
echo " Database: MySQL (${DB_NAME})             "
echo " Status:   pm2 status                     "
echo " Logs:     pm2 logs hill-trade-ledger     "
echo "=========================================="
