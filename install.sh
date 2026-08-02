#!/bin/bash

# NovaNAS Installation Script for Debian 13
# This script installs NovaNAS on a fresh Debian 13 system
# Run as root

set -e  # Exit on any error

export PATH="/usr/sbin:/sbin:$PATH"

echo "Starting NovaNAS installation..."

# Step 1: Install system dependencies
echo "Installing system dependencies..."

# Add backports repository if not exists
if [ ! -f /etc/apt/sources.list.d/backports.list ]; then
    echo "deb http://deb.debian.org/debian trixie-backports main contrib non-free non-free-firmware" | tee /etc/apt/sources.list.d/backports.list
fi

# Update package lists
apt update

# Install packages
apt install -y \
    linux-headers-generic \
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
    sudo \
    zip \
    unzip

# Enable ZFS services
systemctl enable zfs-import-cache zfs-import-scan zfs-mount zfs.target

# Install Docker if not installed
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    curl https://get.docker.com | bash
else
    echo "Docker already installed."
fi

# Install ttyd (terminal sharing over web)
if ! command -v ttyd &> /dev/null; then
    echo "Installing ttyd..."
    TTYD_VERSION="1.7.7"
    ARCH=$(uname -m)

    case "$ARCH" in
        x86_64)  TTYD_ARCH="x86_64" ;;
        aarch64) TTYD_ARCH="aarch64" ;;
        armv7l)  TTYD_ARCH="armhf" ;;
        armv6l)  TTYD_ARCH="arm" ;;
        i686)    TTYD_ARCH="i686" ;;
        mips)    TTYD_ARCH="mips" ;;
        mips64)  TTYD_ARCH="mips64" ;;
        mips64el) TTYD_ARCH="mips64el" ;;
        mipsel)  TTYD_ARCH="mipsel" ;;
        s390x)   TTYD_ARCH="s390x" ;;
        *)       echo "Unsupported architecture: $ARCH"; exit 1 ;;
    esac

    curl -fsSL -o /usr/local/bin/ttyd "https://github.com/tsl0922/ttyd/releases/download/${TTYD_VERSION}/ttyd.${TTYD_ARCH}"
    chmod +x /usr/local/bin/ttyd
    echo "ttyd ${TTYD_VERSION} installed."
else
    echo "ttyd already installed."
fi

# Add PHP repository if not exists
if [ ! -f /etc/apt/sources.list.d/php.list ]; then
    echo "Installing PHP 8.5..."
    curl -sSLo /tmp/debsuryorg-archive-keyring.deb https://packages.sury.org/debsuryorg-archive-keyring.deb
    dpkg -i /tmp/debsuryorg-archive-keyring.deb
    tee /etc/apt/sources.list.d/php.list > /dev/null <<EOF
deb [signed-by=/usr/share/keyrings/debsuryorg-archive-keyring.gpg] https://packages.sury.org/php/ $(lsb_release -cs) main
EOF
fi

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

echo "System dependencies installed successfully."

# Step 2: Create novanas user
if ! id novanas &>/dev/null; then
    echo "Creating novanas user..."
    useradd -m -d /var/novanas -s /bin/bash novanas
    echo "novanas  ALL=NOPASSWD:ALL" >> /etc/sudoers
    echo "User created: novanas with home /var/novanas and sudo privileges"
else
    echo "User novanas already exists."
fi

# Set Apache user and group to novanas
sed -i 's/export APACHE_RUN_USER=.*/export APACHE_RUN_USER=novanas/' /etc/apache2/envvars
sed -i 's/export APACHE_RUN_GROUP=.*/export APACHE_RUN_GROUP=novanas/' /etc/apache2/envvars

systemctl restart apache2

# Step 3: Install NovaNAS application
if [ ! -f /var/novanas/.env ]; then
    echo "Installing NovaNAS application..."

    # Define variables
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
    cp -r "$TEMP_DIR/extract"/{.,}* /var/novanas/

    # Copy environment file
    cd /var/novanas
    cp .env.prod .env
    php artisan key:generate

    echo "Running database migrations..."
    php artisan migrate --force

    # Seed update lock file so update scripts don't run on fresh install
    echo "Seeding update lock file..."
    LOCK_FILE="update-scripts/.update_lock"
    touch "$LOCK_FILE"
    for script in update-scripts/*.sh; do
        [ -f "$script" ] || continue
        basename "$script" >> "$LOCK_FILE"
    done

    # Set ownership
    chown -R novanas:novanas .
    chmod 770 database/database.sqlite .env

    # Make update script executable
    chmod +x update.sh

    # Clean up
    rm -rf "$TEMP_DIR"

    echo "NovaNAS application installed successfully."
else
    echo "NovaNAS application already installed."
fi

# Step 4: Install systemd service
echo "Installing systemd services..."
cp system-files/services/* /etc/systemd/system/
systemctl daemon-reload
for service in /etc/systemd/system/novanas-*.service; do
    if [[ "$service" != "/etc/systemd/system/novanas-update.service" ]]; then
        systemctl enable --now "$(basename "$service" .service)"
    fi
done
echo "Systemd services installed."

# Step 5: Configure Apache
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

# Download acme.sh
curl -fsSL https://get.acme.sh | bash
/root/.acme.sh/acme.sh --upgrade --auto-upgrade --force

echo "Apache configured and reloaded."

SERVER_IP=$(hostname -I | awk '{print $1}')
echo "NovaNAS installation completed successfully!"
echo "You can now access NovaNAS at http://$SERVER_IP/"
