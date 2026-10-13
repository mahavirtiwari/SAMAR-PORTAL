#!/bin/bash

# =============================================================================
# QCI SAMAR Web - Development Deployment Script
# =============================================================================
# Target: Webority dev VM (vm-webhost-dev-cin-01 / 20.204.69.31, Central India)
#         https://samar.webority.dev  →  /data/www/samar.webority.dev/build
#         Served straight from nginx as static files — no Node process, no pm2 —
#         matching staging and the planned production. Site config
#         /etc/nginx/sites-enabled/samar.webority.dev sets the document root and
#         includes /etc/nginx/snippets/samar-security-headers.conf; TLS via the
#         shared *.webority.dev origin cert.
# Auth:   Entra ID SSH via Azure CLI (az ssh config) — no PEM file.
#         Requires: az CLI logged in (az login) on Webority-Azure-Subscription-CSP.
#
# Usage:
#   ./deploy/deploy-dev.sh              # Full deploy (build:development -> rsync)
#   ./deploy/deploy-dev.sh verify       # Health check only
#   ./deploy/deploy-dev.sh help         # Show help
# =============================================================================

set -e

VM_NAME="vm-webhost-dev-cin-01"
VM_RG="WEBORITYWEBHOSTING-DEV"
VM_IP="20.204.69.31"
DEV_URL="https://samar.webority.dev"
REMOTE_WEB_DIR="/data/www/samar.webority.dev"
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

build_frontend() {
    print_header "Building Frontend (development)"
    cd "$PROJECT_DIR"
    npm run build:development
    [ -f "$PROJECT_DIR/build/index.html" ] || { print_error "build/index.html missing after build"; exit 1; }
    print_success "Build completed"
}

deploy_frontend() {
    print_header "Uploading build/"
    remote "sudo mkdir -p $REMOTE_WEB_DIR/build && sudo chown -R \$(whoami) $REMOTE_WEB_DIR/build" >/dev/null
    # This directory IS the nginx document root, so nothing but build output
    # belongs in it — anything else placed here is published. --delete keeps it
    # that way. [BUG-07226]
    MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*' rsync -az --delete \
        --chmod=Du=rwx,Dgo=rx,Fu=rw,Fgo=r \
        -e "ssh -F '$SSH_CFG' -o StrictHostKeyChecking=accept-new" \
        "$PROJECT_DIR/build/" "$VM_IP:$REMOTE_WEB_DIR/build/"
    print_success "Frontend uploaded to $REMOTE_WEB_DIR/build"
}

verify_deployment() {
    print_header "Verifying Deployment"
    # Origin check (works even before DNS/Cloudflare exist; origin cert is
    # self-signed for *.webority.dev → -k)
    ORIGIN_STATUS=$(curl -sk -o /dev/null -w '%{http_code}' --max-time 20 \
        --resolve "samar.webority.dev:443:$VM_IP" "$DEV_URL/" 2>/dev/null || echo "000")
    if [ "$ORIGIN_STATUS" = "200" ]; then
        print_success "Origin health (via $VM_IP): OK"
    else
        print_error "Origin health (via $VM_IP): HTTP $ORIGIN_STATUS"
    fi
    # Public check through Cloudflare — informational until DNS records exist.
    PUBLIC_STATUS=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$DEV_URL/" 2>/dev/null || echo "000")
    if [ "$PUBLIC_STATUS" = "200" ]; then
        print_success "Public health ($DEV_URL): OK"
    else
        print_warning "Public health ($DEV_URL): HTTP $PUBLIC_STATUS (DNS/Cloudflare not ready?)"
    fi
    # Commit check: version.json is stamped by prebuild.js at build time. The
    # query param busts any Cloudflare/browser cache so we read the live file.
    DEPLOYED_COMMIT=$(curl -sk --max-time 20 --resolve "samar.webority.dev:443:$VM_IP" \
        "$DEV_URL/version.json?verify=$(date +%s)" 2>/dev/null \
        | grep -oE '"commit":[[:space:]]*"[^"]*"' | sed -E 's/"commit":[[:space:]]*"//; s/"$//')
    LOCAL_HEAD=$(git -C "$PROJECT_DIR" rev-parse --short HEAD 2>/dev/null)
    if [ -z "$DEPLOYED_COMMIT" ]; then
        print_warning "Deployed version.json carries no commit stamp (build predates commit stamping?)"
    elif [ "$DEPLOYED_COMMIT" = "$LOCAL_HEAD" ]; then
        print_success "Deployed commit: $DEPLOYED_COMMIT (matches local HEAD)"
    elif [ "$DEPLOYED_COMMIT" = "$LOCAL_HEAD-dirty" ]; then
        print_warning "Deployed commit: $DEPLOYED_COMMIT (built from a dirty tree, uncommitted changes shipped)"
    else
        print_error "Deployed commit: $DEPLOYED_COMMIT does not match local HEAD $LOCAL_HEAD"
    fi
}

show_usage() {
    awk 'NR>2 && !/^#/ {exit} NR>2 {sub(/^# ?/,""); print}' "$0"
}

case "${1:-all}" in
    verify)
        verify_deployment
        ;;
    help|-h|--help)
        show_usage
        ;;
    all|"")
        setup_transport
        build_frontend
        deploy_frontend
        verify_deployment
        ;;
    *)
        print_error "Unknown command: $1"
        show_usage
        exit 1
        ;;
esac
