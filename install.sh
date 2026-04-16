#!/bin/bash

# NovaNAS Installation Script for Debian 13
# This script installs NovaNAS on a fresh Debian 13 system
# Run as root

set -e  # Exit on any error

echo "Starting NovaNAS installation..."

# Step 1: Install system dependencies
echo "Installing system dependencies..."

# Add backports repository
echo "deb http://deb.debian.org/debian trixie-backports main contrib non-free non-free-firmware" | tee /etc/apt/sources.list.d/backports.list

# Update package lists
apt update

# Install packages
apt install -y \
    linux-headers-$(uname -r) \
    zfs-dkms \
    zfsutils-linux \
    ca-certificates \
    curl \
    lsb-release \
    gnupg \
    miniupnpc \
    ufw \
    smartmontools \
    samba \
    samba-common-bin \
    acl \
    tmux \
    net-tools \
    jq \
    rsync \
    sudo

# Enable ZFS services
systemctl enable zfs-import-cache zfs-import-scan zfs-mount zfs.target

# Install Docker
echo "Installing Docker..."
curl https://get.docker.com | bash

# Add PHP repository and install PHP 8.5
echo "Installing PHP 8.5..."
tee /etc/apt/sources.list.d/php.list > /dev/null <<EOF
deb [signed-by=/usr/share/keyrings/debsuryorg-archive-keyring.gpg] https://packages.sury.org/php/ $(lsb_release -cs) main
EOF

# Update and install PHP
apt update
apt install -y \
    apache2 \
    libapache2-mod-php8.5 \
    php8.5-cli \
    php8.5-common \
    php8.5-curl \
    php8.5-mbstring \
    php8.5-xml \
    php8.5-zip \
    php8.5-bcmath \
    php8.5-gd \
    php8.5-sqlite3 \
    php8.5-intl

# Configure Apache
a2enmod rewrite proxy headers proxy_http proxy_wstunnel
systemctl restart apache2

echo "System dependencies installed successfully."

# Step 2: Create novanas user
echo "Creating novanas user..."
useradd -m -d /var/novanas -s /bin/bash novanas
echo "novanas  ALL=NOPASSWD:ALL" >> /etc/sudoers
echo "User created: novanas with home /var/novanas and sudo privileges"

# Step 3: Install NovaNAS application
echo "Installing NovaNAS application..."

# Define variables (similar to update.sh)
REPO="NovaNasOrg/NovaNAS"
API_URL="https://api.github.com/repos/$REPO/releases/latest"
DOWNLOAD_URL="https://github.com/$REPO/releases/download"
ASSET_NAME="release.tgz"

# Fetch latest release info
echo "Fetching latest release information..."
RELEASE_JSON=$(curl -s "$API_URL")

if [ $? -ne 0 ]; then
    echo "Error: Failed to fetch release info"
    exit 1
fi

LATEST_TAG=$(echo "$RELEASE_JSON" | jq -r '.tag_name')
echo "Latest version: $LATEST_TAG"

# Download and extract
TEMP_DIR="/tmp/novanas_install"
mkdir -p "$TEMP_DIR"

ASSET_URL="$DOWNLOAD_URL/$LATEST_TAG/$ASSET_NAME"
echo "Downloading $ASSET_URL..."
curl -L -o "$TEMP_DIR/$ASSET_NAME" "$ASSET_URL"

if [ $? -ne 0 ]; then
    echo "Error: Failed to download release"
    rm -rf "$TEMP_DIR"
    exit 1
fi

echo "Extracting..."
mkdir -p "$TEMP_DIR/extract"
tar -xzf "$TEMP_DIR/$ASSET_NAME" -C "$TEMP_DIR/extract"

if [ $? -ne 0 ]; then
    echo "Error: Failed to extract release"
    rm -rf "$TEMP_DIR"
    exit 1
fi

# Install to user home
echo "Installing to /var/novanas..."
cp -r "$TEMP_DIR/extract"/* /var/novanas/

# Set ownership
chown -R novanas:novanas /var/novanas

# Copy environment file
cd /var/novanas
cp .env.prod .env

echo "Running database migrations..."
php artisan migrate --force

# Make update script executable
chmod +x update.sh

# Clean up
rm -rf "$TEMP_DIR"

echo "NovaNAS application installed successfully."

# Step 3.5: Install systemd service
echo "Installing novanas-update systemd service..."
cp system-files/novanas-update.service /etc/systemd/system/
systemctl daemon-reload

# Step 4: Configure Apache
echo "Configuring Apache..."

# Create new config
cat > /etc/apache2/sites-enabled/000-default.conf <<EOF
<VirtualHost *:80>
    DocumentRoot /var/novanas/public

    <Directory /var/novanas/public>
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>

    ErrorLog \${APACHE_LOG_DIR}/novanas_error.log
    CustomLog \${APACHE_LOG_DIR}/novanas_access.log combined
</VirtualHost>
EOF

# Reload Apache
systemctl reload apache2

echo "Apache configured and reloaded."

SERVER_IP=$(hostname -I | awk '{print $1}')
echo "NovaNAS installation completed successfully!"
echo "You can now access NovaNAS at http://$SERVER_IP/"
