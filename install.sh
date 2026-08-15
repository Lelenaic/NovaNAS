#!/bin/bash

# NovaNAS Installation Script for Debian 13
# This script installs NovaNAS on a fresh Debian 13 system
# Run as root

set -e  # Exit on any error

export PATH="/usr/sbin:/sbin:$PATH"

# ══════════════════════════════════════════════════════════════════════════════
# Colors & Symbols
# ══════════════════════════════════════════════════════════════════════════════

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
DIM='\033[2m'
BOLD='\033[1m'
NC='\033[0m'

CHECK="${GREEN}✓${NC}"
CROSS="${RED}✗${NC}"
WARN="${YELLOW}⚠${NC}"
INFO="${CYAN}ℹ${NC}"
ARROW="${BLUE}→${NC}"
BULLET="${DIM}•${NC}"

# ══════════════════════════════════════════════════════════════════════════════
# Helper Functions
# ══════════════════════════════════════════════════════════════════════════════

print_banner() {
    echo ""
    echo -e "${CYAN}${BOLD}"
    cat << 'BANNER'
░███    ░██                                  ░███    ░██    ░███      ░██████
░████   ░██                                  ░████   ░██   ░██░██    ░██   ░██
░██░██  ░██  ░███████  ░██    ░██  ░██████   ░██░██  ░██  ░██  ░██  ░██
░██ ░██ ░██ ░██    ░██ ░██    ░██       ░██  ░██ ░██ ░██ ░█████████  ░████████
░██  ░██░██ ░██    ░██  ░██  ░██   ░███████  ░██  ░██░██ ░██    ░██         ░██
░██   ░████ ░██    ░██   ░██░██   ░██   ░██  ░██   ░████ ░██    ░██  ░██   ░██
░██    ░███  ░███████     ░███     ░█████░██ ░██    ░███ ░██    ░██   ░██████

BANNER
    echo -e "${NC}"
    echo -e "${DIM}────────────────────────────────────────────────────────${NC}"
    echo ""
}

print_step() {
    local step_num=$1
    local step_name=$2
    echo ""
    echo -e "${BOLD}${BLUE}╔════════════════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}${BLUE}║${NC}  ${BOLD}${WHITE}Step ${step_num}: ${step_name}${NC}"
    echo -e "${BOLD}${BLUE}╚════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_info() {
    echo -e "  ${BULLET} ${DIM}$1${NC}"
}

print_success() {
    echo -e "  ${CHECK} ${GREEN}$1${NC}"
}

print_warning() {
    echo -e "  ${WARN} ${YELLOW}$1${NC}"
}

print_error() {
    echo -e "  ${CROSS} ${RED}$1${NC}"
}

print_header() {
    echo -e "  ${CYAN}${BOLD}$1${NC}"
}

print_separator() {
    echo -e "${DIM}────────────────────────────────────────────────────────${NC}"
}

confirm_proceed() {
    local msg=$1
    echo ""
    echo -e "  ${WARN} ${YELLOW}${BOLD}${msg}${NC}"
    read -p "  Continue anyway? [Y/n]: " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Nn]$ ]]; then
        echo ""
        echo -e "  ${CROSS} ${RED}Installation cancelled by user.${NC}"
        exit 1
    fi
    echo ""
}

# ══════════════════════════════════════════════════════════════════════════════
# Banner
# ══════════════════════════════════════════════════════════════════════════════

print_banner

# ══════════════════════════════════════════════════════════════════════════════
# Pre-Checks
# ══════════════════════════════════════════════════════════════════════════════

print_header "Running pre-installation checks..."
echo ""

# Check 1: Root
if [ "$EUID" -ne 0 ]; then
    print_error "This script must be run as root."
    exit 1
fi
print_success "Running as root"

# Check 2: Required ports
PORTS_IN_USE=()
for port in 80 443 22; do
    if ss -tlnp | grep -q ":${port} "; then
        PORTS_IN_USE+=("$port")
    fi
done

