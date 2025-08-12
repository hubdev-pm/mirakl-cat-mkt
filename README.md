# XLSX to Database Migration System

A Node.js TypeScript CLI tool that migrates technical rule files from Google Sheets (XLSX format) to PostgreSQL database tables with zero data loss.

## 🎯 Project Status: **PRODUCTION READY** 🚀

### ✅ **ALL CORE PHASES COMPLETE**

**📋 Completed Implementation:**
- **✅ Phase 1**: Project Setup & Configuration 
- **✅ Phase 2**: Google Sheets Integration & XLSX Processing
- **✅ Phase 3**: Database Setup & Schema Management
- **✅ Phase 4**: Data Migration Logic & Processing  
- **✅ Phase 5**: Command Line Interface & Error Handling

**🎯 Core Features Fully Implemented:**
- **✅ Complete Migration Pipeline**: From Google Sheets to PostgreSQL
- **✅ Zero Data Loss Guarantee**: Comprehensive validation at every step
- **✅ Flexible Column Mapping**: Handles various sheet header formats
- **✅ Multi-language Support**: Portuguese, Spanish, French normalization
- **✅ Batch Processing**: Configurable batch sizes for optimal performance
- **✅ Progress Tracking**: Real-time migration status and reporting
- **✅ Error Management**: Detailed error collection and final reporting
- **✅ Data Transformation**: Sanitization, deduplication, validation
- **✅ CLI Interface**: Full argument parsing with help and validation

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
├── index.ts                    # ✅ Main entry point with signal handling
├── cli.ts                      # ✅ Complete CLI with all options
├── config/
│   └── environment.ts          # ✅ Environment configuration
├── database/
│   ├── connection.ts           # ✅ PostgreSQL connection & pooling
│   ├── schema.ts              # ✅ Complete schema definitions
│   └── migration.ts           # ✅ Batch migration with progress tracking
├── google/
│   └── sheets.ts              # ✅ Full Google Sheets API integration
├── processing/
│   ├── xlsx-parser.ts         # ✅ Complete XLSX parsing engine
│   └── data-transformer.ts    # ✅ Data transformation pipeline
└── utils/
    ├── logger.ts              # ✅ Structured Winston logging
    └── error-handler.ts       # ✅ Comprehensive error collection
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

## 📋 Implementation Status

### ✅ **All Core Phases Complete** 🎉

**Phase 1**: ✅ Project Setup & Configuration
- ✅ Complete TypeScript project setup
- ✅ All dependencies installed and working
- ✅ Environment configuration management
- ✅ Structured logging with Winston
- ✅ Comprehensive error handling system

**Phase 2**: ✅ Google Sheets Integration & XLSX Processing  
- ✅ Google Sheets API authentication
- ✅ URL conversion and XLSX download
- ✅ Multi-sheet XLSX parsing engine
- ✅ Flexible column mapping system
- ✅ Data extraction and validation

**Phase 3**: ✅ Database Setup & Schema Management
- ✅ PostgreSQL connection pooling
- ✅ Database and table creation
- ✅ Complete schema definitions
- ✅ Configuration table management
- ✅ Health check functionality

**Phase 4**: ✅ Data Migration Logic & Processing
- ✅ Data transformation pipeline  
- ✅ Multi-language normalization
- ✅ Deduplication and validation
- ✅ Batch insertion with progress tracking
- ✅ Conflict resolution strategies

**Phase 5**: ✅ CLI & Error Management
- ✅ Complete command-line interface
- ✅ Argument parsing and validation
- ✅ Progress reporting and status updates
- ✅ Comprehensive error collection
- ✅ Final migration summaries

### 🔄 **Optional Phase 6**: Docker Configuration
- [ ] Multi-stage Dockerfile
- [ ] docker-compose for development
- [ ] Production deployment scripts

## 🔧 Development

```bash
# Build TypeScript (compiles to dist/)
npm run build

# Start compiled version  
npm start -- --help

# Development mode (direct TypeScript execution)
npx ts-node src/index.ts --help

# Test CLI functionality
npm start -- --dry-run --verbose
npm start -- --table rules_worten_pt --dry-run
```

## 🚀 **Migration Pipeline**

The system implements a complete 8-step migration pipeline:

1. **🔗 Sheet Access**: Validate Google Sheets URLs and authenticate
2. **📥 XLSX Download**: Convert share URLs and download files  
3. **📊 Data Parsing**: Extract data with flexible column mapping
4. **🔄 Transformation**: Sanitize, normalize, and validate records
5. **🔍 Deduplication**: Remove duplicates based on code field
6. **🗄️ Database Setup**: Create tables and configuration
7. **📦 Batch Migration**: Insert data with progress tracking
8. **✅ Validation**: Verify integrity and report final status

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