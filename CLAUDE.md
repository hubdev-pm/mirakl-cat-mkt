# XLSX to Database Migration System - Project Instructions

## Project Overview
This is a Node.js TypeScript CLI tool that migrates technical rule files from Google Sheets (XLSX format) to PostgreSQL database tables with zero data loss.

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

## Dependencies Required
- Core: typescript, @types/node, ts-node, nodemon
- Google Sheets: googleapis, google-auth-library
- Database: pg, @types/pg
- XLSX: xlsx, @types/xlsx
- Logging: winston or similar

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

## Implementation Phases
1. Core migration functionality with hard-coded configurations
2. Database-driven configuration management
3. Enhanced error reporting and logging
4. Docker containerization and deployment preparation