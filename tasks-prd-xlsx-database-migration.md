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

- [ ] 1.0 Project Setup and Configuration
  - [ ] 1.1 Initialize Node.js TypeScript project with `npm init` and configure package.json
  - [ ] 1.2 Install core dependencies: typescript, @types/node, ts-node, nodemon
  - [ ] 1.3 Install Google Sheets dependencies: googleapis, google-auth-library
  - [ ] 1.4 Install database dependencies: pg, @types/pg
  - [ ] 1.5 Install XLSX processing: xlsx, @types/xlsx
  - [ ] 1.6 Install logging: winston or similar logging framework
  - [ ] 1.7 Configure TypeScript with tsconfig.json (strict mode, ES2020 target)
  - [ ] 1.8 Set up project folder structure (src/, config/)
  - [ ] 1.9 Create .env.example with required environment variables template
  - [ ] 1.10 Set up npm scripts for build, start, and dev commands

- [ ] 2.0 Google Sheets Integration and XLSX Processing
  - [ ] 2.1 Create Google Cloud service account and download credentials JSON
  - [ ] 2.2 Implement Google Sheets API authentication in `src/google/sheets.ts`
  - [ ] 2.3 Create function to convert Google Sheets URLs to downloadable XLSX format
  - [ ] 2.4 Implement XLSX file download from Google Sheets URLs
  - [ ] 2.5 Create XLSX parsing logic in `src/processing/xlsx-parser.ts`
  - [ ] 2.6 Implement data extraction from XLSX worksheets
  - [ ] 2.7 Handle multiple sheets within single XLSX files if applicable
  - [ ] 2.8 Add error handling for invalid URLs or inaccessible sheets

- [ ] 3.0 Database Setup and Schema Management
  - [ ] 3.1 Create PostgreSQL connection logic in `src/database/connection.ts`
  - [ ] 3.2 Implement database creation functionality for "marketplaces-inhelp"
  - [ ] 3.3 Define table schema for rule sets in `src/database/schema.ts`
  - [ ] 3.4 Create configuration table schema for storing URL-to-table mappings
  - [ ] 3.5 Implement table creation functions with all 11 required TEXT columns
  - [ ] 3.6 Create configuration table initialization with initial mappings
  - [ ] 3.7 Add database connection pooling for performance
  - [ ] 3.8 Implement database health check functionality
  - [ ] 3.9 Add database transaction support for data integrity

- [ ] 4.0 Data Migration Logic and Processing
  - [ ] 4.1 Create data transformation logic in `src/processing/data-transformer.ts`
  - [ ] 4.2 Implement mapping from XLSX columns to database table columns
  - [ ] 4.3 Create batch data insertion functionality in `src/database/migration.ts`
  - [ ] 4.4 Implement data validation for required table structure
  - [ ] 4.5 Add progress tracking and reporting during migration
  - [ ] 4.6 Create data deduplication logic to handle re-runs
  - [ ] 4.7 Implement rollback functionality for failed migrations
  - [ ] 4.8 Add support for processing multiple rule sets in sequence

- [ ] 5.0 Command Line Interface and Error Handling
  - [ ] 5.1 Create CLI interface in `src/cli.ts` with argument parsing
  - [ ] 5.2 Implement structured logging in `src/utils/logger.ts`
  - [ ] 5.3 Create error collection system in `src/utils/error-handler.ts`
  - [ ] 5.4 Add progress reporting with detailed migration status
  - [ ] 5.5 Implement command-line options for different execution modes
  - [ ] 5.6 Create help documentation and usage instructions
  - [ ] 5.7 Add verbose/quiet mode options for different logging levels
  - [ ] 5.8 Implement graceful shutdown and cleanup on interruption
  - [ ] 5.9 Create final migration summary and success/failure reporting

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
  - [ ] 6.10 Create README.md with comprehensive setup and usage instructions

### Google Sheets files URLS

Tables name for this rules and the respective google sheets urls after ->:
rules_worten_pt -> https://docs.google.com/spreadsheets/d/13NijIiZQpwKbLndz76Mj7-MkNurehiNu/edit?usp=sharing&ouid=108323945213256378916&rtpof=true&sd=true
rules_pccomp_pt -> https://docs.google.com/spreadsheets/d/1EiycfU4p87g5bwP1lF0rS1kSZTLfq8Pj/edit?usp=drive_link&ouid=108323945213256378916&rtpof=true&sd=true
rules_pccomp_es -> https://docs.google.com/spreadsheets/d/1fVX8KA_SK0kW1TD-wSrRs0U6ahoP7DQI/edit?usp=drive_link&ouid=108323945213256378916&rtpof=true&sd=true
rules_carrefour_fr -> https://docs.google.com/spreadsheets/d/1C33ky1xGnfwvFYCGl6mbve6hmtxr_7Hf/edit?usp=drive_link&ouid=108323945213256378916&rtpof=true&sd=true
rules_carrefour_es -> https://docs.google.com/spreadsheets/d/1C2qm-ccZnhDMaXTVvrtr4VB-CbS0UD5l/edit?usp=drive_link&ouid=108323945213256378916&rtpof=true&sd=true
  