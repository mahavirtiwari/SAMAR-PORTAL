#!/bin/bash

# =============================================================================
# QCI SAMAR - Development Deployment Script (Backend)
# =============================================================================
# Target: Webority dev VM (vm-webhost-dev-cin-01 / 20.204.69.31, Central India)
#         https://samar-api.webority.dev  →  /data/www/samar-api.webority.dev
# Auth:   Entra ID SSH via Azure CLI (az ssh config) — no PEM file.
#         Requires: az CLI logged in (az login) on Webority-Azure-Subscription-CSP.
#
# Usage:
#   ./deploy/deploy-dev.sh              # Deploy backend (rsync + composer + cache + migrate)
#   ./deploy/deploy-dev.sh migrate      # Run migrations only
#   ./deploy/deploy-dev.sh cache        # Rebuild caches only
#   ./deploy/deploy-dev.sh verify       # Health check only
#   ./deploy/deploy-dev.sh help         # Show help
# =============================================================================

set -e

VM_NAME="vm-webhost-dev-cin-01"
VM_RG="WEBORITYWEBHOSTING-DEV"
VM_IP="20.204.69.31"
DEV_URL="https://samar-api.webority.dev"
REMOTE_BACKEND_DIR="/data/www/samar-api.webority.dev"
# Pin the subscription per-command so the deploy works regardless of the ambient
# az context (never `az account set` — that would flip other concurrent sessions).
AZ_SUBSCRIPTION="Webority-Azure-Subscription-CSP"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
print_header()  { echo -e "\n${BLUE}========================================${NC}\n${BLUE}$1${NC}\n${BLUE}========================================${NC}\n"; }
print_success() { echo -e "${GREEN}✓ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠ $1${NC}"; }
print_error()   { echo -e "${RED}✗ $1${NC}"; }

# --- Entra ID SSH transport -------------------------------------------------
# az ssh config mints a short-lived certificate (~1h), so regenerate per run.
SSH_TMP_DIR=""
SSH_CFG=""

cleanup_ssh() { [ -n "$SSH_TMP_DIR" ] && cd / && rm -rf "${SSH_TMP_DIR:?}" 2>/dev/null || true; }
trap cleanup_ssh EXIT

setup_transport() {
    print_header "Preparing Entra ID SSH transport"
    command -v az >/dev/null 2>&1 || { print_error "az CLI not found on PATH"; exit 1; }
    az account show --subscription "$AZ_SUBSCRIPTION" >/dev/null 2>&1 || { print_error "az CLI not logged in / no access to $AZ_SUBSCRIPTION. Run: az login"; exit 1; }
    SSH_TMP_DIR="$(mktemp -d)"
    SSH_CFG="$SSH_TMP_DIR/sshconfig"
    az ssh config --file "$SSH_CFG" -n "$VM_NAME" -g "$VM_RG" --subscription "$AZ_SUBSCRIPTION" --overwrite >/dev/null 2>&1 \
        || { print_error "az ssh config failed (check VM name/RG/subscription)"; exit 1; }
    print_success "SSH certificate generated ($VM_NAME)"
}

remote() { ssh -F "$SSH_CFG" -o StrictHostKeyChecking=accept-new "$VM_IP" "$@"; }

deploy_backend() {
    print_header "Syncing Backend Code"
    cd "$PROJECT_DIR"
    # Stamp the deployed commit so /api/v1/system/status reports what is actually
    # running. Mirrors the unified deploy.sh; without it a direct dev deploy leaves
    # the last unified-deploy SHA in place and the parity check reads stale.
    git -C "$PROJECT_DIR" rev-parse --short HEAD > "$PROJECT_DIR/public/deployed-commit.txt"
    print_success "Stamped public/deployed-commit.txt = $(cat "$PROJECT_DIR/public/deployed-commit.txt")"
    # The pipeline chowns the tree to the deploying user at the end of every
    # deploy; reclaim it up front too so rsync --delete never hits perm errors
    # after a partial run or a deploy by a different user.
    remote "sudo chown -R \$(whoami):www-data $REMOTE_BACKEND_DIR" >/dev/null
    MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*' rsync -az --delete \
        --chmod=Du=rwx,Dgo=rx,Fu=rw,Fgo=r \
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
        -e "ssh -F '$SSH_CFG' -o StrictHostKeyChecking=accept-new" \
        "$PROJECT_DIR/" "$VM_IP:$REMOTE_BACKEND_DIR/"
    print_success "Backend code synced"
}

