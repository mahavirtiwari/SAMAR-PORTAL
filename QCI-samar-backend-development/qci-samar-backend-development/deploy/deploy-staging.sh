#!/bin/bash

# =============================================================================
# QCI SAMAR - Staging Deployment Script
# =============================================================================
# Target: Staging VM (13.126.142.111)
# Deploys: Backend + Frontend (or individually)
#
# Usage:
#   ./deploy/deploy-staging.sh              # Deploy both frontend + backend
#   ./deploy/deploy-staging.sh frontend     # Deploy only frontend
#   ./deploy/deploy-staging.sh backend      # Deploy only backend
#   ./deploy/deploy-staging.sh migrate      # Run migrations only
#   ./deploy/deploy-staging.sh fresh        # Deploy both + fresh database
#   ./deploy/deploy-staging.sh cache        # Rebuild caches only
#   ./deploy/deploy-staging.sh verify       # Health check
#   ./deploy/deploy-staging.sh help         # Show help
# =============================================================================

set -e

# Server Configuration
STAGING_IP="13.126.142.111"
STAGING_USER="ubuntu"
STAGING_URL="https://samar-staging1.qci.org.in"

# Paths
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOCAL_WEB_DIR="$(cd "$PROJECT_DIR/../qci-samar-web" 2>/dev/null && pwd || echo "")"
REMOTE_WEB_DIR="/var/www/qci-samar/frontend"
REMOTE_BACKEND_DIR="/var/www/qci-samar/backend"

# PEM file: check deploy/ folder first, then ~/.ssh/
PEM_FILE="$SCRIPT_DIR/zed-staging-server-2026.pem"
if [ ! -f "$PEM_FILE" ]; then
    PEM_FILE="$HOME/.ssh/zed-staging-server-2026.pem"
fi

SSH_CTRL_PATH="/tmp/qci-samar-staging-ssh-%r@%h:%p"
SSH_OPTS="-o ControlMaster=auto -o ControlPath=$SSH_CTRL_PATH -o ControlPersist=120s -o StrictHostKeyChecking=no"
# Git Bash (MSYS/MinGW) ssh cannot hold a multiplex control master — every
# connection fails with "Failed to connect to new control master". Drop
# multiplexing there; Mac/Linux keep it for the connection-reuse speedup.
case "$(uname -s)" in
    MINGW*|MSYS*|CYGWIN*) SSH_OPTS="-o StrictHostKeyChecking=no" ;;
esac
SSH_CMD="ssh -n $SSH_OPTS -i $PEM_FILE $STAGING_USER@$STAGING_IP"
# --chmod normalizes transferred perms (dirs 755, files 644) so local umask can't ship unreadable files.
RSYNC_CMD="rsync -avz --delete --chmod=Du=rwx,Dgo=rx,Fu=rw,Fgo=r -e \"ssh $SSH_OPTS -i $PEM_FILE\""

cleanup_ssh() {
    ssh -O exit $SSH_OPTS -i "$PEM_FILE" "$STAGING_USER@$STAGING_IP" 2>/dev/null || true
}
trap cleanup_ssh EXIT

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

print_success() { echo -e "${GREEN}✓ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠ $1${NC}"; }
print_error()   { echo -e "${RED}✗ $1${NC}"; }

check_pem_file() {
    if [ ! -f "$PEM_FILE" ]; then
        print_error "PEM file not found."
        echo "  Looked in:"
        echo "    - $SCRIPT_DIR/zed-staging-server-2026.pem"
        echo "    - $HOME/.ssh/zed-staging-server-2026.pem"
        echo ""
        echo "  Place the PEM file in either location."
        exit 1
    fi
    chmod 400 "$PEM_FILE" 2>/dev/null || true
    print_success "PEM file: $PEM_FILE"
}

test_connection() {
    print_header "Testing SSH Connection"
    if $SSH_CMD "echo 'Connection successful'" > /dev/null 2>&1; then
        print_success "Connected to staging server ($STAGING_IP)"
    else
        print_error "Failed to connect to staging server"
        exit 1
    fi
}

deploy_frontend() {
    print_header "Deploying Frontend"

    if [ -z "$LOCAL_WEB_DIR" ] || [ ! -d "$LOCAL_WEB_DIR" ]; then
        print_error "Frontend repo not found at: $PROJECT_DIR/../qci-samar-web/"
        echo "  Make sure qci-samar-web is cloned as a sibling to qci-samar-backend:"
        echo "    Repos/"
        echo "    ├── qci-samar-backend/"
        echo "    └── qci-samar-web/"
        exit 1
    fi

    cd "$LOCAL_WEB_DIR"

    echo "Building frontend for staging..."
    npm run build:staging
    print_success "Frontend build completed"

    echo "Uploading to server..."
    eval $RSYNC_CMD "$LOCAL_WEB_DIR/build/" "$STAGING_USER@$STAGING_IP:$REMOTE_WEB_DIR/"
    print_success "Frontend deployed to $REMOTE_WEB_DIR"
}

