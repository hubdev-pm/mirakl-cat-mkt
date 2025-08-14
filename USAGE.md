# XLSX to Database Migration System - Usage Guide

## 📋 Table of Contents
- [Quick Start](#quick-start)
- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Step-by-Step Migration Process](#step-by-step-migration-process)
- [Command Reference](#command-reference)
- [Troubleshooting](#troubleshooting)
- [Production Deployment](#production-deployment)

## 🚀 Quick Start

### 1. Start PostgreSQL Database
```bash
# Start the database container
docker-compose up -d postgres

# Verify it's running
docker-compose ps
```

### 2. Run Your First Migration
```bash
# Test with dry run first
npm run start:ts -- --dry-run --verbose

# Run actual migration for all tables
npm run start:ts -- --verbose

# Or migrate a specific table
npm run start:ts -- --table rules_worten_pt --verbose
```

## 📋 Prerequisites

### Required Software
- **Node.js** v14+ (tested with v22.17.0)
- **Docker** and **Docker Compose**
- **Git** (for version control)

### Required Files
- **Service Account Credentials**: `service-account-mirakl-cat-mkt.json`
- **Environment Configuration**: `.env` file
- **Google Sheets URLs** configured in the code

### Database Requirements
- PostgreSQL 15+ (provided via Docker)
- Database name: `marketplaces-inhelp`
- Network connectivity to Google Sheets API

## ⚙️ Environment Setup

### 1. Database Configuration
Your `.env` file should contain:
```bash
# Database Connection
DB_HOST=localhost
DB_PORT=5433
DB_NAME=marketplaces-inhelp
DB_USER=migration_user
DB_PASSWORD=migration_password
DB_SSL=false

# Google Cloud Configuration
GOOGLE_CLOUD_PROJECT_ID=mirakl-catalogue-marketplaces
GOOGLE_APPLICATION_CREDENTIALS=./service-account-mirakl-cat-mkt.json

# Application Settings
LOG_LEVEL=info
NODE_ENV=development
BATCH_SIZE=1000
MAX_RETRIES=3
MIGRATION_TIMEOUT=300000
```

### 2. Google Service Account Setup
1. Ensure `service-account-mirakl-cat-mkt.json` is in the project root
2. Verify the service account has access to the Google Sheets
3. Test connection: `npm run start:ts -- --help`

## 📝 Step-by-Step Migration Process

### Phase 1: Environment Verification
```bash
# 1. Check if all dependencies are installed
npm install

# 2. Verify environment variables
cat .env

# 3. Test basic CLI functionality
npm run start:ts -- --help
```

### Phase 2: Database Setup
```bash
# 1. Start PostgreSQL container
docker-compose up -d postgres

# 2. Wait for database to be ready (30 seconds)
sleep 30

# 3. Verify database connection
docker exec xlsx-migration-postgres pg_isready -U migration_user -d marketplaces-inhelp

# 4. Setup configuration tables only
npm run start:ts -- --config-only --verbose
```

### Phase 3: Migration Testing
```bash
# 1. Run dry-run to preview changes
npm run start:ts -- --dry-run --verbose

# 2. Test with a single table first
npm run start:ts -- --table rules_worten_pt --dry-run --verbose

# 3. If dry-run looks good, run actual migration for one table
npm run start:ts -- --table rules_worten_pt --verbose
```

### Phase 4: Full Migration
```bash
# 1. Run migration for all configured tables
npm run start:ts -- --verbose

# 2. Monitor progress and check for errors
# The system will process each table sequentially
```

### Phase 5: Verification
```bash
# 1. Check database for migrated data
docker exec xlsx-migration-postgres psql -U migration_user -d marketplaces-inhelp -c "SELECT COUNT(*) FROM rules_worten_pt;"

# 2. Verify all tables were created
docker exec xlsx-migration-postgres psql -U migration_user -d marketplaces-inhelp -c "\dt"

# 3. Check migration logs
ls -la logs/
```

## 🔧 Command Reference

### Core Commands
```bash
# Show help and available options
npm run start:ts -- --help

# Setup database and configuration tables only
npm run start:ts -- --config-only

# Preview migration without making changes
npm run start:ts -- --dry-run

# Enable detailed logging
npm run start:ts -- --verbose

# Quiet mode (errors only)
npm run start:ts -- --quiet

# Migrate specific table only
npm run start:ts -- --table <table_name>
```

### Available Tables
- `rules_worten_pt`
- `rules_pccomp_pt` 
- `rules_pccomp_es`
- `rules_carrefour_fr`
- `rules_carrefour_es`

### Combined Examples
```bash
# Verbose dry-run for specific table
npm run start:ts -- --table rules_worten_pt --dry-run --verbose

# Quiet migration for all tables
npm run start:ts -- --quiet

# Setup configuration only with verbose logging
npm run start:ts -- --config-only --verbose
```

### Docker Commands
```bash
# Database Management
docker-compose up -d postgres          # Start database
docker-compose down postgres           # Stop database
docker-compose logs -f postgres        # View logs
docker-compose ps                      # Check status

# Database Access
docker exec -it xlsx-migration-postgres psql -U migration_user -d marketplaces-inhelp

# Optional: Start pgAdmin for database management
docker-compose --profile admin up -d
# Access at: http://localhost:5050
# Email: admin@migration.local
# Password: admin_password
```

## 🔍 Migration Process Flow

```
1. 📊 Validate Environment
   ├── Check .env variables
   ├── Verify service account file
   └── Test database connection

2. 🏗️ Setup Database
   ├── Create configuration tables
   ├── Initialize URL mappings
   └── Prepare rule table schemas

3. 📥 Download Data
   ├── Convert Google Sheets URLs
   ├── Download XLSX files
   └── Parse spreadsheet data

4. 🔄 Transform Data
   ├── Map columns to schema
   ├── Sanitize and normalize
   ├── Remove duplicates
   └── Validate records

5. 💾 Migrate to Database
   ├── Create rule tables
   ├── Insert data in batches
   ├── Handle conflicts
   └── Log progress

6. ✅ Verify Results
   ├── Count migrated records
   ├── Check data integrity
   └── Generate report
```

## 🐛 Troubleshooting

### Common Issues

#### Database Connection Errors
```bash
# Check if PostgreSQL is running
docker-compose ps

# Check database logs
docker-compose logs postgres

# Verify port mapping
docker port xlsx-migration-postgres

# Test connection manually
docker exec xlsx-migration-postgres pg_isready -U migration_user
```

#### Google Sheets Access Issues
```bash
# Verify service account file exists
ls -la service-account-mirakl-cat-mkt.json

# Check file permissions
chmod 644 service-account-mirakl-cat-mkt.json

# Test Google API access
npm run start:ts -- --dry-run --table rules_worten_pt --verbose
```

#### TypeScript Compilation Hanging
```bash
# Use the working scripts (with --transpile-only)
npm run start:ts -- --help

# Avoid using these (they may hang):
npm run build
npm start
```

#### Environment Variable Issues
```bash
# Check current environment
env | grep DB_
env | grep GOOGLE_

# Reload environment
source .env
```

### Error Messages and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| `Cannot find module 'dist/index.js'` | Build files missing | Use `npm run start:ts` instead of `npm start` |
| `ECONNRESET` | Database connection issue | Check PostgreSQL container and port mapping |
| `Environment variable required` | Missing .env variables | Verify all required variables in `.env` |
| `Google Sheets API error` | Service account issues | Check credentials file and permissions |
| `Command timed out` | TypeScript strict checking | Use `npm run start:ts` with `--transpile-only` |

## 🚀 Production Deployment

### For Production Environment

1. **Update Environment Variables**:
```bash
# Production .env
NODE_ENV=production
LOG_LEVEL=info
DB_SSL=true
DB_HOST=your-production-db-host
DB_PORT=5432
```

2. **Use Docker for Migration App**:
```bash
# Build and run migration container
docker-compose --profile migration up --build

# Or run specific table migration
docker-compose run --rm xlsx-migration npm run start:ts -- --table rules_worten_pt
```

3. **Monitoring and Logging**:
```bash
# Check migration logs
docker-compose logs xlsx-migration

# Monitor database
docker-compose --profile admin up -d
```

### Performance Optimization

```bash
# Increase batch size for large datasets
export BATCH_SIZE=5000

# Adjust timeout for slow networks
export MIGRATION_TIMEOUT=600000

# Run with minimal logging for speed
npm run start:ts -- --quiet
```

## 📊 Success Criteria

✅ **Migration Successful When:**
- All tables created without errors
- Record counts match source data
- No duplicate records in database
- All validation rules pass
- Migration completes under 5 minutes

✅ **Quality Checks:**
```sql
-- Verify record counts
SELECT 'rules_worten_pt' as table_name, COUNT(*) as records FROM rules_worten_pt
UNION ALL
SELECT 'rules_pccomp_pt', COUNT(*) FROM rules_pccomp_pt
-- ... repeat for all tables

-- Check for duplicates
SELECT code, COUNT(*) FROM rules_worten_pt GROUP BY code HAVING COUNT(*) > 1;

-- Verify data integrity
SELECT COUNT(*) as total_records, 
       COUNT(DISTINCT code) as unique_codes,
       COUNT(*) - COUNT(DISTINCT code) as duplicates
FROM rules_worten_pt;
```

---

## 🆘 Support

If you encounter issues:

1. **Check logs** in the `logs/` directory
2. **Run with `--verbose`** for detailed output
3. **Test with `--dry-run`** first
4. **Check this troubleshooting guide**
5. **Verify environment setup**

**Need Help?** Check the project's issue tracker or contact the development team.