sudo apt update
sudo apt install cron -yqq
sudo systemctl enable cron --now
(crontab -u novanas -l 2>/dev/null || true; echo "* * * * * cd /var/novanas && php artisan schedule:run >> /var/novanas/storage/logs/cron.log 2>> /var/novanas/storage/logs/cron_error.log") | crontab -u novanas -
