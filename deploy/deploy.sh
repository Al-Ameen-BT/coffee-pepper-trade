#!/usr/bin/env bash
set -euo pipefail

# Always navigate to the repository root directory regardless of where the script is called from
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${ROOT_DIR}"

echo "=========================================="
echo " Deploying Uzhunnungal Traders (MySQL)      "
echo " Working directory: ${ROOT_DIR}           "
echo "=========================================="

SUDO_CMD=""
if [ "$EUID" -ne 0 ] && command -v sudo &>/dev/null; then
    SUDO_CMD="sudo"
fi

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
    git config --global --add safe.directory "${ROOT_DIR}" 2>/dev/null || true
    git pull origin main || echo "==> Note: git pull had warnings or local changes, continuing..."
fi

# 2. Provision / Verify Node.js and npm Installation
echo "==> Verifying Node.js and npm installation..."
NODE_MIN_VERSION=20
NEED_NODE_INSTALL=false

if ! command -v node &>/dev/null; then
    echo "==> Node.js is not installed."
    NEED_NODE_INSTALL=true
elif ! command -v npm &>/dev/null; then
    echo "==> npm is not installed."
    NEED_NODE_INSTALL=true
else
    NODE_VERSION_STR=$(node -v | sed 's/v//')
    NODE_MAJOR=$(echo "${NODE_VERSION_STR}" | cut -d. -f1)
    if [ "${NODE_MAJOR}" -lt "${NODE_MIN_VERSION}" ]; then
        echo "==> Node.js version v${NODE_VERSION_STR} is lower than required v${NODE_MIN_VERSION}."
        NEED_NODE_INSTALL=true
    fi
fi

if [ "${NEED_NODE_INSTALL}" = true ]; then
    echo "==> Installing / Updating Node.js ${NODE_MIN_VERSION}.x and npm from NodeSource..."
    $SUDO_CMD apt-get update
    $SUDO_CMD apt-get install -y ca-certificates curl gnupg build-essential
    if [ -n "${SUDO_CMD}" ]; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    else
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    fi
    $SUDO_CMD apt-get install -y nodejs
fi

# Explicitly verify node and npm binaries and versions
if ! command -v node &>/dev/null || ! command -v npm &>/dev/null; then
    echo "ERROR: Failed to verify Node.js and npm installation. Please ensure both are in PATH." >&2
    exit 1
fi
echo "==> Verified Node.js: $(node -v)"
echo "==> Verified npm:     v$(npm -v)"

# Ensure PM2 is installed globally
if ! command -v pm2 &>/dev/null; then
    echo "==> Installing PM2 process manager globally..."
    $SUDO_CMD npm install -g pm2
fi
echo "==> Verified PM2:     v$(pm2 -v)"

# 3. Provision / Verify MySQL Service and Database
echo "==> Verifying MySQL installation..."
if ! command -v mysql &>/dev/null; then
    echo "==> Installing MySQL server..."
    $SUDO_CMD apt-get update && $SUDO_CMD apt-get install -y mysql-server
fi

# Ensure MySQL service is running
if command -v systemctl &>/dev/null; then
    $SUDO_CMD systemctl is-active --quiet mysql || $SUDO_CMD systemctl start mysql || true
else
    service mysql status &>/dev/null || $SUDO_CMD service mysql start || true
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

# 4. Ensure .env exists and is configured for MySQL
MYSQL_URL="mysql://${DB_USER}:${DB_PASS}@127.0.0.1:3306/${DB_NAME}"

# Try fetching EC2 public IP from AWS metadata or external IP service
PUBLIC_IP=$(curl -s --connect-timeout 2 http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || curl -s --connect-timeout 2 ifconfig.me 2>/dev/null || echo "localhost")

if [ ! -f "${ROOT_DIR}/.env" ]; then
    echo "==> .env not found. Generating production configuration with MySQL..."
    JWT_SECRET=$(openssl rand -hex 32)
    ENCRYPTION_KEY=$(openssl rand -hex 16)
    
    cat <<EOF > "${ROOT_DIR}/.env"
DB_PROVIDER="mysql"
DATABASE_URL="${MYSQL_URL}"
PORT=3000
NODE_ENV=production
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=7d
ENCRYPTION_KEY=${ENCRYPTION_KEY}
FORCE_HTTPS=true
CLIENT_URL=https://${PUBLIC_IP}:3424
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

# 5. Install dependencies (force install devDependencies for build tools like typescript and vite)
echo "==> Installing dependencies (including build tools & type definitions)..."
NODE_ENV=development npm install --include=dev --legacy-peer-deps

# 6. Generate Prisma Client & Sync DB schema with MySQL
echo "==> Configuring Prisma schema for MySQL..."
if [ -f "${ROOT_DIR}/prisma/schema.mysql.prisma" ]; then
    cp "${ROOT_DIR}/prisma/schema.mysql.prisma" "${ROOT_DIR}/prisma/schema.prisma"
else
    sed -i -E 's/provider\s*=\s*"sqlite"/provider = "mysql"/' "${ROOT_DIR}/prisma/schema.prisma"
fi

echo "==> Updating database schema (MySQL)..."
npm run db:generate
npm run db:push

