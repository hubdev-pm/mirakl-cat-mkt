# Product Requirements Document: XLSX to Database Migration System

## Introduction/Overview

This feature provides a Node.js TypeScript command-line tool that converts technical rule files from Google Sheets (XLSX format) to PostgreSQL database tables with zero data loss. The system addresses the critical need for preserving data integrity when migrating rule sets that serve as the foundation for downstream business processes. Manual migration processes are time-consuming, error-prone, and don't guarantee the precision required for rule-based systems.

**Goal:** Create a reliable, repeatable migration system that ensures 100% data accuracy when converting Google Sheets rule files to PostgreSQL database tables.

## Goals

1. **Zero Data Loss:** Achieve 100% accuracy in data conversion with no information lost or corrupted during migration
2. **Automation:** Eliminate manual data entry and reduce migration time from hours to minutes
3. **Reliability:** Provide consistent, repeatable results for rule set migrations
4. **Technical Integration:** Seamlessly integrate with existing Google Cloud infrastructure
5. **Developer-Friendly:** Create a tool that technical team members can easily operate and maintain

## User Stories

- **As a DevOps engineer**, I want to run a single command to migrate all rule files from Google Sheets to the database, so that I can complete migrations quickly and reliably.

- **As a developer**, I want to configure which Google Sheets correspond to which database tables, so that I can manage multiple rule sets efficiently.

- **As a technical lead**, I want to verify that all data has been migrated with 100% accuracy, so that I can confidently use the database for downstream processes.

- **As a system administrator**, I want to run this tool in both local development and production environments, so that I can test migrations before deploying them.

## Functional Requirements

1. **The system must connect to Google Sheets using provided URLs and download XLSX data.**
2. **The system must create a PostgreSQL database named "marketplaces-inhelp" if it doesn't exist.**
3. **The system must create tables with the following schema for each rule set:**
   - code (TEXT)
   - description (TEXT)
   - label (TEXT)
   - requirement_level (TEXT)
   - roles (TEXT)
   - type (TEXT)
   - validations (TEXT)
   - variant (TEXT)
   - codigo-categoria-mirakl (TEXT)
   - nome-categoria-mirakl (TEXT)
   - parent_code-categoria-mirakl (TEXT)
4. **The system must support the following initial table mappings:**
   - rules_worten_pt
   - rules_pccomp_pt
   - rules_pccomp_es
   - rules_carrefour_fr
   - rules_carrefour_es
5. **The system must store Google Sheets URLs and table mappings in a configuration database table.**
6. **The system must provide a command-line interface for initiating migrations.**
7. **The system must use Docker for containerization and environment consistency.**
8. **The system must connect to Google Cloud PostgreSQL instance using project credentials.**
9. **The system must collect and report all errors at the end of processing rather than stopping on first error.**
10. **The system must provide detailed logging of migration progress and results.**
11. **The system must support running in both local development and production environments.**

## Non-Goals (Out of Scope)

- **Web-based user interface** - This is a command-line tool only
- **Real-time synchronization** - This is for one-time or on-demand migrations
- **Data transformation or cleaning** - System assumes source data integrity
- **User authentication management** - Relies on existing Google Cloud credentials
- **Scheduled automated runs** - Manual execution only
- **Data validation beyond basic structure checks** - Trusts source data integrity
- **Support for other data sources** - Google Sheets only
- **GUI or visual reporting** - Command-line output only

## Design Considerations

- **Technology Stack:** Node.js with TypeScript for type safety and maintainability
- **Database:** PostgreSQL for robust data storage
- **Containerization:** Docker for consistent deployment across environments
- **Google Cloud Integration:** Utilize existing project "mirakl-catalogue-marketplaces" (ID: mirakl-catalogue-marketplaces)
- **Configuration Management:** Store table mappings and URLs in database configuration table for easy maintenance
- **Error Reporting:** Comprehensive error collection and end-of-process reporting

## Technical Considerations

- **Dependencies:** Google Sheets API, PostgreSQL client library, XLSX parsing library
- **Authentication:** Google Cloud service account credentials for Sheets access
- **Database Connection:** PostgreSQL connection string for Google Cloud SQL instance
- **Docker Configuration:** Multi-stage build for production optimization
- **Environment Variables:** Database credentials, Google Cloud project settings
- **Logging Framework:** Structured logging for debugging and monitoring
- **Error Handling:** Graceful failure handling with detailed error messages

## Success Metrics

- **Primary:** 100% data accuracy - zero records lost or corrupted during migration
- **Secondary:** Migration completion time under 5 minutes for all rule sets
- **Tertiary:** Zero failed migrations due to system errors
- **Quality:** All database constraints and data types correctly maintained

## Open Questions

1. **Google Sheets Access Permissions:** Do we need to set up specific service account permissions for accessing the provided Google Sheets URLs?
2. **Database Instance Configuration:** Should the system auto-create the Google Cloud SQL PostgreSQL instance, or will it be manually provisioned?
3. **Data Volume:** What is the expected number of rows per sheet to ensure appropriate memory and processing allocation?
4. **Rollback Strategy:** Should the system include capabilities to rollback migrations if issues are discovered post-migration?
5. **Configuration Updates:** How should new rule sets and Google Sheets URLs be added to the configuration table after initial setup?

## Implementation Priority

**Phase 1:** Core migration functionality with hard-coded configurations
**Phase 2:** Database-driven configuration management
**Phase 3:** Enhanced error reporting and logging
**Phase 4:** Docker containerization and deployment preparation