remote_backend_pipeline() {
    local migrate_mode="${1:-normal}"
    local local_lock_hash
    local_lock_hash=$( (sha256sum "$PROJECT_DIR/composer.lock" 2>/dev/null || shasum -a 256 "$PROJECT_DIR/composer.lock") | awk '{print $1}')

    print_header "Remote Pipeline (composer + cache + migrate + perms + reload)"

    local remote_script encoded
    remote_script=$(cat <<'REMOTE_EOF'
set -e
# umask 0002 so files created here are group-writable; with SGID on the
# write-target dirs this keeps www-data and the deploy user out of each
# other's way (same scheme as staging).
umask 0002
LOCK_HASH="$1"
MIGRATE_MODE="$2"
BACKEND_DIR="$3"
cd "$BACKEND_DIR"
export APP_ENV=development

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

echo "[perms] normalizing ownership + SGID on write-target dirs..."
sudo chown -R "$(whoami)":www-data .
sudo chmod -R u=rwX,go=rX .
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
    remote "echo $encoded | base64 -d | bash -s -- '$local_lock_hash' '$migrate_mode' '$REMOTE_BACKEND_DIR'"
    print_success "Remote pipeline complete"
}

run_migrations() {
    print_header "Running Migrations"
    remote "cd $REMOTE_BACKEND_DIR && export APP_ENV=development && php artisan migrate --force"
    print_success "Migrations completed"
}

rebuild_cache() {
    print_header "Rebuilding Caches"
    remote "cd $REMOTE_BACKEND_DIR && export APP_ENV=development && php artisan config:clear && php artisan config:cache && php artisan route:cache && php artisan view:clear"
    print_success "Caches rebuilt"
}

verify_deployment() {
    print_header "Verifying Deployment"
    # Origin check pinned to the VM IP — the API serves a real Let's Encrypt
    # cert directly (not CF-proxied), so this validates TLS strictly too.
    ORIGIN_STATUS=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 \
        --resolve "samar-api.webority.dev:443:$VM_IP" "$DEV_URL/api/health" 2>/dev/null || echo "000")
    if [ "$ORIGIN_STATUS" = "200" ]; then
        print_success "Origin health (via $VM_IP): OK"
    else
        print_error "Origin health (via $VM_IP): HTTP $ORIGIN_STATUS"
    fi
    # Public check through Cloudflare — informational until DNS records exist.
    PUBLIC_STATUS=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$DEV_URL/api/health" 2>/dev/null || echo "000")
    if [ "$PUBLIC_STATUS" = "200" ]; then
        print_success "Public health ($DEV_URL): OK"
    else
        print_warning "Public health ($DEV_URL): HTTP $PUBLIC_STATUS (DNS/Cloudflare not ready?)"
    fi
}

show_usage() {
    awk 'NR>2 && !/^#/ {exit} NR>2 {sub(/^# ?/,""); print}' "$0"
}

case "${1:-all}" in
    migrate)
        setup_transport
        run_migrations
        rebuild_cache
        ;;
    cache)
        setup_transport
        rebuild_cache
        ;;
    verify)
        verify_deployment
        ;;
    help|-h|--help)
        show_usage
        ;;
    all|"")
        setup_transport
        deploy_backend
        remote_backend_pipeline normal
        verify_deployment
        ;;
    *)
        print_error "Unknown command: $1"
        show_usage
        exit 1
        ;;
esac