# 7. Seed initial data if database is empty
USER_COUNT=$(npx tsx -e "import { PrismaClient } from '@prisma/client'; const p = new PrismaClient(); p.user.count().then(c => { console.log(c); p.\$disconnect(); }).catch(() => { console.log(0); p.\$disconnect(); });" 2>/dev/null || echo "0")
if [ "${USER_COUNT}" = "0" ]; then
    echo "==> Empty database detected (0 users). Seeding initial accounts & items into MySQL..."
    npm run db:seed
else
    echo "==> Existing data detected (${USER_COUNT} users found). Preserving data."
fi

# 8. Build server and client
echo "==> Building application..."
npm run build

# 9. Start or reload PM2 process
echo "==> Starting / Reloading PM2..."
if pm2 list | grep -q "uzhunnungal-traders"; then
    pm2 restart ecosystem.config.cjs --update-env
else
    pm2 start ecosystem.config.cjs
fi
pm2 save

# 10. Provision self-signed upstream TLS and Nginx configuration
echo "==> Configuring SSL Certificates and Nginx..."

# Ensure Nginx is installed
if ! command -v nginx &>/dev/null; then
    echo "==> Installing Nginx..."
    $SUDO_CMD apt-get update && $SUDO_CMD apt-get install -y nginx
fi

# Ensure SSL directories exist
$SUDO_CMD mkdir -p /etc/ssl/certs /etc/ssl/private
$SUDO_CMD chmod 700 /etc/ssl/private

SSL_CERT_PATH="/etc/ssl/certs/uzhunnungal-traders.crt"
SSL_KEY_PATH="/etc/ssl/private/uzhunnungal-traders.key"
if [ -e "${SSL_CERT_PATH}" ] || [ -e "${SSL_KEY_PATH}" ]; then
    if [ ! -f "${SSL_CERT_PATH}" ] || [ ! -f "${SSL_KEY_PATH}" ] || ! $SUDO_CMD openssl x509 -in "${SSL_CERT_PATH}" -checkend 0 -noout >/dev/null 2>&1 || ! $SUDO_CMD openssl x509 -in "${SSL_CERT_PATH}" -checkip 127.0.0.1 -noout >/dev/null 2>&1; then
        echo "ERROR: Existing TLS certificate/key is incomplete, expired, or lacks a 127.0.0.1 IP SAN. Repair it manually; deployment will not replace it." >&2
        exit 1
    fi
    echo "==> Reusing existing TLS certificate at ${SSL_CERT_PATH}."
else
    CERT_CN=localhost
    CERT_SAN="DNS:localhost,IP:127.0.0.1"
    if [[ "${PUBLIC_IP}" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        CERT_CN="${PUBLIC_IP}"
        CERT_SAN+=",IP:${PUBLIC_IP}"
    fi
    echo "==> Generating self-signed TLS certificate for local HTTPS..."
    $SUDO_CMD openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "${SSL_KEY_PATH}" \
        -out "${SSL_CERT_PATH}" \
        -subj "/CN=${CERT_CN}" \
        -addext "subjectAltName=${CERT_SAN}"
    $SUDO_CMD chmod 600 "${SSL_KEY_PATH}"
    $SUDO_CMD chmod 644 "${SSL_CERT_PATH}"
fi

# Deploy Nginx site configuration
echo "==> Deploying Nginx configuration..."
$SUDO_CMD cp "${SCRIPT_DIR}/nginx.conf" /etc/nginx/sites-available/uzhunnungal-traders.conf
$SUDO_CMD ln -sf /etc/nginx/sites-available/uzhunnungal-traders.conf /etc/nginx/sites-enabled/uzhunnungal-traders.conf
$SUDO_CMD rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration before restarting
echo "==> Verifying Nginx configuration syntax..."
$SUDO_CMD nginx -t

# Reload or restart Nginx
if command -v systemctl &>/dev/null; then
    $SUDO_CMD systemctl enable nginx
    $SUDO_CMD systemctl reload nginx || $SUDO_CMD systemctl restart nginx
else
    $SUDO_CMD service nginx reload || $SUDO_CMD service nginx restart
fi

# Fail closed if another service still owns HTTP or local HTTPS is unavailable.
if ! command -v ss &>/dev/null; then
    echo "ERROR: ss is required to verify that port 80 is closed." >&2
    exit 1
fi
PORT80_LISTENERS=$($SUDO_CMD ss -H -ltn '( sport = :80 )')
if [ -n "${PORT80_LISTENERS}" ]; then
    echo "ERROR: Port 80 is still listening. Disable the remaining service before exposing the app." >&2
    exit 1
fi
if ! curl --fail --silent --show-error --max-time 10 --cacert "${SSL_CERT_PATH}" -o /dev/null https://127.0.0.1:3424/api/health; then
    echo "ERROR: Local HTTPS health check failed on port 3424." >&2
    exit 1
fi
echo "==> Nginx HTTPS on port 3424 verified; port 80 is closed."

echo "=========================================="
echo " Deployment completed successfully!       "
echo " Database: MySQL (${DB_NAME})             "
echo " App (HTTPS): https://${PUBLIC_IP}:3424   "
echo " Status:      pm2 status                  "
echo " Logs:        pm2 logs uzhunnungal-traders"
echo "=========================================="
