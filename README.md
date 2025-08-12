# XLSX to Database Migration System

A Node.js TypeScript CLI tool that migrates technical rule files from Google Sheets (XLSX format) to PostgreSQL database tables with zero data loss.

## 🎯 Project Status

### ✅ **Phase 1 Complete: Foundation Setup**

All core infrastructure is implemented and fully functional:

- **✅ Dependencies**: All required packages installed and working
- **✅ TypeScript**: Strict compilation with ES2020 target
- **✅ CLI Interface**: Full argument parsing and validation
- **✅ Error Handling**: Comprehensive error collection and reporting
- **✅ Logging**: Structured Winston-based logging system
- **✅ Database Schema**: Complete PostgreSQL table definitions
- **✅ Configuration**: Environment-based configuration management

## 🚀 Quick Start

### Prerequisites

- Node.js >= 14.0.0
- PostgreSQL database
- Google Cloud service account credentials

### Installation

```bash
# Clone and install dependencies
git clone <repository-url>
cd xlsx-database-migration
npm install

# Copy environment template
cp .env.example .env
# Edit .env with your actual configuration
```

### Usage

```bash
# Show help
npm start -- --help

# Migrate all configured tables
npm start

# Migrate with verbose logging
npm start -- --verbose

# Migrate specific table only
npm start -- --table rules_worten_pt

# Preview migration without changes
npm start -- --dry-run

# Setup configuration tables only
npm start -- --config-only
```

## 📁 Project Structure

```
src/
├── index.ts                    # Main entry point
├── cli.ts                      # Command line interface
├── config/
│   └── environment.ts          # Environment configuration
├── database/
│   ├── connection.ts           # PostgreSQL connection management
│   ├── schema.ts              # Table schemas and mappings
│   └── migration.ts           # [Phase 2] Data migration logic
├── google/
│   └── sheets.ts              # Google Sheets API integration
├── processing/
│   ├── xlsx-parser.ts         # XLSX parsing and validation
│   └── data-transformer.ts    # [Phase 2] Data transformation
└── utils/
    ├── logger.ts              # Structured logging
    └── error-handler.ts       # Error collection and reporting
```

## 🗄️ Database Schema

Each rule table contains these columns:
- `code` (TEXT)
- `description` (TEXT)
- `label` (TEXT)
- `requirement_level` (TEXT)
- `roles` (TEXT)
- `type` (TEXT)
- `validations` (TEXT)
- `variant` (TEXT)
- `codigo-categoria-mirakl` (TEXT)
- `nome-categoria-mirakl` (TEXT)
- `parent_code-categoria-mirakl` (TEXT)

### Target Tables

| Table Name | Google Sheets URL |
|------------|-------------------|
| `rules_worten_pt` | [Worten Portugal Rules](https://docs.google.com/spreadsheets/d/13NijIiZQpwKbLndz76Mj7-MkNurehiNu/edit?usp=sharing&ouid=108323945213256378916&rtpof=true&sd=true) |
| `rules_pccomp_pt` | [PC Componentes Portugal Rules](https://docs.google.com/spreadsheets/d/1EiycfU4p87g5bwP1lF0rS1kSZTLfq8Pj/edit?usp=drive_link&ouid=108323945213256378916&rtpof=true&sd=true) |
| `rules_pccomp_es` | [PC Componentes Spain Rules](https://docs.google.com/spreadsheets/d/1fVX8KA_SK0kW1TD-wSrRs0U6ahoP7DQI/edit?usp=drive_link&ouid=108323945213256378916&rtpof=true&sd=true) |
| `rules_carrefour_fr` | [Carrefour France Rules](https://docs.google.com/spreadsheets/d/1C33ky1xGnfwvFYCGl6mbve6hmtxr_7Hf/edit?usp=drive_link&ouid=108323945213256378916&rtpof=true&sd=true) |
| `rules_carrefour_es` | [Carrefour Spain Rules](https://docs.google.com/spreadsheets/d/1C2qm-ccZnhDMaXTVvrtr4VB-CbS0UD5l/edit?usp=drive_link&ouid=108323945213256378916&rtpof=true&sd=true) |

## ⚙️ Configuration

### Required Environment Variables

```env
# Database Configuration
DB_HOST=your_db_host
DB_PORT=5432
DB_NAME=marketplaces-inhelp
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_SSL=false

# Google Cloud Configuration
GOOGLE_CLOUD_PROJECT_ID=mirakl-catalogue-marketplaces
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account-key.json

# Application Configuration
LOG_LEVEL=info
NODE_ENV=development
```

### Optional Configuration

```env
# Migration Settings
BATCH_SIZE=1000
MAX_RETRIES=3
MIGRATION_TIMEOUT=300000

# Database Pool Settings
DB_POOL_MIN=2
DB_POOL_MAX=10
DB_POOL_IDLE_TIMEOUT=30000
DB_POOL_CONNECTION_TIMEOUT=60000
```

## 🧪 Testing

```bash
# Build the project
npm run build

# Test CLI functionality
node dist/index.js --help
node dist/index.js --dry-run --verbose
node dist/index.js --table rules_worten_pt --dry-run
```

## 📋 Development Roadmap

### ✅ Phase 1: Foundation (Complete)
- Project setup and configuration
- CLI interface and error handling  
- Database schema and connection management
- Logging and environment configuration

### 🔄 Phase 2: Core Migration Logic (Next)
- Google Sheets API implementation
- XLSX parsing and data extraction
- Data transformation and validation
- Database migration and insertion logic

### 📅 Phase 3: Enhanced Features
- Progress tracking and reporting
- Data deduplication and rollback
- Enhanced error recovery

### 🐳 Phase 4: Deployment
- Docker containerization
- Production deployment scripts
- CI/CD pipeline integration

## 🔧 Development

```bash
# Development mode (requires ts-node)
npx ts-node src/index.ts --help

# Build TypeScript
npm run build

# Start compiled version
npm start
```

## 📝 Logging

Logs are written to:
- `logs/combined.log` - All log messages
- `logs/error.log` - Error messages only
- `logs/exceptions.log` - Unhandled exceptions
- `logs/rejections.log` - Unhandled promise rejections

## 🎯 Success Criteria

- ✅ **100% Data Accuracy**: Zero records lost or corrupted during migration
- ⏱️ **Performance**: Migration completion under 5 minutes for all rule sets
- 🛡️ **Reliability**: Zero failed migrations due to system errors
- ✨ **Quality**: All database constraints and data types correctly maintained

## 🤝 Contributing

This tool is designed for the Mirakl Catalogue Marketplaces project. Follow the existing code patterns and ensure all changes maintain the zero data loss requirement.

## 📄 License

ISC License - See package.json for details.