#!/bin/bash

# Copy custom nginx configuration
cp /home/site/wwwroot/nginx-custom.conf /etc/nginx/sites-available/default
cp /home/site/wwwroot/nginx-custom.conf /etc/nginx/sites-enabled/default

# Reload nginx to apply changes
service nginx reload

# Run composer install if vendor directory is missing
if [ ! -d "/home/site/wwwroot/vendor" ]; then
    cd /home/site/wwwroot
    composer install --no-dev --optimize-autoloader
fi

# Clear caches
cd /home/site/wwwroot
php artisan config:clear
php artisan route:clear
php artisan cache:clear

# Ensure storage directories exist and are writable
mkdir -p /home/site/wwwroot/storage/api-docs
mkdir -p /home/site/wwwroot/storage/framework/cache
mkdir -p /home/site/wwwroot/storage/framework/sessions
mkdir -p /home/site/wwwroot/storage/framework/views
mkdir -p /home/site/wwwroot/storage/logs

# Remove any stale log files from deployment and create fresh writable log file
rm -f /home/site/wwwroot/storage/logs/*.log 2>/dev/null
touch /home/site/wwwroot/storage/logs/laravel.log
chmod -R 775 /home/site/wwwroot/storage
chown -R www-data:www-data /home/site/wwwroot/storage 2>/dev/null || true

# Log startup for debugging
echo "[$(date)] Startup script executed - storage initialized" >> /home/site/wwwroot/storage/logs/laravel.log

# Run database migrations (--force for non-interactive)
echo "[$(date)] Running database migrations..." >> /home/site/wwwroot/storage/logs/laravel.log
php artisan migrate --force 2>&1 | tee -a /home/site/wwwroot/storage/logs/laravel.log || echo "[$(date)] Migration completed with warnings" >> /home/site/wwwroot/storage/logs/laravel.log

# Log migration status
echo "[$(date)] Checking migration status..." >> /home/site/wwwroot/storage/logs/laravel.log
php artisan migrate:status 2>&1 | tail -20 >> /home/site/wwwroot/storage/logs/laravel.log || true

# Seed notification templates (idempotent updateOrCreate) so new email templates
# ship with the code instead of needing a manual seed after each deploy.
echo "[$(date)] Seeding notification templates..." >> /home/site/wwwroot/storage/logs/laravel.log
php artisan db:seed --class=NotificationTemplateSeeder --force 2>&1 | tee -a /home/site/wwwroot/storage/logs/laravel.log || echo "[$(date)] Template seeding completed with warnings" >> /home/site/wwwroot/storage/logs/laravel.log

# Generate Swagger documentation
php artisan l5-swagger:generate

# Start PHP-FPM (default entrypoint continues)
