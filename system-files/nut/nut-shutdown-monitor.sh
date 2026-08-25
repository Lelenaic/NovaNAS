#!/bin/bash
# NovaNAS UPS Shutdown Monitor

export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

CONF="/etc/nut/nova-shutdown.conf"
PIDFILE="/run/nut-shutdown-monitor.pid"
POLL_INTERVAL=10

if [ -f "$CONF" ]; then
    . "$CONF"
fi

UPS_NAME="${UPS_NAME:-nas-ups}"
SHUTDOWN_MODE="${SHUTDOWN_MODE:-battery}"
BATTERY_THRESHOLD="${BATTERY_THRESHOLD:-15}"
SHUTDOWN_MINUTES="${SHUTDOWN_MINUTES:-5}"
CANCEL_ON_POWER_RETURN="${CANCEL_ON_POWER_RETURN:-1}"

cleanup() {
    rm -f "$PIDFILE"
}
trap cleanup EXIT

is_on_battery() {
    STATUS=$(/usr/bin/upsc "$UPS_NAME" ups.status 2>/dev/null)
    [[ "$STATUS" == *OB* ]]
}

START_TIME=$(date +%s)

while true; do
    if ! is_on_battery; then
        if [ "$CANCEL_ON_POWER_RETURN" = "1" ]; then
            exit 0
        fi
        sleep "$POLL_INTERVAL"
        continue
    fi

    CHARGE=$(/usr/bin/upsc "$UPS_NAME" battery.charge 2>/dev/null)

    if [ "$SHUTDOWN_MODE" = "battery" ]; then
        if [ -n "$CHARGE" ]; then
            CHARGE_INT=$(printf "%.0f" "$CHARGE" 2>/dev/null || echo "100")
            if [ "$CHARGE_INT" -lt "$BATTERY_THRESHOLD" ]; then
                sudo /sbin/shutdown -h +0
                exit 0
            fi
        fi
    elif [ "$SHUTDOWN_MODE" = "time" ]; then
        NOW=$(date +%s)
        ELAPSED=$(( NOW - START_TIME ))
        MINUTES=$(( ELAPSED / 60 ))
        if [ "$MINUTES" -ge "$SHUTDOWN_MINUTES" ]; then
            sudo /sbin/shutdown -h +0
            exit 0
        fi
    fi

    sleep "$POLL_INTERVAL"
done
