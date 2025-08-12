#!/bin/bash

# Docker run script for XLSX to Database Migration System
# This script provides convenient commands for Docker operations

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo -e "${BLUE}XLSX to Database Migration System - Docker Helper${NC}"
echo "============================================="

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Error: Docker is not running${NC}"
    exit 1
fi

# Function to show usage
show_usage() {
    echo "Usage: $0 [command] [options]"
    echo ""
    echo "Commands:"
    echo "  setup           - Setup development environment (database only)"
    echo "  build           - Build the migration application image"
    echo "  migrate         - Run migration with all tables"
    echo "  migrate-table   - Run migration for specific table"
    echo "  dry-run         - Run migration in dry-run mode"
    echo "  config-only     - Setup configuration tables only"
    echo "  admin           - Start database admin interface (pgAdmin)"
    echo "  logs            - View migration logs"
    echo "  clean           - Clean up containers and volumes"
    echo "  status          - Show container status"
    echo ""
    echo "Examples:"
    echo "  $0 setup                           # Start PostgreSQL for development"
    echo "  $0 migrate                         # Run full migration"
    echo "  $0 migrate-table rules_worten_pt   # Migrate specific table"
    echo "  $0 dry-run                         # Test migration without changes"
    echo "  $0 admin                           # Open database admin interface"
}

# Function to check prerequisites
check_prerequisites() {
    echo -e "${YELLOW}Checking prerequisites...${NC}"
    
    # Check if .env file exists
    if [[ ! -f "$PROJECT_DIR/.env" ]]; then
        echo -e "${YELLOW}Warning: .env file not found. Copying from .env.example${NC}"
        if [[ -f "$PROJECT_DIR/.env.example" ]]; then
            cp "$PROJECT_DIR/.env.example" "$PROJECT_DIR/.env"
            echo -e "${YELLOW}Please edit .env file with your configuration${NC}"
        else
            echo -e "${RED}Error: .env.example not found${NC}"
            exit 1
        fi
    fi
    
    # Check if credentials directory exists
    if [[ ! -d "$PROJECT_DIR/credentials" ]]; then
        echo -e "${YELLOW}Creating credentials directory${NC}"
        mkdir -p "$PROJECT_DIR/credentials"
        echo -e "${YELLOW}Please place your Google Cloud service account JSON file in credentials/service-account.json${NC}"
    fi
    
    # Check if logs directory exists
    if [[ ! -d "$PROJECT_DIR/logs" ]]; then
        mkdir -p "$PROJECT_DIR/logs"
    fi
    
    echo -e "${GREEN}Prerequisites check completed${NC}"
}

# Function to setup development environment
setup_env() {
    echo -e "${YELLOW}Setting up development environment...${NC}"
    check_prerequisites
    
    cd "$PROJECT_DIR"
    docker-compose up -d postgres
    
    echo -e "${GREEN}Development environment started!${NC}"
    echo "Database is available at localhost:5433"
    echo "Database: marketplaces-inhelp"
    echo "User: migration_user"
    echo "Password: migration_password"
}

# Function to build application
build_app() {
    echo -e "${YELLOW}Building migration application...${NC}"
    cd "$PROJECT_DIR"
    
    # Build locally first to check for errors
    npm run build
    
    # Build Docker image
    docker-compose build xlsx-migration
    
    echo -e "${GREEN}Application built successfully!${NC}"
}

# Function to run migration
run_migration() {
    local table_name="$1"
    local extra_args="$2"
    
    echo -e "${YELLOW}Running migration...${NC}"
    check_prerequisites
    
    cd "$PROJECT_DIR"
    
    # Start database if not running
    docker-compose up -d postgres
    
    # Wait for database to be ready
    echo "Waiting for database to be ready..."
    sleep 5
    
    # Build and run migration
    docker-compose build xlsx-migration
    
    if [[ -n "$table_name" ]]; then
        docker-compose run --rm xlsx-migration node dist/index.js --table "$table_name" $extra_args
    else
        docker-compose run --rm xlsx-migration node dist/index.js $extra_args
    fi
}

# Function to run dry-run migration
run_dry_run() {
    echo -e "${YELLOW}Running dry-run migration...${NC}"
    run_migration "" "--dry-run --verbose"
}

# Function to setup config only
setup_config() {
    echo -e "${YELLOW}Setting up configuration tables only...${NC}"
    run_migration "" "--config-only --verbose"
}

# Function to start admin interface
start_admin() {
    echo -e "${YELLOW}Starting database admin interface...${NC}"
    check_prerequisites
    
    cd "$PROJECT_DIR"
    docker-compose --profile admin up -d postgres pgadmin
    
    echo -e "${GREEN}Admin interface started!${NC}"
    echo "pgAdmin is available at: http://localhost:5050"
    echo "Email: admin@migration.local"
    echo "Password: admin_password"
    echo ""
    echo "Database connection details:"
    echo "Host: postgres"
    echo "Port: 5432"
    echo "Database: marketplaces-inhelp"
    echo "User: migration_user"
    echo "Password: migration_password"
}

# Function to show logs
show_logs() {
    echo -e "${YELLOW}Showing migration logs...${NC}"
    
    if [[ -d "$PROJECT_DIR/logs" ]] && [[ -n "$(ls -A "$PROJECT_DIR/logs" 2>/dev/null)" ]]; then
        echo "=== Combined Logs ==="
        if [[ -f "$PROJECT_DIR/logs/combined.log" ]]; then
            tail -n 50 "$PROJECT_DIR/logs/combined.log"
        fi
        
        echo ""
        echo "=== Error Logs ==="
        if [[ -f "$PROJECT_DIR/logs/error.log" ]]; then
            tail -n 20 "$PROJECT_DIR/logs/error.log"
        fi
    else
        echo "No logs found. Run a migration first."
    fi
}

# Function to clean up
cleanup() {
    echo -e "${YELLOW}Cleaning up containers and volumes...${NC}"
    cd "$PROJECT_DIR"
    
    docker-compose --profile admin --profile migration down -v
    docker system prune -f
    
    echo -e "${GREEN}Cleanup completed!${NC}"
}

# Function to show status
show_status() {
    echo -e "${YELLOW}Container Status:${NC}"
    cd "$PROJECT_DIR"
    docker-compose ps
    
    echo ""
    echo -e "${YELLOW}Database Status:${NC}"
    if docker-compose exec postgres pg_isready -U migration_user -d marketplaces-inhelp 2>/dev/null; then
        echo -e "${GREEN}Database is running and accessible${NC}"
    else
        echo -e "${RED}Database is not accessible${NC}"
    fi
}

# Main command processing
case "${1:-help}" in
    setup)
        setup_env
        ;;
    build)
        build_app
        ;;
    migrate)
        run_migration
        ;;
    migrate-table)
        if [[ -z "$2" ]]; then
            echo -e "${RED}Error: Table name required${NC}"
            echo "Usage: $0 migrate-table <table_name>"
            exit 1
        fi
        run_migration "$2"
        ;;
    dry-run)
        run_dry_run
        ;;
    config-only)
        setup_config
        ;;
    admin)
        start_admin
        ;;
    logs)
        show_logs
        ;;
    clean)
        cleanup
        ;;
    status)
        show_status
        ;;
    help|--help|-h)
        show_usage
        ;;
    *)
        echo -e "${RED}Unknown command: $1${NC}"
        show_usage
        exit 1
        ;;
esac