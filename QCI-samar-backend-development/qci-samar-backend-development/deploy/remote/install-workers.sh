#!/bin/bash
# Run on the server by the deploy pipelines (after config:cache and migrate).
# Installs/refreshes the queue workers and the scheduler cron, then restarts the
# workers so they pick up the new code. Idempotent.
#
#   bash deploy/remote/install-workers.sh <app_env> <backend_dir>
set -e
APP_ENV_NAME="$1"
BACKEND_DIR="$2"
render() { sed -e "s|__APP_ENV__|$APP_ENV_NAME|g" -e "s|__BACKEND_DIR__|$BACKEND_DIR|g" "$1"; }

queue_connection=$(cd "$BACKEND_DIR" && APP_ENV="$APP_ENV_NAME" php artisan tinker --execute='echo config("queue.default");' 2>/dev/null | tail -1)
echo "[queue] connection: ${queue_connection:-unknown}"
if [ "$queue_connection" = "sync" ]; then
    echo "[queue] WARNING: QUEUE_CONNECTION=sync — emails and PDFs run inside web requests."
    echo "[queue]          Set QUEUE_CONNECTION=database in .env.$APP_ENV_NAME to use the workers."
fi

if command -v supervisorctl >/dev/null 2>&1; then
    render deploy/supervisor/qci-samar-worker.conf | sudo tee /etc/supervisor/conf.d/qci-samar-worker.conf >/dev/null
    sudo supervisorctl reread >/dev/null
    sudo supervisorctl update >/dev/null
    echo "[queue] supervisor workers installed"
else
    echo "[queue] WARNING: supervisor is not installed (sudo apt install supervisor);"
    echo "[queue]          queued emails and PDFs will not be processed until it is."
fi

# The scheduler may already run from a user crontab; never install a second copy.
if (crontab -l 2>/dev/null; sudo crontab -u www-data -l 2>/dev/null) | grep -q 'schedule:run'; then
    echo "[cron] scheduler already present in a user crontab — left as is"
else
    render deploy/cron/qci-samar-scheduler | sudo tee /etc/cron.d/qci-samar-scheduler >/dev/null
    sudo chmod 644 /etc/cron.d/qci-samar-scheduler
    echo "[cron] scheduler installed in /etc/cron.d/qci-samar-scheduler"
fi

php artisan queue:restart >/dev/null
echo "[queue] workers signalled to restart"
