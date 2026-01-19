#!/bin/bash

# NAS Deployment Script for Book Collection Webapp
# This script deploys the webapp from GitHub to your NAS

set -e  # Exit on error

# Configuration
REPO_URL="https://github.com/rwese/webapp-booky.git"
DEPLOY_DIR="/volume1/webapps/booky"
BRANCH="main"
BACKUP_DIR="/volume1/webapps/backups/booky"
LOG_FILE="/volume1/webapps/deploy.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    local level=$1
    shift
    local message="[$(date '+%Y-%m-%d %H:%M:%S')] [$level] $@"
    
    # Add color based on level
    local colored_message="$message"
    case "$level" in
        ERROR)
            colored_message="${RED}$message${NC}"
            ;;
        WARN)
            colored_message="${YELLOW}$message${NC}"
            ;;
        INFO)
            colored_message="${GREEN}$message${NC}"
            ;;
    esac
    
    echo -e "$colored_message" | tee -a "$LOG_FILE"
}

# Check if running on NAS
check_nas() {
    if [[ ! "$HOSTNAME" =~ "NAS" ]] && [[ ! -d "/volume1" ]]; then
        log "WARN" "Not running on NAS. This script is designed for Synology NAS."
        log "INFO" "To run locally, set DEPLOY_DIR to your desired deployment path"
    fi
}

# Initialize deployment directory
init_deploy_dir() {
    log "INFO" "Creating deployment directory: $DEPLOY_DIR"
    mkdir -p "$DEPLOY_DIR"
    mkdir -p "$BACKUP_DIR"
}

# Backup current deployment
backup_current() {
    if [[ -d "$DEPLOY_DIR/dist" ]]; then
        local backup_name="backup-$(date +%Y%m%d-%H%M%S)"
        log "INFO" "Creating backup: $backup_name"
        mkdir -p "$BACKUP_DIR/$backup_name"
        cp -r "$DEPLOY_DIR/dist" "$BACKUP_DIR/$backup_name/" 2>/dev/null || true
        cp "$DEPLOY_DIR/package.json" "$BACKUP_DIR/$backup_name/" 2>/dev/null || true
        log "INFO" "Backup created: $BACKUP_DIR/$backup_name"
    fi
}

# Clone or update repository
update_repo() {
    if [[ -d "$DEPLOY_DIR/.git" ]]; then
        log "INFO" "Updating existing repository..."
        cd "$DEPLOY_DIR"
        git fetch origin
        git reset --hard "origin/$BRANCH"
        git clean -fd
    else
        log "INFO" "Cloning repository from GitHub..."
        git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$DEPLOY_DIR"
        cd "$DEPLOY_DIR"
    fi
}

# Install dependencies
install_dependencies() {
    log "INFO" "Installing dependencies..."
    cd "$DEPLOY_DIR"

    # Check if npm is available
    if ! command -v npm &> /dev/null; then
        log "ERROR" "npm not found. Please install Node.js on your NAS."
        exit 1
    fi

    npm ci --only=production 2>&1 | tee -a "$LOG_FILE" || npm install --only=production 2>&1 | tee -a "$LOG_FILE"
}

# Build the project
build_project() {
    log "INFO" "Building project..."
    cd "$DEPLOY_DIR"

    npm run build 2>&1 | tee -a "$LOG_FILE"

    if [[ ! -d "dist" ]]; then
        log "ERROR" "Build failed - dist directory not found"
        exit 1
    fi

    log "INFO" "Build completed successfully"
}

# Deploy to web server
deploy_to_webroot() {
    log "INFO" "Deploying to web root..."

    # Determine web root (adjust based on your NAS setup)
    local WEB_ROOT="/var/services/web"

    if [[ -d "$WEB_ROOT/booky" ]]; then
        rm -rf "$WEB_ROOT/booky.old"
        mv "$WEB_ROOT/booky" "$WEB_ROOT/booky.old"
    fi

    cp -r "$DEPLOY_DIR/dist" "$WEB_ROOT/booky"

    # Copy necessary configuration files
    if [[ -f "$DEPLOY_DIR/dist/.env" ]]; then
        cp "$DEPLOY_DIR/dist/.env" "$WEB_ROOT/booky/.env"
    fi

    log "INFO" "Deployed to: $WEB_ROOT/booky"

    # Clean up old deployment
    rm -rf "$WEB_ROOT/booky.old"
}

# Update service worker for PWA
update_service_worker() {
    log "INFO" "Updating service worker configuration..."

    cd "$DEPLOY_DIR"

    # Update the scope in service worker if needed
    if [[ -f "dist/sw.js" ]]; then
        sed -i 's|"/"|"/booky/"|g' dist/sw.js 2>/dev/null || true
    fi
}

# Verify deployment
verify_deployment() {
    log "INFO" "Verifying deployment..."

    local WEB_ROOT="/var/services/web"

    if [[ ! -d "$WEB_ROOT/booky" ]]; then
        log "ERROR" "Deployment verification failed - directory not found"
        exit 1
    fi

    if [[ ! -f "$WEB_ROOT/booky/index.html" ]]; then
        log "ERROR" "Deployment verification failed - index.html not found"
        exit 1
    fi

    log "INFO" "Deployment verified successfully"
}

# Rollback function
rollback() {
    log "INFO" "Initiating rollback..."

    local latest_backup=$(ls -td "$BACKUP_DIR"/backup-* 2>/dev/null | head -1)

    if [[ -z "$latest_backup" ]]; then
        log "ERROR" "No backup found for rollback"
        exit 1
    fi

    log "INFO" "Rolling back to: $latest_backup"

    local WEB_ROOT="/var/services/web"

    rm -rf "$WEB_ROOT/booky"
    cp -r "$latest_backup/dist" "$WEB_ROOT/booky"

    log "INFO" "Rollback completed"
}

# Show deployment status
show_status() {
    log "INFO" "=== Deployment Status ==="
    log "INFO" "Repository: $REPO_URL"
    log "INFO" "Branch: $BRANCH"
    log "INFO" "Deploy Directory: $DEPLOY_DIR"
    log "INFO" "Backup Directory: $BACKUP_DIR"
    log "INFO" "Web Root: /var/services/web/booky"

    if [[ -d "$DEPLOY_DIR/.git" ]]; then
        log "INFO" "Current Commit: $(git -C "$DEPLOY_DIR" rev-parse --short HEAD)"
        log "INFO" "Last Updated: $(git -C "$DEPLOY_DIR" log -1 --format='%ad' --date=short)"
    fi

    log "INFO" "======================="
}

# Main deployment function
main() {
    log "INFO" "========================================="
    log "INFO" "Starting NAS Deployment for webapp-booky"
    log "INFO" "========================================="

    # Parse arguments
    case "${1:-deploy}" in
        deploy)
            check_nas
            init_deploy_dir
            backup_current
            update_repo
            install_dependencies
            build_project
            deploy_to_webroot
            update_service_worker
            verify_deployment
            show_status
            ;;
        update)
            check_nas
            backup_current
            update_repo
            install_dependencies
            build_project
            deploy_to_webroot
            update_service_worker
            verify_deployment
            ;;
        rollback)
            rollback
            ;;
        status)
            show_status
            ;;
        *)
            echo "Usage: $0 {deploy|update|rollback|status}"
            echo "  deploy   - Full deployment (clone, build, deploy)"
            echo "  update   - Update existing deployment (pull, rebuild, deploy)"
            echo "  rollback - Rollback to previous backup"
            echo "  status   - Show current deployment status"
            exit 1
            ;;
    esac

    log "INFO" "Deployment completed successfully!"
}

# Run main function
main "$@"
