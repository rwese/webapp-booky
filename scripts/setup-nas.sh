#!/bin/bash

# NAS Initial Setup Script for Book Collection Webapp
# Run this script once on your NAS to prepare for deployment

set -e

echo "=========================================="
echo "NAS Setup for webapp-booky"
echo "=========================================="

# Configuration
WEB_ROOT="/var/services/web"
APP_DIR="$WEB_ROOT/booky"
BACKUP_DIR="/volume1/webapps/backups/booky"
LOG_DIR="/var/log/webapps"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Step 1: Creating directory structure...${NC}"
mkdir -p "$APP_DIR"
mkdir -p "$BACKUP_DIR"
mkdir -p "$LOG_DIR"

echo -e "${YELLOW}Step 2: Setting permissions...${NC}"
chmod 755 "$APP_DIR"
chmod 755 "$BACKUP_DIR"
chmod 755 "$LOG_DIR"

echo -e "${YELLOW}Step 3: Checking Node.js installation...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}Node.js not found. Installing via Package Center...${NC}"
    echo "Please install Node.js from Synology Package Center (version 18+ recommended)"
    echo "After installation, re-run this script"
    exit 0
fi

echo -e "Node.js version: $(node --version)"
echo -e "npm version: $(npm --version)"

echo -e "${YELLOW}Step 4: Configuring web server...${NC}"

# Create nginx configuration if nginx is available
if command -v nginx &> /dev/null; then
    cat > /etc/nginx/sites-available/booky << 'EOF'
server {
    listen 80;
    server_name _;
    root /var/services/web/booky;
    index index.html;

    # Enable gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    # PWA configuration
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA routing - serve index.html for all routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
}
EOF

    ln -sf /etc/nginx/sites-available/booky /etc/nginx/sites-enabled/booky
    nginx -t && systemctl reload nginx
    echo "Nginx configured successfully"
else
    echo "Nginx not found - using default web station configuration"
fi

echo -e "${YELLOW}Step 5: Creating deployment script...${NC}"

# Copy deployment script to NAS
cp "$(dirname "$0")/deploy-nas.sh" "$APP_DIR/deploy.sh"
chmod +x "$APP_DIR/deploy.sh"

echo -e "${YELLOW}Step 6: Creating .env file template...${NC}"

cat > "$APP_DIR/.env.example" << 'EOF'
# Environment configuration for NAS deployment
# Copy this to .env and customize

# App Configuration
VITE_APP_NAME=Book Collection
VITE_APP_VERSION=1.0.0

# API Configuration
VITE_OPEN_LIBRARY_API=https://openlibrary.org
VITE_GOOGLE_BOOKS_API=https://www.googleapis.com/books/v1

# Optional Backend (if using cloud sync)
# VITE_API_URL=http://your-server:3000

# PWA Configuration
VITE_PWA_NAME=Book Collection
VITE_PWA_DESCRIPTION=Organize your personal book collection
VITE_PWA_THEME_COLOR=#3b82f6
VITE_PWA_BACKGROUND_COLOR=#ffffff
EOF

cp "$APP_DIR/.env.example" "$APP_DIR/.env"

echo -e "${YELLOW}Step 7: Creating systemd service for auto-updates...${NC}"

cat > /etc/systemd/system/webapp-booky.service << 'EOF'
[Unit]
Description=Book Collection Webapp Deployment Updater
After=network.target

[Service]
Type=oneshot
ExecStart=/var/services/web/booky/deploy.sh update
User=root
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

echo -e "${YELLOW}Step 8: Setting up cron job for daily updates...${NC}"

# Add cron job for daily updates at 3 AM
(crontab -l 2>/dev/null | grep -v "deploy-nas.sh"; echo "0 3 * * * /var/services/web/booky/deploy.sh update >> /var/log/webapps/cron.log 2>&1") | crontab -

echo -e "${GREEN}==========================================${NC}"
echo -e "${GREEN}Setup completed successfully!${NC}"
echo -e "${GREEN}=========================================="
echo ""
echo "Next steps:"
echo "1. Deploy the app: sudo $APP_DIR/deploy.sh deploy"
echo "2. Access at: http://<your-nas-ip>/booky"
echo "3. For updates: sudo $APP_DIR/deploy.sh update"
echo "4. To rollback: sudo $APP_DIR/deploy.sh rollback"
echo ""
echo "To enable auto-updates:"
echo "  sudo systemctl enable webapp-booky"
echo "  sudo systemctl start webapp-booky"