deploy_backend() {
    print_header "Deploying Backend"

    cd "$PROJECT_DIR"

    # Stamp the deployed commit so /api/v1/system/status reports what is actually
    # running. Mirrors the unified deploy.sh; without it a direct staging deploy
    # leaves the last unified-deploy SHA in place and the parity check reads stale.
    git -C "$PROJECT_DIR" rev-parse --short HEAD > "$PROJECT_DIR/public/deployed-commit.txt"
    print_success "Stamped public/deployed-commit.txt = $(cat "$PROJECT_DIR/public/deployed-commit.txt")"

    echo "Syncing backend code..."
    eval $RSYNC_CMD \
        --exclude '.git' \
        --exclude 'node_modules' \
        --exclude 'vendor' \
        --exclude 'bootstrap/cache/*' \
        --exclude 'deploy.zip' \
        --exclude '.claude' \
        --exclude 'CLAUDE.md' \
        --exclude '.composer.lock.sha256' \
        --exclude 'storage/logs/*' \
        --exclude 'storage/framework/cache/*' \
        --exclude 'storage/framework/sessions/*' \
        --exclude 'storage/framework/views/*' \
        --exclude 'storage/app/public/*' \
        --exclude 'storage/app/private' \
        --exclude 'deploy/*.pem' \
        --exclude 'qci_samar' \
        --exclude '.DS_Store' \
        "$PROJECT_DIR/" "$STAGING_USER@$STAGING_IP:$REMOTE_BACKEND_DIR/"
    print_success "Backend code synced"
}

remote_backend_pipeline() {
    local migrate_mode="${1:-normal}"
    local local_lock_hash
    local_lock_hash=$(shasum -a 256 "$PROJECT_DIR/composer.lock" | awk '{print $1}')

    print_header "Remote Pipeline (composer + cache + migrate + perms + reload)"

    local remote_script encoded
    remote_script=$(cat <<'REMOTE_EOF'
set -e
# umask 0002 so any file created here (artisan, composer, cache builds) is group-writable.
# Combined with SGID on write-target dirs, this prevents www-data from getting locked out
# of files created by ubuntu (or vice versa).
umask 0002
LOCK_HASH="$1"
MIGRATE_MODE="$2"
BACKEND_DIR="$3"
cd "$BACKEND_DIR"
export APP_ENV=staging

remote_hash=""
[ -f .composer.lock.sha256 ] && remote_hash=$(cat .composer.lock.sha256)
if [ "$remote_hash" = "$LOCK_HASH" ]; then
    echo "[composer] lock unchanged, skipping install"
else
    echo "[composer] lock changed, installing..."
    composer install --no-dev --optimize-autoloader --no-interaction
    echo "$LOCK_HASH" > .composer.lock.sha256
fi

echo "[cache] rebuilding..."
php artisan config:clear
php artisan config:cache
php artisan route:cache
php artisan view:clear

MIGRATE_STATUS=0
if [ "$MIGRATE_MODE" = "normal" ]; then
    echo "[migrate] running..."
    # Must not abort the pipeline: skipping the perms + reload below leaves a
    # freshly-rsynced tree unreloaded, turning a recoverable migration failure
    # into a 500. Record it and surface it as the exit status instead.
    php artisan migrate --force || MIGRATE_STATUS=$?
else
    echo "[migrate] skipped (mode=$MIGRATE_MODE)"
fi

echo "[perms] normalizing ownership + setting SGID on write-target dirs..."
sudo chown -R ubuntu:www-data .
# Baseline: dirs 755, files 644 (chmod -R is safe here, no SGID to preserve yet)
sudo chmod -R u=rwX,go=rX .
# Write-target dirs: 2775 (SGID + group-write) on dirs, 664 on files.
# SGID ensures new files inherit www-data group regardless of which user creates them.
# Use find to apply different modes to dirs vs files (chmod -R 2775 would mark files executable).
for d in storage bootstrap/cache public/pdf public/images/assessment-report; do
    [ -d "$d" ] || continue
    sudo find "$d" -type d -exec chmod 2775 {} +
    sudo find "$d" -type f -exec chmod 664 {} +
done

echo "[queue] workers + scheduler..."
# Non-fatal: a missing supervisor must not stop the reload below.
bash deploy/remote/install-workers.sh "$APP_ENV" "$(pwd)" || echo "[queue] worker install failed — see output above"

echo "[services] reloading php-fpm (8.4) and nginx..."
sudo systemctl reload php8.4-fpm 2>/dev/null || true
sudo systemctl reload nginx

if [ "$MIGRATE_STATUS" -ne 0 ]; then
    echo "[migrate] FAILED (exit $MIGRATE_STATUS) — services reloaded, app serving previous schema"
    exit "$MIGRATE_STATUS"
fi
REMOTE_EOF
)
    encoded=$(printf '%s' "$remote_script" | base64 | tr -d '\n')
    $SSH_CMD "echo $encoded | base64 -d | bash -s -- '$local_lock_hash' '$migrate_mode' '$REMOTE_BACKEND_DIR'"
    print_success "Remote pipeline complete"
}