if [ ${#PORTS_IN_USE[@]} -gt 0 ]; then
    print_warning "Ports in use: ${PORTS_IN_USE[*]}"
    for port in "${PORTS_IN_USE[@]}"; do
        process=$(ss -tlnp | grep ":${port} " | awk '{print $6}' | head -1)
        print_info "Port ${port} → ${process}"
    done
    confirm_proceed "Some required ports are already in use."
else
    print_success "Ports 80, 443, 22 are available"
fi

# Check 3: Existing installation
if [ -f /var/novanas/.env ]; then
    print_warning "Existing NovaNAS installation detected at /var/novanas"
    if [ -d /var/novanas/vendor ]; then
        print_info "This appears to be a complete installation."
    else
        print_info "This appears to be an incomplete installation (no vendor directory)."
    fi
    confirm_proceed "An existing NovaNAS installation was found."
else
    print_success "No existing installation found"
fi

print_separator
echo ""

# ══════════════════════════════════════════════════════════════════════════════
# Step 1: Install System Dependencies
# ══════════════════════════════════════════════════════════════════════════════

print_step 1 "Install System Dependencies"
print_info "Adding backports repository..."

# Add backports repository if not exists
if [ ! -f /etc/apt/sources.list.d/backports.list ]; then
    echo "deb http://deb.debian.org/debian trixie-backports main contrib non-free non-free-firmware" | tee /etc/apt/sources.list.d/backports.list
    print_success "Backports repository added"
else
    print_success "Backports repository already present"
fi

# Update package lists
print_info "Updating package lists..."
apt update

# Install packages
print_info "Installing system packages..."
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
    unzip \
    cron \
    btop
print_success "System packages installed"

# Enable ZFS services
print_info "Enabling ZFS services..."
systemctl enable zfs-import-cache zfs-import-scan zfs-mount zfs.target cron --now
print_success "ZFS services enabled"

# Install Docker if not installed
if ! command -v docker &> /dev/null; then
    print_info "Installing Docker..."
    curl https://get.docker.com | bash
    print_success "Docker installed"
else
    print_success "Docker already installed"
fi
usermod -aG docker novanas

# Install ttyd (terminal sharing over web)
if ! command -v ttyd &> /dev/null; then
    print_info "Installing ttyd..."
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
        *)       print_error "Unsupported architecture: $ARCH"; exit 1 ;;
    esac

    curl -fsSL -o /usr/local/bin/ttyd "https://github.com/tsl0922/ttyd/releases/download/${TTYD_VERSION}/ttyd.${TTYD_ARCH}"
    chmod +x /usr/local/bin/ttyd
    print_success "ttyd ${TTYD_VERSION} installed"
else
    print_success "ttyd already installed"
fi

# Add PHP repository if not exists
if [ ! -f /etc/apt/sources.list.d/php.list ]; then
    print_info "Installing PHP 8.5..."
    curl -sSLo /tmp/debsuryorg-archive-keyring.deb https://packages.sury.org/debsuryorg-archive-keyring.deb
    dpkg -i /tmp/debsuryorg-archive-keyring.deb
    tee /etc/apt/sources.list.d/php.list > /dev/null <<EOF
deb [signed-by=/usr/share/keyrings/debsuryorg-archive-keyring.gpg] https://packages.sury.org/php/ $(lsb_release -cs) main
EOF
    print_success "PHP repository added"
else
    print_success "PHP repository already present"
fi

# Update and install PHP
print_info "Updating package lists..."
apt update
print_info "Installing PHP and Apache..."
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
print_success "PHP 8.5 and Apache installed"

# Configure Apache
print_info "Enabling Apache modules..."
a2enmod rewrite proxy headers proxy_http proxy_wstunnel
print_success "Apache modules enabled"

print_success "System dependencies installed"

# ══════════════════════════════════════════════════════════════════════════════
# Step 2: Create novanas User
# ══════════════════════════════════════════════════════════════════════════════

print_step 2 "Create novanas User"

if ! id novanas &>/dev/null; then
    print_info "Creating novanas user..."
    useradd -m -d /var/novanas -s /bin/bash novanas
    echo "novanas  ALL=(ALL:ALL) NOPASSWD:ALL" >> /etc/sudoers
    print_success "User created: novanas (home: /var/novanas, sudo: enabled)"
else
    print_success "User novanas already exists"
fi

# Set Apache user and group to novanas
print_info "Configuring Apache to run as novanas..."
sed -i 's/export APACHE_RUN_USER=.*/export APACHE_RUN_USER=novanas/' /etc/apache2/envvars
sed -i 's/export APACHE_RUN_GROUP=.*/export APACHE_RUN_GROUP=novanas/' /etc/apache2/envvars

systemctl restart apache2
print_success "Apache user configured"

# ══════════════════════════════════════════════════════════════════════════════
# Step 3: Install NovaNAS Application
# ══════════════════════════════════════════════════════════════════════════════

print_step 3 "Install NovaNAS Application"

if [ ! -f /var/novanas/.env ]; then
    print_info "Installing NovaNAS application..."

    # Define variables
    REPO="NovaNasOrg/NovaNAS"
    API_URL="https://api.github.com/repos/$REPO/releases/latest"
    DOWNLOAD_URL="https://github.com/$REPO/releases/download"
    ASSET_NAME="release.tgz"

    # Fetch latest release info
    print_info "Fetching latest release information..."
    RELEASE_JSON=$(curl -s "$API_URL")

    if [ $? -ne 0 ]; then
        print_error "Failed to fetch release info"
        exit 1
    fi

    LATEST_TAG=$(echo "$RELEASE_JSON" | jq -r '.tag_name')
    print_success "Latest version: ${LATEST_TAG}"

    # Download and extract
    TEMP_DIR="/tmp/novanas_install"
    mkdir -p "$TEMP_DIR"

    ASSET_URL="$DOWNLOAD_URL/$LATEST_TAG/$ASSET_NAME"
    print_info "Downloading ${ASSET_URL}..."
    curl -L -o "$TEMP_DIR/$ASSET_NAME" "$ASSET_URL"

    if [ $? -ne 0 ]; then
        print_error "Failed to download release"
        rm -rf "$TEMP_DIR"
        exit 1
    fi
    print_success "Download complete"

    print_info "Extracting..."
    mkdir -p "$TEMP_DIR/extract"
    tar -xzf "$TEMP_DIR/$ASSET_NAME" -C "$TEMP_DIR/extract"

    if [ $? -ne 0 ]; then
        print_error "Failed to extract release"
        rm -rf "$TEMP_DIR"
        exit 1
    fi
    print_success "Extraction complete"

    # Install to user home
    print_info "Installing to /var/novanas..."
    cp -r "$TEMP_DIR/extract"/{.,}* /var/novanas/

    # Copy environment file
    cd /var/novanas
    cp .env.prod .env
    php artisan key:generate
    print_success "Application files installed"

    print_info "Running database migrations..."
    php artisan migrate --force
    print_success "Database migrations complete"

    # Seed update lock file so update scripts don't run on fresh install
    print_info "Seeding update lock file..."
    LOCK_FILE="update-scripts/.update_lock"
    touch "$LOCK_FILE"
    for script in update-scripts/*.sh; do
        [ -f "$script" ] || continue
        basename "$script" >> "$LOCK_FILE"
    done
    print_success "Update lock file seeded"

    # Set ownership
    chown -R novanas:novanas .
    chmod 770 database/database.sqlite .env

    # Make update script executable
    chmod +x update.sh

    # Clean up
    rm -rf "$TEMP_DIR"

    print_success "NovaNAS application installed"
else
    print_success "NovaNAS application already installed"
fi

# ══════════════════════════════════════════════════════════════════════════════
# Step 4: Configure Systemd Services
# ══════════════════════════════════════════════════════════════════════════════

print_step 4 "Configure Systemd Services"

print_info "Installing systemd services..."
cp system-files/services/* /etc/systemd/system/
systemctl daemon-reload
for service in /etc/systemd/system/novanas-*.service; do
    if [[ "$service" != "/etc/systemd/system/novanas-update.service" ]]; then
        systemctl enable --now "$(basename "$service" .service)"
    fi
done
print_success "Systemd services installed and enabled"

# ══════════════════════════════════════════════════════════════════════════════
# Step 5: Configure Crontab
# ══════════════════════════════════════════════════════════════════════════════

print_step 5 "Configure Crontab"

print_info "Installing Laravel crontab..."
(crontab -u novanas -l 2>/dev/null || true; echo "* * * * * cd /var/novanas && php artisan schedule:run >> /var/novanas/storage/logs/cron.log 2>> /var/novanas/storage/logs/cron_error.log") | crontab -u novanas -
print_success "Laravel crontab installed for novanas user"

# ══════════════════════════════════════════════════════════════════════════════
# Step 6: Configure Apache
# ══════════════════════════════════════════════════════════════════════════════

print_step 6 "Configure Apache"

print_info "Creating Apache virtual host configuration..."

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
print_info "Reloading Apache..."
systemctl reload apache2
print_success "Apache configured and reloaded"

# Download acme.sh
print_info "Installing acme.sh for SSL certificates..."
curl -fsSL https://get.acme.sh | bash
/root/.acme.sh/acme.sh --upgrade --auto-upgrade --force
print_success "acme.sh installed"

# ══════════════════════════════════════════════════════════════════════════════
# Step 7: Finalize
# ══════════════════════════════════════════════════════════════════════════════

print_step 7 "Finalize Installation"

SERVER_IP=$(hostname -I | awk '{print $1}')

echo ""
echo -e "  ${GREEN}${BOLD}╔════════════════════════════════════════════════════╗${NC}"
echo -e "  ${GREEN}${BOLD}║${NC}  ${GREEN}${BOLD}NovaNAS installed successfully!${NC}"
echo -e "  ${GREEN}${BOLD}╚════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BULLET} ${WHITE}URL:${NC}   http://${SERVER_IP}/"
echo -e "  ${BULLET} ${WHITE}User:${NC}  novanas"
echo -e "  ${BULLET} ${WHITE}Home:${NC}  /var/novanas"
echo ""
print_separator
echo ""
echo -e "  ${DIM}Run ${WHITE}btop${DIM} to monitor system resources${NC}"
echo -e "  ${DIM}Run ${WHITE}novanas-update${DIM} to update NovaNAS${NC}"
echo ""
