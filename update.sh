#!/bin/bash

# Update script for NovaNAS
# Fetches latest release from GitHub if newer than current version

php artisan down

REPO="NovaNasOrg/NovaNAS"
API_URL="https://api.github.com/repos/$REPO/releases/latest"
DOWNLOAD_URL="https://github.com/$REPO/releases/download"

# Check for force flag
FORCE=false
if [ "$1" = "--force" ]; then
    FORCE=true
    echo "Force update enabled, skipping version checks"
fi

# Get current version
CURRENT_VERSION=$(php artisan tinker --execute "echo config('app.version');" | tail -n1 | tr -d '\n')

if [ -z "$CURRENT_VERSION" ]; then
    echo "Error: Could not retrieve current version"
    php artisan up
    exit 1
fi

echo "Current version: $CURRENT_VERSION"

# Fetch latest release info
RELEASE_JSON=$(curl -s "$API_URL")

if [ $? -ne 0 ]; then
    echo "Error: Failed to fetch release info"
    php artisan up
    exit 1
fi

LATEST_TAG=$(echo "$RELEASE_JSON" | jq -r '.tag_name')
LATEST_VERSION=${LATEST_TAG#v}  # Remove 'v' prefix if present

echo "Latest version: $LATEST_VERSION"

# Function to compare semver versions
# Returns 0 if equal, 1 if v1 > v2, 2 if v1 < v2
semver_compare() {
    local v1=$1 v2=$2
    if [ "$v1" = "$v2" ]; then
        return 0
    fi
    # Simple comparison: split by . and compare numerically
    IFS='.' read -ra V1 <<< "$v1"
    IFS='.' read -ra V2 <<< "$v2"
    for i in {0..2}; do
        if [ "${V1[$i]:-0}" -gt "${V2[$i]:-0}" ]; then
            return 1  # v1 > v2
        elif [ "${V1[$i]:-0}" -lt "${V2[$i]:-0}" ]; then
            return 2  # v1 < v2
        fi
    done
    return 0  # equal
}

if [ "$FORCE" = false ]; then
    semver_compare "$CURRENT_VERSION" "$LATEST_VERSION"
    COMPARE_RESULT=$?

    if [ $COMPARE_RESULT -eq 0 ]; then
        echo "Already up to date."
        php artisan up
        exit 0
    elif [ $COMPARE_RESULT -eq 2 ]; then
        echo "Newer version available: $LATEST_VERSION"
    else
        echo "Current version is newer than latest release."
        php artisan up
        exit 0
    fi
else
    echo "Forcing update to latest version: $LATEST_VERSION"
fi


# Download the asset
ASSET_NAME="release.tgz"
ASSET_URL="$DOWNLOAD_URL/$LATEST_TAG/$ASSET_NAME"
TEMP_DIR="/tmp/novanas_update"
mkdir -p "$TEMP_DIR"
curl -L -o "$TEMP_DIR/$ASSET_NAME" "$ASSET_URL"
if [ $? -ne 0 ]; then
    echo "Error: Failed to download update"
    rm -rf "$TEMP_DIR"
    php artisan up
    exit 1
fi
# Extract
mkdir -p "$TEMP_DIR/update"
tar -xzf "$TEMP_DIR/$ASSET_NAME" -C "$TEMP_DIR/update"
if [ $? -ne 0 ]; then
    echo "Error: Failed to extract update"
    rm -rf "$TEMP_DIR"
    php artisan up
    exit 1
fi
# Update app: copy files, preserving ignored files
echo "Backing up current app..."
cp -r . "$TEMP_DIR/backup"
# Update files, excluding those in the new .gitignore
rsync -a --delete --include='public/build/***' --include='vendor/***' --exclude-from="$TEMP_DIR/update/.gitignore" "$TEMP_DIR/update/" .
if [ $? -ne 0 ]; then
    echo "Error: Failed to update files"
    # Restore backup
    rsync -a "$TEMP_DIR/backup/" .
    rm -rf "$TEMP_DIR"
    exit 1
fi
php artisan migrate --force

# Run all pending update scripts in version order
LOCK_FILE="update-scripts/.update_lock"
touch "$LOCK_FILE"

# When --force, re-run the current version's update script
if [ "$FORCE" = true ] && [ -n "$CURRENT_VERSION" ]; then
    CURRENT_SCRIPT="update-scripts/${CURRENT_VERSION}.sh"
    if [ -f "$CURRENT_SCRIPT" ]; then
        echo "Force reinstall: removing $CURRENT_VERSION from lock file"
        sed -i "/^${CURRENT_VERSION}\.sh$/d" "$LOCK_FILE"
    fi
fi

PENDING_SCRIPTS=()
for script in update-scripts/*.sh; do
    [ -f "$script" ] || continue
    script_name=$(basename "$script")
    if ! grep -qxF "$script_name" "$LOCK_FILE"; then
        PENDING_SCRIPTS+=("$script")
    fi
done

if [ ${#PENDING_SCRIPTS[@]} -gt 0 ]; then
    # Sort scripts by version number extracted from filename (oldest first)
    IFS=$'\n' SORTED_SCRIPTS=($(for s in "${PENDING_SCRIPTS[@]}"; do
        ver=$(basename "$s" .sh)
        echo "$ver $s"
    done | sort -t. -k1,1n -k2,2n -k3,3n | cut -d' ' -f2-))
    unset IFS

    for script in "${SORTED_SCRIPTS[@]}"; do
        script_name=$(basename "$script")
        echo "Running update script: $script_name"
        if ! bash "$script"; then
            echo "Error: Update script $script_name failed"
            php artisan up
            exit 1
        fi
        echo "$script_name" >> "$LOCK_FILE"
    done
else
    echo "No pending update scripts to run."
fi

php artisan queue:restart
# Clean up
rm -rf "$TEMP_DIR"
php artisan up
echo "Update successful to version $LATEST_VERSION"
