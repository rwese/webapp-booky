#!/bin/bash

# Booky Production Deployment Script
# Usage: ./deploy.sh [environment] [--backup] [--rollback]

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_DIR/backend"
ENVIRONMENT=${1:-production}
BACKUP_FLAG=false
ROLLBACK_FLAG=false

# Parse arguments
for arg in "$@"; do
  case $arg in
    --backup)
      BACKUP_FLAG=true
      shift
      ;;
    --rollback)
      ROLLBACK_FLAG=true
      shift
      ;;
  esac
done

# Logging functions
log_info() {
  echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
  log_info "Checking prerequisites..."
  
  # Check Docker
  if ! command -v docker &> /dev/null; then
    log_error "Docker is not installed. Please install Docker first."
    exit 1
  fi
  
  # Check Docker Compose
  if ! command -v docker-compose &> /dev/null; then
    log_error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
  fi
  
  # Check Git
  if ! command -v git &> /dev/null; then
    log_error "Git is not installed. Please install Git first."
    exit 1
  fi
  
  log_info "All prerequisites met."
}

# Backup database
backup_database() {
  if [ "$BACKUP_FLAG" = true ]; then
    log_info "Creating database backup..."
    
    BACKUP_DIR="$BACKEND_DIR/backups"
    mkdir -p "$BACKUP_DIR"
    
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="$BACKUP_DIR/booky_backup_$TIMESTAMP.sql"
    
    # Create backup using docker-compose
    docker-compose -f "$BACKEND_DIR/docker-compose.prod.yml" exec -T postgres \
      pg_dump -U postgres booky_production > "$BACKUP_FILE"
    
    log_info "Backup created: $BACKUP_FILE"
    
    # Keep only last 7 backups
    ls -t "$BACKUP_DIR"/booky_backup_*.sql | tail -n +8 | xargs -r rm
    log_info "Old backups cleaned up."
  fi
}

# Pull latest changes
pull_latest() {
  log_info "Pulling latest changes..."
  cd "$PROJECT_DIR"
  git fetch origin
  git pull origin main
  log_info "Latest changes pulled."
}

# Build Docker images
build_images() {
  log_info "Building Docker images..."
  cd "$BACKEND_DIR"
  docker-compose -f docker-compose.prod.yml build --no-cache
  log_info "Docker images built."
}

# Run database migrations
run_migrations() {
  log_info "Running database migrations..."
  cd "$BACKEND_DIR"
  docker-compose -f docker-compose.prod.yml exec -T backend \
    npx prisma migrate deploy
  log_info "Database migrations completed."
}

# Start services
start_services() {
  log_info "Starting services..."
  cd "$BACKEND_DIR"
  docker-compose -f docker-compose.prod.yml up -d
  log_info "Services started."
}

# Stop services
stop_services() {
  log_info "Stopping services..."
  cd "$BACKEND_DIR"
  docker-compose -f docker-compose.prod.yml down
  log_info "Services stopped."
}

# Health check
health_check() {
  log_info "Performing health check..."
  
  MAX_RETRIES=30
  RETRY_COUNT=0
  HEALTHY=false
  
  while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -sf https://api.booky.app/api/health > /dev/null 2>&1; then
      HEALTHY=true
      break
    fi
    
    RETRY_COUNT=$((RETRY_COUNT + 1))
    log_info "Waiting for service to be healthy... ($RETRY_COUNT/$MAX_RETRIES)"
    sleep 2
  done
  
  if [ "$HEALTHY" = true ]; then
    log_info "Health check passed! ✅"
    return 0
  else
    log_error "Health check failed! ❌"
    return 1
  fi
}

# Rollback to previous version
rollback() {
  log_warn "Initiating rollback..."
  
  # Stop current services
  stop_services
  
  # Restore previous version
  cd "$PROJECT_DIR"
  git checkout previous || git log --oneline -2 | tail -1 | awk '{print $1}' | xargs -r git checkout
  
  # Rebuild and start
  build_images
  start_services
  
  if health_check; then
    log_info "Rollback completed successfully! ✅"
  else
    log_error "Rollback failed! Manual intervention required. ❌"
    exit 1
  fi
}

# Main deployment flow
deploy() {
  log_info "Starting production deployment for environment: $ENVIRONMENT"
  
  # Run pre-deployment checks
  check_prerequisites
  
  # Create backup if requested
  if [ "$BACKUP_FLAG" = true ]; then
    backup_database
  fi
  
  # Pull latest code
  pull_latest
  
  # Build new images
  build_images
  
  # Run database migrations
  run_migrations
  
  # Stop old services
  stop_services
  
  # Start new services
  start_services
  
  # Health check
  if health_check; then
    log_info "Deployment completed successfully! 🎉"
  else
    log_error "Deployment failed! Initiating rollback..."
    rollback
  fi
}

# Display usage
usage() {
  echo "Booky Production Deployment Script"
  echo ""
  echo "Usage: ./deploy.sh [environment] [options]"
  echo ""
  echo "Options:"
  echo "  --backup     Create database backup before deployment"
  echo "  --rollback   Rollback to previous version"
  echo "  --help       Show this help message"
  echo ""
  echo "Examples:"
  echo "  ./deploy.sh                     # Deploy to production"
  echo "  ./deploy.sh --backup           # Deploy with database backup"
  echo "  ./deploy.sh --rollback         # Rollback to previous version"
}

# Main script entry point
case "${1:-}" in
  --help|-h)
    usage
    exit 0
    ;;
  *)
    if [ "$ROLLBACK_FLAG" = true ]; then
      rollback
    else
      deploy
    fi
    ;;
esac
