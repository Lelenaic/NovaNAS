#!/bin/bash
set -e

echo "Installing NUT shutdown scripts..."

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)/system-files/nut"

sudo cp "$SCRIPT_DIR/nut-event-handler.sh" /usr/local/bin/nut-event-handler.sh
sudo chmod +x /usr/local/bin/nut-event-handler.sh
sudo cp "$SCRIPT_DIR/nut-shutdown-monitor.sh" /usr/local/bin/nut-shutdown-monitor.sh
sudo chmod +x /usr/local/bin/nut-shutdown-monitor.sh
sudo cp "$SCRIPT_DIR/upsmon.conf" /etc/nut/upsmon.conf
sudo systemctl restart nut-monitor 2>/dev/null || true

echo "nut ALL=(root) NOPASSWD: /sbin/shutdown" | sudo tee /etc/sudoers.d/nut-shutdown > /dev/null
sudo chmod 440 /etc/sudoers.d/nut-shutdown

echo "NUT shutdown scripts installed."
