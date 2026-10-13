#!/bin/bash

# =============================================================================
# QCI SAMAR - Unified Deployment (dev + staging, parity-verified)
# =============================================================================
# One command that pulls the latest `development`, stamps the deployed commit,
# deploys every target from that single checkout, then asserts each environment
# reports the same commit. This is what guarantees staging never lags dev.
# Backends report their commit on /api/v1/system/status; frontends carry theirs
# in the built bundle's /version.json (stamped by qci-samar-web's prebuild.js).
#
# Usage:
#   ./deploy/deploy.sh            # all: dev backend + dev frontend + staging backend + staging frontend
#   ./deploy/deploy.sh backend    # dev backend + staging backend
#   ./deploy/deploy.sh frontend   # dev frontend + staging frontend
#   ./deploy/deploy.sh dev        # dev backend + dev frontend (leaves staging alone)
#   ./deploy/deploy.sh staging    # staging backend + staging frontend (leaves dev alone)
#   ./deploy/deploy.sh status     # parity check only (no deploy)
#   ./deploy/deploy.sh help
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
FRONTEND_DIR="$(cd "$BACKEND_DIR/../qci-samar-web" 2>/dev/null && pwd || echo "")"
WORK_BRANCH="development"

DEV_URL="https://samar-api.webority.dev"
STAGING_URL="https://samar-staging1.qci.org.in"
DEV_FE_URL="https://samar.webority.dev"
STAMP_FILE="$BACKEND_DIR/public/deployed-commit.txt"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
print_header()  { echo -e "\n${BLUE}========================================${NC}\n${BLUE}$1${NC}\n${BLUE}========================================${NC}\n"; }
print_success() { echo -e "${GREEN}✓ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠ $1${NC}"; }
print_error()   { echo -e "${RED}✗ $1${NC}"; }

# Pull a repo to the tip of WORK_BRANCH, refusing to deploy uncommitted/diverged work.
prepare_repo() {
    local dir="$1" label="$2"
    [ -n "$dir" ] && [ -d "$dir/.git" ] || { print_error "$label repo not found (expected at $dir)"; exit 1; }
    cd "$dir"
    local branch; branch=$(git rev-parse --abbrev-ref HEAD)
    [ "$branch" = "$WORK_BRANCH" ] || { print_error "$label is on '$branch', not '$WORK_BRANCH'. Switch before deploying."; exit 1; }
    if [ -n "$(git status --porcelain)" ]; then
        print_error "$label has uncommitted changes. Commit or stash before deploying — we never ship a dirty tree."
        git status --short
        exit 1
    fi
    echo "Pulling latest $label ($WORK_BRANCH)..."
    git pull --ff-only
    print_success "$label at $(git rev-parse --short HEAD)"
}

# Extract the deployed commit from an environment. Backends expose it on the
# public status endpoint; the API middleware serialises response keys as
# camelCase (deployedCommit), so match that and tolerate snake_case too.
# Frontends carry it in the built bundle's /version.json (cache-busted query so
# Cloudflare cannot answer with a stale copy). An old frontend build has a
# version.json without a commit key: report that as "null" (unstamped), which
# is distinct from no version.json at all (SPA fallback serves index.html, no
# buildTime either, so the probe correctly reads as no status).
fetch_commit() {
    local url="$1" kind="${2:-backend}" body
    if [ "$kind" = "frontend" ]; then
        body=$(curl -s --max-time 20 "$url/version.json?parity=$(date +%s)" 2>/dev/null)
        if echo "$body" | grep -q '"commit"'; then
            echo "$body" | grep -oE '"commit":[[:space:]]*(null|"[^"]*")' | head -1 \
                | sed -E 's/"commit":[[:space:]]*//; s/^"//; s/"$//'
        elif echo "$body" | grep -q '"buildTime"'; then
            echo "null"
        fi
    else
        curl -s --max-time 20 "$url/api/v1/system/status" 2>/dev/null \
            | grep -oE '"(deployedCommit|deployed_commit)":[[:space:]]*(null|"[^"]*")' | head -1 \
            | sed -E 's/"(deployedCommit|deployed_commit)":[[:space:]]*//; s/^"//; s/"$//'
    fi
}

