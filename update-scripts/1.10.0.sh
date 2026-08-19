#!/bin/bash
set -e

# Install rest-server binary
ARCH=$(uname -m)
case "$ARCH" in
    x86_64)  RS_ARCH="amd64" ;;
    aarch64) RS_ARCH="arm64" ;;
    armv7l)  RS_ARCH="armv7" ;;
    *) echo "Unsupported architecture: $ARCH"; exit 1 ;;
esac

REST_SERVER_VERSION="0.14.0"
TEMP_DIR="/tmp/rest-server-install"
mkdir -p "$TEMP_DIR"

echo "Downloading rest-server v${REST_SERVER_VERSION} for ${RS_ARCH}..."
curl -fsSL -o "$TEMP_DIR/rest-server.tar.gz" \
    "https://github.com/restic/rest-server/releases/download/v${REST_SERVER_VERSION}/rest-server_${REST_SERVER_VERSION}_linux_${RS_ARCH}.tar.gz"

tar -xzf "$TEMP_DIR/rest-server.tar.gz" -C "$TEMP_DIR"
sudo cp "$TEMP_DIR/rest-server_${REST_SERVER_VERSION}_linux_${RS_ARCH}/rest-server" /usr/local/bin/rest-server
sudo chmod +x /usr/local/bin/rest-server
rm -rf "$TEMP_DIR"

echo "rest-server installed to /usr/local/bin/rest-server"

# Create backup directory and env file
sudo mkdir -p /var/novanas/storage/backups
sudo chown novanas:novanas /var/novanas/storage/backups
echo "BACKUP_PATH=/var/novanas/storage/backups" | sudo tee /var/novanas/backup-server.env > /dev/null

# Create empty htpasswd file
sudo touch /var/novanas/backup.htpasswd
sudo chown novanas:novanas /var/novanas/backup.htpasswd

# Install systemd files
sudo cp system-files/services/novanas-backup-server.service /etc/systemd/system/

# Install Apache config
sudo cp system-files/apache/novanas-backup-server.conf /etc/apache2/conf-available/
sudo a2enmod auth_basic authn_file proxy proxy_http headers

# Reload
sudo systemctl daemon-reload
sudo systemctl restart apache2

# Do NOT enable novanas-backup-server yet (no API keys)
echo "Backup server installed. Service will start when the first API key is created."
