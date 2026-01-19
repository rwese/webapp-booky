#!/bin/bash

# NAS Update Script for Book Collection Webapp
# Triggers Watchtower to check for and apply updates
#
# Usage:
#   ./update-nas.sh           # Check for updates (dry run)
#   ./update-nas.sh --apply   # Apply updates immediately
#   ./update-nas.sh --status  # Check Watchtower status
#   ./update-nas.sh --logs    # View Watchtower logs
#   ./update-nas.sh --help    # Show this help message

set -e

# Configuration
WATCHTOWER_API_URL="http://localhost:8080/v1"
WATCHTOWER_TOKEN="${WATCHTOWER_API_TOKEN:-watchtower-api-token-change-me}"
CONTAINER_PREFIX="booky"
LOG_FILE="/var/log/webapps/watchtower-update.log"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging function
log() {
    local level=$1
    shift
    local message="[$(date '+%Y-%m-%d %H:%M:%S')] [$level] $@"
    local color=""
    
    case "$level" in
        ERROR) color="${RED}" ;;
        WARN) color="${YELLOW}" ;;
        INFO) color="${GREEN}" ;;
        *) color="${BLUE}" ;;
    esac
    
    echo -e "${color}${message}${NC}" | tee -a "$LOG_FILE"
}

# Check if Watchtower is running
check_watchtower() {
    if ! docker ps --format '{{.Names}}' | grep -q "booky-watchtower"; then
        log "ERROR" "Watchtower container (booky-watchtower) is not running"
        log "INFO" "Deploy Watchtower first: docker-compose -f docker-compose.watchtower.yml up -d"
        exit 1
    fi
    log "INFO" "Watchtower is running"
}

# Trigger update via Watchtower HTTP API
trigger_update() {
    log "INFO" "Triggering Watchtower update via HTTP API..."
    
    local response
    response=$(curl -s -X POST \
        -H "Authorization: Bearer $WATCHTOWER_TOKEN" \
        "${WATCHTOWER_API_URL}/update" \
        -w "\n%{http_code}")
    
    local http_code=$(echo "$response" | tail -1)
    local body=$(echo "$response" | sed '$d')
    
    if [[ "$http_code" == "200" ]] || [[ "$http_code" == "202" ]]; then
        log "INFO" "Update triggered successfully"
        log "INFO" "Response: $body"
        return 0
    else
        log "ERROR" "Failed to trigger update (HTTP $http_code)"
        log "ERROR" "Response: $body"
        return 1
    fi
}

# Check Watchtower status
check_status() {
    log "INFO" "Checking Watchtower status..."
    
    local response
    response=$(curl -s -X GET \
        -H "Authorization: Bearer $WATCHTOWER_TOKEN" \
        "${WATCHTOWER_API_URL}/version" \
        -w "\n%{http_code}")
    
    local http_code=$(echo "$response" | tail -1)
    local body=$(echo "$response" | sed '$d')
    
    if [[ "$http_code" == "200" ]]; then
        log "INFO" "Watchtower API is responding"
        log "INFO" "Version info: $body"
    else
        log "WARN" "Watchtower API not responding (HTTP $http_code)"
        log "WARN" "Response: $body"
    fi
    
    echo ""
    log "INFO" "Container Status:"
    docker ps --filter "name=${CONTAINER_PREFIX}" --format "table {{.Names}}\t{{.Status}}\t{{.Image}}" | tee -a "$LOG_FILE"
}

# View Watchtower logs
view_logs() {
    log "INFO" "Showing Watchtower logs (last 100 lines)..."
    echo ""
    docker logs --tail 100 booky-watchtower 2>&1 | tee -a "$LOG_FILE"
}

# Check for available updates (dry run)
check_updates() {
    log "INFO" "Checking for available updates (dry run)..."
    log "INFO" "Note: This uses Watchtower's update mode without actually updating"
    
    # Watchtower doesn't have a true dry-run mode, but we can check
    # what images would be updated by looking at current images vs latest
    
    echo ""
    log "INFO" "Current booky containers:"
    docker ps --filter "name=${CONTAINER_PREFIX}" --format "table {{.Names}}\t{{.Image}}" | tee -a "$LOG_FILE"
    
    echo ""
    log "INFO" "To force an update check, run: $0 --apply"
    log "INFO" "Watchtower will automatically check every 5 minutes"
}

# View recent update activity
view_activity() {
    log "INFO" "Recent update activity..."
    echo ""
    docker logs --since 24h booky-watchtower 2>&1 | grep -E "(Updating|Update|Found new image|Pulled)" | tail -50 | tee -a "$LOG_FILE"
}

# Show help
show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --apply      Trigger update immediately via Watchtower HTTP API"
    echo "  --status     Check Watchtower status and container states"
    echo "  --logs       View Watchtower container logs"
    echo "  --check      Check for available updates (informational)"
    echo "  --activity   Show recent update activity"
    echo "  --help       Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                  # Show help"
    echo "  $0 --status         # Check Watchtower and container status"
    echo "  $0 --apply          # Trigger immediate update"
    echo "  $0 --logs           # View Watchtower logs"
    echo "  $0 --activity       # See recent update activity"
    echo ""
    echo "Configuration:"
    echo "  Set WATCHTOWER_API_TOKEN environment variable to override default token"
    echo "  Token must match WATCHTOWER_HTTP_API_TOKEN in docker-compose.watchtower.yml"
}

# Main function
main() {
    log "INFO" "========================================="
    log "INFO" "Booky Watchtower Update Manager"
    log "INFO" "========================================="
    
    # Ensure log directory exists
    mkdir -p "$(dirname "$LOG_FILE")"
    
    case "${1:---help}" in
        --apply)
            check_watchtower
            trigger_update
            ;;
        --status)
            check_watchtower
            check_status
            ;;
        --logs)
            check_watchtower
            view_logs
            ;;
        --check)
            check_updates
            ;;
        --activity)
            check_watchtower
            view_activity
            ;;
        --help|-h|help)
            show_help
            ;;
        *)
            log "ERROR" "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
    
    log "INFO" "Done!"
}

main "$@"