# How long parity_check waits for an environment to settle on the wanted commit.
# Overridable from the environment; set to 1 attempt for a no-wait snapshot.
PARITY_ATTEMPTS="${PARITY_ATTEMPTS:-12}"
PARITY_INTERVAL="${PARITY_INTERVAL:-10}"

# Probe until the environment reports $want, then return immediately.
# Right after a deploy the site may briefly 502 (php-fpm/nginx reload) or still
# answer from a stale cache (reporting the previous commit). On a single probe
# both are indistinguishable from a failed deploy, so a mismatch must be
# re-probed, not just an empty one. Returns the last value seen once attempts
# are exhausted.
settle_commit() {
    local url="$1" want="$2" attempts="$3" kind="$4" got="" i
    for i in $(seq 1 "$attempts"); do
        got=$(fetch_commit "$url" "$kind")
        if [ -n "$want" ]; then
            [ "$got" = "$want" ] && break
        else
            [ -n "$got" ] && [ "$got" != "null" ] && break
        fi
        [ "$i" -lt "$attempts" ] && sleep "$PARITY_INTERVAL"
    done
    printf '%s' "$got"
}

parity_check() {
    local want="$1" kind="$2"; shift 2
    print_header "Parity Check: $kind (expecting commit: ${want:-<local HEAD>})"
    local fail=0
    [ "$PARITY_ATTEMPTS" -gt 1 ] && \
        echo "  (allowing up to $(( PARITY_ATTEMPTS * PARITY_INTERVAL ))s per env for a container swap to settle)"
    printf "  %-12s %-12s %s\n" "ENV" "COMMIT" "RESULT"
    for pair in "$@"; do
        local name="${pair%%=*}" url="${pair#*=}" got
        got=$(settle_commit "$url" "$want" "$PARITY_ATTEMPTS" "$kind")
        if [ -z "$got" ]; then
            printf "  %-12s %-12s ${YELLOW}%s${NC}\n" "$name" "?" "unreachable / no status"
            fail=1
        elif [ "$got" = "null" ]; then
            local hint="deploy via deploy.sh"
            [ "$kind" = "frontend" ] && hint="old build, rebuild + redeploy to stamp"
            printf "  %-12s %-12s ${YELLOW}%s${NC}\n" "$name" "-" "unstamped ($hint)"
            fail=1
        elif [ -n "$want" ] && [ "$got" != "$want" ]; then
            printf "  %-12s %-12s ${RED}%s${NC}\n" "$name" "$got" "BEHIND (expected $want)"
            fail=1
        else
            printf "  %-12s %-12s ${GREEN}%s${NC}\n" "$name" "$got" "OK"
        fi
    done
    echo ""
    if [ "$fail" -ne 0 ]; then
        print_error "Environments are NOT in parity."
        return 1
    fi
    print_success "All environments report the same commit."
}

show_usage() {
    awk 'NR>2 && !/^#/ {exit} NR>2 {sub(/^# ?/,""); print}' "$0"
}

MODE="${1:-all}"
DO_DEV_BE=0; DO_DEV_FE=0; DO_STG_BE=0; DO_STG_FE=0
case "$MODE" in
    all)      DO_DEV_BE=1; DO_DEV_FE=1; DO_STG_BE=1; DO_STG_FE=1 ;;
    backend)  DO_DEV_BE=1; DO_STG_BE=1 ;;
    frontend) DO_DEV_FE=1; DO_STG_FE=1 ;;
    dev)      DO_DEV_BE=1; DO_DEV_FE=1 ;;
    staging)  DO_STG_BE=1; DO_STG_FE=1 ;;
    status)
        # A snapshot of what each env reports right now — no settle wait, so a
        # genuinely-behind env is reported instantly instead of after a retry loop.
        PARITY_ATTEMPTS=1
        RC=0
        parity_check "$(git -C "$BACKEND_DIR" rev-parse --short HEAD 2>/dev/null)" backend \
            "dev=$DEV_URL" "staging=$STAGING_URL" || RC=1
        FE_HEAD=""
        [ -n "$FRONTEND_DIR" ] && FE_HEAD=$(git -C "$FRONTEND_DIR" rev-parse --short HEAD 2>/dev/null)
        parity_check "$FE_HEAD" frontend \
            "dev-web=$DEV_FE_URL" "staging-web=$STAGING_URL" || RC=1
        exit $RC ;;
    help|-h|--help) show_usage; exit 0 ;;
    *) print_error "Unknown mode: $MODE"; show_usage; exit 1 ;;
