#!/usr/bin/env bash
# EC2 Free Tier (t2.micro / t3.micro) Provisioning Script
# Designed for Ubuntu 22.04 / 24.04 LTS

set -euo pipefail

echo "=========================================="
echo " Starting EC2 Provisioning for Hill Trade "
echo "=========================================="

# 1. Setup 2GB Swap (CRITICAL for 1GB RAM instances to prevent OOM)
if [ ! -f /swapfile ]; then
    echo "[1/5] Setting up 2GB swap space..."
    sudo fallocate -l 2G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    # Set swappiness to 20 for optimal performance
    sudo sysctl vm.swappiness=20
    echo 'vm.swappiness=20' | sudo tee -a /etc/sysctl.conf
    echo "Swap created successfully."
else
    echo "[1/5] Swap file already exists, skipping."
fi

# 2. Update System Packages
echo "[2/5] Updating system packages..."
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential nginx certbot python3-certbot-nginx

# 3. Install Node.js 20 LTS
echo "[3/5] Installing Node.js 20 LTS..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
else
    echo "Node.js already installed: $(node -v)"
fi

# 4. Install PM2 process manager
echo "[4/5] Installing PM2..."
sudo npm install -g pm2

# 5. Enable and start Nginx
echo "[5/5] Enabling Nginx..."
sudo systemctl enable nginx
sudo systemctl start nginx

echo "=========================================="
echo " EC2 Provisioning Complete!               "
echo " Node.js: $(node -v)                      "
echo " NPM:     $(npm -v)                       "
echo " PM2:     $(pm2 -v)                       "
echo " Nginx:   $(nginx -v 2>&1)                "
echo " Free Memory & Swap:                      "
free -h
echo "=========================================="
