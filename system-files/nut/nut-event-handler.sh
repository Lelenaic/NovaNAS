#!/bin/bash
# NovaNAS UPS Event Handler - called by upsmon NOTIFYCMD

CONF="/etc/nut/nova-shutdown.conf"
MONITOR="/usr/local/bin/nut-shutdown-monitor.sh"
PIDFILE="/run/nut-shutdown-monitor.pid"

if [ -f "$CONF" ]; then
    . "$CONF"
fi

UPS_NAME="${UPS_NAME:-nas-ups}"
CANCEL_ON_POWER_RETURN="${CANCEL_ON_POWER_RETURN:-1}"

case "$NOTIFYTYPE" in
    ONBATT)
        if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
            exit 0
        fi
        nohup "$MONITOR" > /dev/null 2>&1 &
        echo $! > "$PIDFILE"
        ;;
    ONLINE)
        if [ "$CANCEL_ON_POWER_RETURN" = "1" ]; then
            if [ -f "$PIDFILE" ]; then
                PID=$(cat "$PIDFILE")
                kill "$PID" 2>/dev/null
                rm -f "$PIDFILE"
            fi
            /sbin/shutdown -c 2>/dev/null
        fi
        ;;
esac