esac

STAMP_BACKEND=$(( DO_DEV_BE + DO_STG_BE ))

print_header "Preparing repositories"
prepare_repo "$BACKEND_DIR" "backend"
SHA=$(git -C "$BACKEND_DIR" rev-parse --short HEAD)
FE_SHA=""
if [ "$DO_STG_FE" -eq 1 ] || [ "$DO_DEV_FE" -eq 1 ]; then
    prepare_repo "$FRONTEND_DIR" "frontend"
    FE_SHA=$(git -C "$FRONTEND_DIR" rev-parse --short HEAD)
fi

if [ "$STAMP_BACKEND" -gt 0 ]; then
    echo "$SHA" > "$STAMP_FILE"
    print_success "Stamped public/deployed-commit.txt = $SHA"
fi

FAILED=()
# Each target is independent: a transient failure on one (e.g. Azure Kudu 504)
# must not abort the others. Collect failures, report at the end.
run_target() {
    local label="$1"; shift
    print_header "$label"
    if "$@"; then print_success "$label OK"; else print_error "$label FAILED"; FAILED+=("$label"); fi
}

[ "$DO_DEV_BE" -eq 1 ] && run_target "Backend → DEV (VM)"   bash "$SCRIPT_DIR/deploy-dev.sh"
[ "$DO_DEV_FE" -eq 1 ] && run_target "Frontend → DEV (VM)"  bash "$FRONTEND_DIR/deploy/deploy-dev.sh"
[ "$DO_STG_BE" -eq 1 ] && run_target "Backend → STAGING (VM)"  bash "$SCRIPT_DIR/deploy-staging.sh" backend
[ "$DO_STG_FE" -eq 1 ] && run_target "Frontend → STAGING (VM)" bash "$SCRIPT_DIR/deploy-staging.sh" frontend

CHECK_BE=()
[ "$DO_DEV_BE" -eq 1 ] && CHECK_BE+=("dev=$DEV_URL")
[ "$DO_STG_BE" -eq 1 ] && CHECK_BE+=("staging=$STAGING_URL")
[ "${#CHECK_BE[@]}" -gt 0 ] && { parity_check "$SHA" backend "${CHECK_BE[@]}" || FAILED+=("parity-backend"); }

CHECK_FE=()
[ "$DO_DEV_FE" -eq 1 ] && CHECK_FE+=("dev-web=$DEV_FE_URL")
[ "$DO_STG_FE" -eq 1 ] && CHECK_FE+=("staging-web=$STAGING_URL")
[ "${#CHECK_FE[@]}" -gt 0 ] && { parity_check "$FE_SHA" frontend "${CHECK_FE[@]}" || FAILED+=("parity-frontend"); }

if [ "${#FAILED[@]}" -gt 0 ]; then
    print_error "Completed with failures: ${FAILED[*]}"
    print_warning "Fix the failed target(s) and re-run; './deploy/deploy.sh status' shows live parity anytime."
    exit 1
fi

print_header "Deployment Complete"
echo -e "Deployed backend commit: ${GREEN}$SHA${NC}"
[ -n "$FE_SHA" ] && echo -e "Deployed frontend commit: ${GREEN}$FE_SHA${NC}"
exit 0
