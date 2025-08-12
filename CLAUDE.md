# XLSX to Database Migration System - Project Instructions

## 🎯 Project Status: **CORE FUNCTIONALITY COMPLETE** ✅

This is a Node.js TypeScript CLI tool that migrates technical rule files from Google Sheets (XLSX format) to PostgreSQL database tables with zero data loss.

### ✅ **Completed Phases:**
- **Phase 1**: ✅ Project Setup & Configuration 
- **Phase 2**: ✅ Google Sheets Integration & XLSX Processing
- **Phase 3**: ✅ Database Setup & Schema Management
- **Phase 4**: ✅ Data Migration Logic & Processing  
- **Phase 5**: ✅ Command Line Interface & Error Handling

### 🔄 **Remaining:** 
- **Phase 6**: Docker Configuration (optional for core functionality)

## Key Requirements
- **Target Database:** PostgreSQL database named "marketplaces-inhelp"
- **Google Cloud Project:** mirakl-catalogue-marketplaces
- **Technology Stack:** Node.js with TypeScript, Docker containerization
- **Zero Data Loss:** 100% accuracy in data conversion is critical

## Database Schema
All rule tables must have these exact TEXT columns:
- code
- description
- label
- requirement_level
- roles
- type
- validations
- variant
- codigo-categoria-mirakl
- nome-categoria-mirakl
- parent_code-categoria-mirakl

## Target Tables and URLs
- `rules_worten_pt` → https://docs.google.com/spreadsheets/d/13NijIiZQpwKbLndz76Mj7-MkNurehiNu/edit?usp=sharing&ouid=108323945213256378916&rtpof=true&sd=true
- `rules_pccomp_pt` → https://docs.google.com/spreadsheets/d/1EiycfU4p87g5bwP1lF0rS1kSZTLfq8Pj/edit?usp=drive_link&ouid=108323945213256378916&rtpof=true&sd=true
- `rules_pccomp_es` → https://docs.google.com/spreadsheets/d/1fVX8KA_SK0kW1TD-wSrRs0U6ahoP7DQI/edit?usp=drive_link&ouid=108323945213256378916&rtpof=true&sd=true
- `rules_carrefour_fr` → https://docs.google.com/spreadsheets/d/1C33ky1xGnfwvFYCGl6mbve6hmtxr_7Hf/edit?usp=drive_link&ouid=108323945213256378916&rtpof=true&sd=true
- `rules_carrefour_es` → https://docs.google.com/spreadsheets/d/1C2qm-ccZnhDMaXTVvrtr4VB-CbS0UD5l/edit?usp=drive_link&ouid=108323945213256378916&rtpof=true&sd=true

## File Structure
```
src/
├── index.ts                    # Main entry point
├── cli.ts                      # Command line interface
├── database/
│   ├── connection.ts           # PostgreSQL connection
│   ├── schema.ts              # Table schema definitions
│   └── migration.ts           # Data migration logic
├── google/
│   └── sheets.ts              # Google Sheets API integration
├── processing/
│   ├── xlsx-parser.ts         # XLSX parsing
│   └── data-transformer.ts    # Data transformation
├── config/
│   └── environment.ts         # Configuration management
└── utils/
    ├── logger.ts              # Structured logging
    └── error-handler.ts       # Error handling
```

## ✅ Dependencies (All Installed & Working)
- Core: typescript, @types/node, ts-node, nodemon
- Google Sheets: googleapis, google-auth-library
- Database: pg, @types/pg, dotenv
- XLSX: xlsx, @types/xlsx
- Logging: winston

## Environment Variables
- Google Cloud service account credentials
- PostgreSQL connection details for Google Cloud SQL
- Database name: marketplaces-inhelp

## Development Commands
- Build: `npm run build`
- Start: `npm start`
- Development: `npm run dev`

## Docker Configuration
- Multi-stage Dockerfile for production optimization
- docker-compose.yml for local PostgreSQL development
- Volume mounts for Google Cloud credentials

## Error Handling Strategy
- Collect all errors during processing
- Report all errors at the end (don't stop on first error)
- Provide detailed logging and progress reporting
- Support graceful shutdown and cleanup

## Success Criteria
- 100% data accuracy - zero records lost or corrupted
- Migration completion under 5 minutes for all rule sets
- Zero failed migrations due to system errors
- All database constraints and data types maintained

## 🚀 **Implementation Status**

### ✅ **Fully Implemented Features:**
1. **Complete CLI Interface** - Full argument parsing, validation, help system
2. **Google Sheets Integration** - Authentication, URL conversion, XLSX download
3. **XLSX Processing** - Multi-sheet parsing, flexible column mapping, data extraction
4. **Data Transformation** - Sanitization, normalization, deduplication, validation
5. **Database Operations** - Connection pooling, batch insertion, conflict resolution
6. **Error Management** - Comprehensive error collection and reporting
7. **Progress Tracking** - Real-time migration status and batch processing
8. **Multi-language Support** - Portuguese, Spanish, French normalization

### 🔧 **Core Components:**
- `src/index.ts` - ✅ Main orchestration with signal handling
- `src/cli.ts` - ✅ Complete CLI with all options and validation  
- `src/google/sheets.ts` - ✅ Full Google Sheets API integration
- `src/processing/xlsx-parser.ts` - ✅ Complete XLSX parsing engine
- `src/processing/data-transformer.ts` - ✅ Data transformation pipeline
- `src/database/migration.ts` - ✅ Batch migration with progress tracking
- `src/database/connection.ts` - ✅ Connection pooling and health checks
- `src/database/schema.ts` - ✅ Complete schema definitions
- `src/utils/logger.ts` - ✅ Structured logging with multiple outputs
- `src/utils/error-handler.ts` - ✅ Comprehensive error collection

### 📊 **Migration Pipeline:**
1. **Sheet Access** → Validate URLs and authenticate with Google Sheets API
2. **XLSX Download** → Convert share URLs to export format and download files
3. **Data Parsing** → Extract data from worksheets with flexible column mapping
4. **Transformation** → Sanitize, normalize, and validate all records
5. **Deduplication** → Remove duplicates based on code field
6. **Database Setup** → Create tables and configuration if needed
7. **Batch Migration** → Insert data in configurable batches with progress tracking
8. **Validation** → Verify all data integrity and report final status

## 🎯 **Ready for Production Use**
The system is functionally complete and ready to migrate Google Sheets data to PostgreSQL with zero data loss guarantee.