run_migrations() {
    print_header "Running Migrations"
    $SSH_CMD "cd $REMOTE_BACKEND_DIR && export APP_ENV=staging && php artisan migrate --force"
    print_success "Migrations completed"
}

run_fresh_migrations() {
    print_header "Running Fresh Migrations (WARNING: This will delete all data!)"
    read -p "Are you sure you want to run migrate:fresh --seed? (yes/no): " confirm
    if [ "$confirm" = "yes" ]; then
        $SSH_CMD "cd $REMOTE_BACKEND_DIR && export APP_ENV=staging && php artisan migrate:fresh --seed --force"
        print_success "Fresh migrations completed"
    else
        print_warning "Fresh migrations cancelled"
    fi
}

rebuild_cache() {
    print_header "Rebuilding Caches"
    $SSH_CMD "cd $REMOTE_BACKEND_DIR && export APP_ENV=staging && php artisan config:clear && php artisan config:cache && php artisan route:cache && php artisan view:clear"
    print_success "Caches rebuilt"
}

fix_permissions() {
    print_header "Setting Permissions (chown + SGID on write-target dirs)"
    $SSH_CMD "cd $REMOTE_BACKEND_DIR && \
        sudo chown -R ubuntu:www-data . && \
        sudo chmod -R u=rwX,go=rX . && \
        for d in storage bootstrap/cache public/pdf public/images/assessment-report; do \
            [ -d \"\$d\" ] || continue; \
            sudo find \"\$d\" -type d -exec chmod 2775 {} +; \
            sudo find \"\$d\" -type f -exec chmod 664 {} +; \
        done"
    print_success "Permissions set"
}

restart_services() {
    print_header "Reloading Services"
    $SSH_CMD "sudo systemctl reload php8.4-fpm 2>/dev/null || true; sudo systemctl reload nginx"
    print_success "PHP-FPM and Nginx reloaded"
}

# Repo-tracked nginx files and the directory each lives in on the VM. The repo is
# the source of truth: staging nginx is otherwise hand-managed, and a restored or
# hand-edited config silently reopens the direct-IP and security-header audit
# findings. Keep this list in step with deploy/nginx/.
NGINX_FILES="qci-security-headers.conf:/etc/nginx/snippets
00-default-deny.conf:/etc/nginx/sites-available"

sync_nginx_config() {
    print_header "Syncing nginx Config"

    local drift=0
    while IFS=: read -r file dest_dir; do
        [ -z "$file" ] && continue
        local src="$SCRIPT_DIR/nginx/$file"
        if [ ! -f "$src" ]; then
            print_error "Missing repo file: deploy/nginx/$file"
            exit 1
        fi

        local local_hash remote_hash
        local_hash=$(sha256sum "$src" | cut -d' ' -f1)
        remote_hash=$($SSH_CMD "sudo sha256sum $dest_dir/$file 2>/dev/null | cut -d' ' -f1" || echo "")

        if [ "$local_hash" = "$remote_hash" ]; then
            print_success "$file in sync"
        else
            drift=1
            print_warning "$file drifted or missing on server — pushing repo version"
            scp $SSH_OPTS -i "$PEM_FILE" "$src" "$STAGING_USER@$STAGING_IP:/tmp/$file"
            $SSH_CMD "sudo cp /tmp/$file $dest_dir/$file"
        fi
    done <<EOF
$NGINX_FILES
EOF

    # The catch-all must be enabled, not merely present in sites-available.
    $SSH_CMD "sudo ln -sfn /etc/nginx/sites-available/00-default-deny.conf /etc/nginx/sites-enabled/00-default-deny.conf"

    if ! $SSH_CMD "sudo nginx -t" > /dev/null 2>&1; then
        print_error "nginx -t failed after sync — not reloading. Server config left as-is:"
        $SSH_CMD "sudo nginx -t" || true
        exit 1
    fi

    if [ "$drift" = "1" ]; then
        $SSH_CMD "sudo systemctl reload nginx"
        print_success "nginx config synced from repo and reloaded"
    else
        print_success "nginx config matches repo"
    fi
}

