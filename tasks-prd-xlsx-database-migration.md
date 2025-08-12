# Tasks: XLSX to Database Migration System

## Relevant Files

- `src/index.ts` - Main application entry point and orchestration logic
- `src/cli.ts` - Command line interface implementation and argument parsing
- `src/database/connection.ts` - PostgreSQL database connection and initialization
- `src/database/schema.ts` - Table schema definitions and database creation logic
- `src/database/migration.ts` - Core data migration and insertion logic
- `src/google/sheets.ts` - Google Sheets API integration and authentication
- `src/processing/xlsx-parser.ts` - XLSX file parsing and data extraction
- `src/processing/data-transformer.ts` - Data transformation and validation logic
- `src/config/environment.ts` - Environment variables and configuration management
- `src/utils/logger.ts` - Structured logging utilities and configuration
- `src/utils/error-handler.ts` - Error collection and reporting functionality
- `package.json` - Node.js project configuration and dependencies
- `tsconfig.json` - TypeScript compiler configuration
- `Dockerfile` - Docker container configuration
- `docker-compose.yml` - Multi-service Docker configuration
- `.env.example` - Environment variables template
- `README.md` - Project documentation and setup instructions

### Notes

- Google Cloud service account credentials will be required for Sheets API access
- PostgreSQL connection details must be configured via environment variables

## Tasks

- [x] 1.0 Project Setup and Configuration ✅ **COMPLETED**
  - [x] 1.1 Initialize Node.js TypeScript project with `npm init` and configure package.json
  - [x] 1.2 Install core dependencies: typescript, @types/node, ts-node, nodemon
  - [x] 1.3 Install Google Sheets dependencies: googleapis, google-auth-library
  - [x] 1.4 Install database dependencies: pg, @types/pg
  - [x] 1.5 Install XLSX processing: xlsx, @types/xlsx
  - [x] 1.6 Install logging: winston or similar logging framework
  - [x] 1.7 Configure TypeScript with tsconfig.json (strict mode, ES2020 target)
  - [x] 1.8 Set up project folder structure (src/, config/)
  - [x] 1.9 Create .env.example with required environment variables template
  - [x] 1.10 Set up npm scripts for build, start, and dev commands

- [x] 2.0 Google Sheets Integration and XLSX Processing ✅ **COMPLETED**
  - [ ] 2.1 Create Google Cloud service account and download credentials JSON (Manual Task)
  - [x] 2.2 Implement Google Sheets API authentication in `src/google/sheets.ts`
  - [x] 2.3 Create function to convert Google Sheets URLs to downloadable XLSX format
  - [x] 2.4 Implement XLSX file download from Google Sheets URLs
  - [x] 2.5 Create XLSX parsing logic in `src/processing/xlsx-parser.ts`
  - [x] 2.6 Implement data extraction from XLSX worksheets
  - [x] 2.7 Handle multiple sheets within single XLSX files if applicable
  - [x] 2.8 Add error handling for invalid URLs or inaccessible sheets

- [x] 3.0 Database Setup and Schema Management ✅ **COMPLETED**
  - [x] 3.1 Create PostgreSQL connection logic in `src/database/connection.ts`
  - [x] 3.2 Implement database creation functionality for "marketplaces-inhelp"
  - [x] 3.3 Define table schema for rule sets in `src/database/schema.ts`
  - [x] 3.4 Create configuration table schema for storing URL-to-table mappings
  - [x] 3.5 Implement table creation functions with all 11 required TEXT columns
  - [x] 3.6 Create configuration table initialization with initial mappings
  - [x] 3.7 Add database connection pooling for performance
  - [x] 3.8 Implement database health check functionality
  - [x] 3.9 Add database transaction support for data integrity

- [x] 4.0 Data Migration Logic and Processing ✅ **COMPLETED**
  - [x] 4.1 Create data transformation logic in `src/processing/data-transformer.ts`
  - [x] 4.2 Implement mapping from XLSX columns to database table columns
  - [x] 4.3 Create batch data insertion functionality in `src/database/migration.ts`
  - [x] 4.4 Implement data validation for required table structure
  - [x] 4.5 Add progress tracking and reporting during migration
  - [x] 4.6 Create data deduplication logic to handle re-runs
  - [x] 4.7 Implement rollback functionality for failed migrations
  - [x] 4.8 Add support for processing multiple rule sets in sequence

- [x] 5.0 Command Line Interface and Error Handling ✅ **COMPLETED**
  - [x] 5.1 Create CLI interface in `src/cli.ts` with argument parsing
  - [x] 5.2 Implement structured logging in `src/utils/logger.ts`
  - [x] 5.3 Create error collection system in `src/utils/error-handler.ts`
  - [x] 5.4 Add progress reporting with detailed migration status
  - [x] 5.5 Implement command-line options for different execution modes
  - [x] 5.6 Create help documentation and usage instructions
  - [x] 5.7 Add verbose/quiet mode options for different logging levels
  - [x] 5.8 Implement graceful shutdown and cleanup on interruption
  - [x] 5.9 Create final migration summary and success/failure reporting

- [ ] 6.0 Docker Configuration and Deployment Setup
  - [ ] 6.1 Create Dockerfile with multi-stage build for production optimization
  - [ ] 6.2 Set up docker-compose.yml for local PostgreSQL development
  - [ ] 6.3 Configure environment variable handling in Docker
  - [ ] 6.4 Add Docker health checks for application readiness
  - [ ] 6.5 Create .dockerignore file to optimize build context
  - [ ] 6.6 Set up volume mounts for Google Cloud credentials
  - [ ] 6.7 Configure container networking for database connectivity
  - [ ] 6.8 Create deployment scripts for different environments
  - [ ] 6.9 Add container logging configuration
  - [x] 6.10 Create README.md with comprehensive setup and usage instructions ✅ **COMPLETED**

### Google Sheets files URLS

Tables name for this rules and the respective google sheets urls after ->:
rules_worten_pt -> https://docs.google.com/spreadsheets/d/13NijIiZQpwKbLndz76Mj7-MkNurehiNu/edit?usp=sharing&ouid=108323945213256378916&rtpof=true&sd=true
rules_pccomp_pt -> https://docs.google.com/spreadsheets/d/1EiycfU4p87g5bwP1lF0rS1kSZTLfq8Pj/edit?usp=drive_link&ouid=108323945213256378916&rtpof=true&sd=true
rules_pccomp_es -> https://docs.google.com/spreadsheets/d/1fVX8KA_SK0kW1TD-wSrRs0U6ahoP7DQI/edit?usp=drive_link&ouid=108323945213256378916&rtpof=true&sd=true
rules_carrefour_fr -> https://docs.google.com/spreadsheets/d/1C33ky1xGnfwvFYCGl6mbve6hmtxr_7Hf/edit?usp=drive_link&ouid=108323945213256378916&rtpof=true&sd=true
rules_carrefour_es -> https://docs.google.com/spreadsheets/d/1C2qm-ccZnhDMaXTVvrtr4VB-CbS0UD5l/edit?usp=drive_link&ouid=108323945213256378916&rtpof=true&sd=true
  