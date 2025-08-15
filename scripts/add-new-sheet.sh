#!/bin/bash

# Add New Google Sheet for Migration
# Usage: ./scripts/add-new-sheet.sh "table_name" "google_sheets_url"

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if correct number of arguments provided
if [ $# -ne 2 ]; then
    print_error "Usage: $0 \"table_name\" \"google_sheets_url\""
    echo ""
    echo "Examples:"
    echo "  $0 \"rules_amazon_us\" \"https://docs.google.com/spreadsheets/d/SHEET_ID/edit\""
    echo "  $0 \"rules_marketplace_country\" \"https://docs.google.com/spreadsheets/d/SHEET_ID/edit\""
    echo ""
    echo "Requirements:"
    echo "  - Table name must start with 'rules_'"
    echo "  - Google Sheets URL must be a valid share link"
    exit 1
fi

TABLE_NAME="$1"
GOOGLE_SHEETS_URL="$2"

# Validate table name
if [[ ! "$TABLE_NAME" =~ ^rules_ ]]; then
    print_error "Table name must start with 'rules_'"
    print_warning "Example: rules_amazon_us, rules_marketplace_country"
    exit 1
fi

# Validate table name format (lowercase, underscores only)
if [[ ! "$TABLE_NAME" =~ ^[a-z_]+$ ]]; then
    print_error "Table name must contain only lowercase letters and underscores"
    print_warning "Good: rules_amazon_us"
    print_warning "Bad: rules_Amazon_US, rules-amazon-us"
    exit 1
fi

# Validate Google Sheets URL
if [[ ! "$GOOGLE_SHEETS_URL" =~ ^https://docs\.google\.com/spreadsheets/d/ ]]; then
    print_error "Invalid Google Sheets URL format"
    print_warning "URL must start with: https://docs.google.com/spreadsheets/d/"
    exit 1
fi

print_status "Adding new Google Sheet configuration..."
print_status "Table Name: $TABLE_NAME"
print_status "Google Sheets URL: $GOOGLE_SHEETS_URL"

# Check if Docker container is running
if ! docker ps | grep -q "xlsx-migration-postgres"; then
    print_error "PostgreSQL container 'xlsx-migration-postgres' is not running"
    print_warning "Start it with: docker-compose up -d"
    exit 1
fi

# Add configuration to database
print_status "Adding configuration to database..."
docker exec xlsx-migration-postgres psql -U migration_user -d marketplaces-inhelp -c "
INSERT INTO migration_configuration (table_name, google_sheets_url) 
VALUES ('$TABLE_NAME', '$GOOGLE_SHEETS_URL')
ON CONFLICT (table_name) 
DO UPDATE SET 
  google_sheets_url = EXCLUDED.google_sheets_url,
  updated_at = CURRENT_TIMESTAMP;
" > /dev/null

if [ $? -eq 0 ]; then
    print_success "Configuration added successfully!"
else
    print_error "Failed to add configuration to database"
    exit 1
fi

# Verify configuration was added
print_status "Verifying configuration..."
RESULT=$(docker exec xlsx-migration-postgres psql -U migration_user -d marketplaces-inhelp -t -c "
SELECT table_name FROM migration_configuration WHERE table_name = '$TABLE_NAME';
" | tr -d ' ')

if [ "$RESULT" = "$TABLE_NAME" ]; then
    print_success "Configuration verified in database"
else
    print_error "Configuration verification failed"
    exit 1
fi

# Show all current configurations
print_status "Current sheet configurations:"
docker exec xlsx-migration-postgres psql -U migration_user -d marketplaces-inhelp -c "
SELECT 
  table_name as \"Table Name\",
  CASE 
    WHEN LENGTH(google_sheets_url) > 50 
    THEN LEFT(google_sheets_url, 47) || '...'
    ELSE google_sheets_url 
  END as \"Google Sheets URL\",
  created_at as \"Created\"
FROM migration_configuration 
ORDER BY table_name;
"

echo ""
print_success "✅ New sheet configuration added successfully!"
echo ""
print_status "Next steps:"
echo "  1. Test with dry run:"
echo "     npm run start:ts -- --table $TABLE_NAME --dry-run --verbose"
echo ""
echo "  2. Execute migration:"
echo "     npm run start:ts -- --table $TABLE_NAME --verbose"
echo ""
echo "  3. Verify results:"
echo "     docker exec xlsx-migration-postgres psql -U migration_user -d marketplaces-inhelp -c \"SELECT COUNT(*) FROM $TABLE_NAME;\""
echo ""

# Optional: Ask if user wants to run dry run immediately
read -p "Would you like to run a dry run test now? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_status "Running dry run test..."
    cd "$(dirname "$0")/.."
    npm run start:ts -- --table "$TABLE_NAME" --dry-run --verbose
fi