verify_deployment() {
    print_header "Verifying Deployment"

    # Regression guard for the STQC finding: the application must never answer on
    # the raw IP. curl exits non-zero (no HTTP status) when the catch-all refuses.
    echo "Checking direct-IP access is refused..."
    # `|| true` keeps set -e happy; curl still prints 000 as the status when the
    # connection is refused, so don't append a fallback word to it.
    IP_STATUS=$(curl -sk -o /dev/null -w '%{http_code}' --max-time 10 "https://$STAGING_IP/" 2>/dev/null || true)
    if [ -z "$IP_STATUS" ] || [ "$IP_STATUS" = "000" ]; then
        print_success "Direct IP access: refused"
    else
        print_error "Direct IP access returned HTTP $IP_STATUS — audit finding reopened"
    fi

    echo "Checking health endpoint..."
    HTTP_STATUS=$(curl -s -o /dev/null -w '%{http_code}' "$STAGING_URL/up" 2>/dev/null || echo "000")
    if [ "$HTTP_STATUS" = "200" ]; then
        print_success "Health endpoint (/up): OK"
    else
        print_error "Health endpoint (/up): HTTP $HTTP_STATUS"
    fi

    echo "Checking API endpoint..."
    API_RESPONSE=$(curl -s "$STAGING_URL/api/v1/system/status" 2>/dev/null || echo "{}")
    if echo "$API_RESPONSE" | grep -q '"success":true'; then
        print_success "API endpoint (/api/v1/system/status): OK"
    else
        print_error "API endpoint: $API_RESPONSE"
    fi

    echo "Checking frontend..."
    FRONTEND_STATUS=$(curl -s -o /dev/null -w '%{http_code}' "$STAGING_URL/" 2>/dev/null || echo "000")
    if [ "$FRONTEND_STATUS" = "200" ]; then
        print_success "Frontend: OK"
    else
        print_warning "Frontend: HTTP $FRONTEND_STATUS"
    fi
}

show_usage() {
    echo "Usage: $0 [command]"
    echo ""
    echo "QCI Samar - Staging Deployment (Backend + Frontend)"
    echo ""
    echo "Commands:"
    echo "  (none)      Deploy both frontend and backend"
    echo "  frontend    Deploy only frontend (build + rsync)"
    echo "  backend     Deploy only backend (rsync + composer + cache)"
    echo "  migrate     Run database migrations only"
    echo "  fresh       Deploy both + fresh database (migrate:fresh --seed)"
    echo "  cache       Rebuild Laravel caches only"
    echo "  verify      Verify deployment health"
    echo "  help        Show this help message"
    echo ""
    echo "Server: $STAGING_USER@$STAGING_IP"
    echo "URL:    $STAGING_URL"
    echo ""
    echo "Requires:"
    echo "  - PEM file: deploy/zed-staging-server-2026.pem or ~/.ssh/zed-staging-server-2026.pem"
    echo "  - Frontend repo at: ../qci-samar-web/ (for frontend deploy)"
}

# Main
MODE="${1:-all}"

check_pem_file
test_connection

case "$MODE" in
    frontend)
        deploy_frontend
        restart_services
        verify_deployment
        ;;
    backend)
        deploy_backend
        remote_backend_pipeline normal
        sync_nginx_config
        verify_deployment
        ;;
    migrate)
        run_migrations
        rebuild_cache
        fix_permissions
        ;;
    fresh)
        deploy_frontend
        deploy_backend
        remote_backend_pipeline skip
        run_fresh_migrations
        fix_permissions
        restart_services
        sync_nginx_config
        verify_deployment
        ;;
    cache)
        rebuild_cache
        fix_permissions
        restart_services
        ;;
    verify)
        verify_deployment
        ;;
    help)
        show_usage
        ;;
    all|"")
        deploy_frontend
        deploy_backend
        remote_backend_pipeline normal
        sync_nginx_config
        verify_deployment
        ;;
    *)
        print_error "Unknown command: $1"
        show_usage
        exit 1
        ;;
esac

# Scope-named, and deliberately not "Deployment Complete" — deploy.sh invokes this
# script twice per run, so that string reads as the whole orchestrated deploy finishing.
if [ "$MODE" != "help" ]; then
    print_header "Staging Complete — scope: $MODE"
    echo -e "Staging URL: ${GREEN}$STAGING_URL${NC}"
fi
