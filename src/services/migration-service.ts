import { Logger } from '../utils/logger';
import { ErrorCollector } from '../utils/error-handler';
import { GoogleSheetsService } from '../google/sheets';
import { XLSXParser } from '../processing/xlsx-parser';
import { DataTransformer } from '../processing/data-transformer';
import { DatabaseMigration, MigrationOptions } from '../database/migration';
import { INITIAL_TABLE_MAPPINGS } from '../database/schema';
import { CLIOptions } from '../cli';

export interface MigrationProgress {
  currentStep: string;
  stepsCompleted: number;
  totalSteps: number;
  tablesProcessed: number;
  totalTables: number;
  recordsProcessed: number;
  recordsMigrated: number;
  errors: number;
}

export interface MigrationSummary {
  success: boolean;
  totalTables: number;
  tablesProcessed: number;
  totalRecords: number;
  recordsMigrated: number;
  recordsSkipped: number;
  totalErrors: number;
  duration: number;
  tableResults: Array<{
    tableName: string;
    sourceUrl: string;
    recordsInserted: number;
    recordsSkipped: number;
    errors: string[];
    duration: number;
  }>;
}

export class MigrationService {
  private googleSheets: GoogleSheetsService;
  private xlsxParser: XLSXParser;
  private dataTransformer: DataTransformer;
  private databaseMigration: DatabaseMigration;
  private errorCollector: ErrorCollector;

  constructor(errorCollector: ErrorCollector) {
    this.errorCollector = errorCollector;
    this.googleSheets = new GoogleSheetsService();
    this.xlsxParser = new XLSXParser();
    this.dataTransformer = new DataTransformer();
    this.databaseMigration = new DatabaseMigration();
  }

  /**
   * Executes the complete migration process
   * @param options - CLI options
   * @returns Migration summary
   */
  async executeMigration(options: CLIOptions): Promise<MigrationSummary> {
    const startTime = Date.now();
    
    Logger.info('Starting complete migration process', { options });

    try {
      // Step 1: Setup and validation
      await this.setupAndValidate(options);

      // Step 2: Get migration configuration
      const configurations = await this.getMigrationConfiguration(options);

      // Step 3: Execute migrations for each table
      const tableResults = await this.processTables(configurations, options);

      // Step 4: Generate final summary
      const summary = this.generateMigrationSummary(tableResults, startTime);

      Logger.info('Migration process completed', { summary });
      return summary;

    } catch (error: any) {
      const duration = Date.now() - startTime;
      Logger.error('Migration process failed', { error: error.message, duration });
      
      this.errorCollector.addError('MigrationService', 'Complete migration failed', { 
        error: error.message 
      });

      return {
        success: false,
        totalTables: 0,
        tablesProcessed: 0,
        totalRecords: 0,
        recordsMigrated: 0,
        recordsSkipped: 0,
        totalErrors: this.errorCollector.getErrorCount(),
        duration,
        tableResults: [],
      };
    }
  }

  /**
   * Setup database and validate environment
   * @param options - CLI options
   */
  private async setupAndValidate(options: CLIOptions): Promise<void> {
    Logger.info('Setting up database and validating environment');

    // Setup database and configuration tables
    const setupSuccess = await this.databaseMigration.setupDatabase(this.errorCollector);
    if (!setupSuccess) {
      throw new Error('Database setup failed');
    }

    // Validate database connection
    const validationSuccess = await this.databaseMigration.validateDatabaseSetup(this.errorCollector);
    if (!validationSuccess) {
      throw new Error('Database validation failed');
    }

    // For config-only mode, we're done
    if (options.configOnly) {
      Logger.info('Config-only mode - setup completed');
      return;
    }

    Logger.info('Environment setup and validation completed successfully');
  }

  /**
   * Gets migration configuration based on CLI options
   * @param options - CLI options
   * @returns Array of table configurations
   */
  private async getMigrationConfiguration(options: CLIOptions): Promise<Array<{
    tableName: string;
    sourceUrl: string;
  }>> {
    if (options.configOnly) {
      return [];
    }

    // Get configuration from database
    const dbConfigurations = await this.databaseMigration.getMigrationConfiguration();
    
    let configurations = dbConfigurations.map(config => ({
      tableName: config.table_name,
      sourceUrl: config.google_sheets_url,
    }));

    // Filter by specific table if requested
    if (options.tableName) {
      configurations = configurations.filter(config => config.tableName === options.tableName);
      
      if (configurations.length === 0) {
        throw new Error(`Table '${options.tableName}' not found in configuration`);
      }
    }

    Logger.info('Migration configuration loaded', { 
      totalTables: configurations.length,
      specificTable: options.tableName || 'all'
    });

    return configurations;
  }

  /**
   * Process all configured tables
   * @param configurations - Table configurations
   * @param options - CLI options
   * @returns Array of table results
   */
  private async processTables(
    configurations: Array<{ tableName: string; sourceUrl: string }>,
    options: CLIOptions
  ): Promise<MigrationSummary['tableResults']> {
    const tableResults: MigrationSummary['tableResults'] = [];

    for (let i = 0; i < configurations.length; i++) {
      const config = configurations[i];
      const tableNumber = i + 1;

      Logger.info('Processing table', { 
        tableName: config.tableName, 
        tableNumber, 
        totalTables: configurations.length,
        sourceUrl: config.sourceUrl
      });

      try {
        const result = await this.processTable(config.tableName, config.sourceUrl, options);
        tableResults.push(result);

        Logger.info('Table processing completed', { 
          tableName: config.tableName,
          recordsInserted: result.recordsInserted,
          recordsSkipped: result.recordsSkipped,
          errors: result.errors.length
        });

      } catch (error: any) {
        Logger.error('Table processing failed', { 
          tableName: config.tableName, 
          error: error.message 
        });

        tableResults.push({
          tableName: config.tableName,
          sourceUrl: config.sourceUrl,
          recordsInserted: 0,
          recordsSkipped: 0,
          errors: [error.message],
          duration: 0,
        });
      }
    }

    return tableResults;
  }

  /**
   * Process a single table migration
   * @param tableName - Target table name
   * @param sourceUrl - Google Sheets URL
   * @param options - CLI options
   * @returns Table migration result
   */
  private async processTable(
    tableName: string, 
    sourceUrl: string, 
    options: CLIOptions
  ): Promise<MigrationSummary['tableResults'][0]> {
    const startTime = Date.now();

    try {
      // Step 1: Validate Google Sheets access
      Logger.debug('Validating Google Sheets access', { tableName, sourceUrl });
      const isAccessible = await this.googleSheets.validateSheetAccess(sourceUrl);
      if (!isAccessible) {
        throw new Error('Google Sheets URL is not accessible');
      }

      // Step 2: Download XLSX data
      Logger.debug('Downloading XLSX data', { tableName });
      const xlsxBuffer = await this.googleSheets.downloadXLSX(sourceUrl);

      // Step 3: Parse XLSX data
      Logger.debug('Parsing XLSX data', { tableName, bufferSize: xlsxBuffer.length });
      const parsedSheets = await this.xlsxParser.parseXLSXBuffer(
        xlsxBuffer, 
        tableName, 
        this.errorCollector
      );

      // Step 4: Transform data
      Logger.debug('Transforming data', { tableName, sheetsCount: parsedSheets.length });
      const transformResult = await this.dataTransformer.transformSheetsData(
        parsedSheets,
        tableName,
        this.errorCollector
      );

      // Step 5: Validate transformed data
      const validationResult = await this.dataTransformer.validateTransformedRecords(
        transformResult.records,
        tableName,
        this.errorCollector
      );

      // Step 6: Migrate to database
      const migrationOptions: MigrationOptions = {
        dryRun: options.dryRun,
        batchSize: 1000,
        skipExisting: true,
        truncateTable: false,
      };

      Logger.debug('Starting database migration', { 
        tableName, 
        recordCount: validationResult.validRecords.length 
      });

      const migrationResult = await this.databaseMigration.migrateToTable(
        tableName,
        validationResult.validRecords,
        migrationOptions,
        this.errorCollector
      );

      const duration = Date.now() - startTime;

      return {
        tableName,
        sourceUrl,
        recordsInserted: migrationResult.recordsInserted,
        recordsSkipped: migrationResult.recordsSkipped + validationResult.invalidRecords,
        errors: [
          ...transformResult.errors,
          ...validationResult.errors,
          ...migrationResult.errors
        ],
        duration,
      };

    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.errorCollector.addError('MigrationService', `Table processing failed: ${tableName}`, {
        tableName,
        sourceUrl,
        error: error.message,
      });

      return {
        tableName,
        sourceUrl,
        recordsInserted: 0,
        recordsSkipped: 0,
        errors: [error.message],
        duration,
      };
    }
  }

  /**
   * Generate final migration summary
   * @param tableResults - Results from all table migrations
   * @param startTime - Migration start time
   * @returns Complete migration summary
   */
  private generateMigrationSummary(
    tableResults: MigrationSummary['tableResults'],
    startTime: number
  ): MigrationSummary {
    const duration = Date.now() - startTime;

    const summary: MigrationSummary = {
      success: true,
      totalTables: tableResults.length,
      tablesProcessed: tableResults.length,
      totalRecords: 0,
      recordsMigrated: 0,
      recordsSkipped: 0,
      totalErrors: this.errorCollector.getErrorCount(),
      duration,
      tableResults,
    };

    // Calculate totals
    for (const result of tableResults) {
      summary.totalRecords += result.recordsInserted + result.recordsSkipped;
      summary.recordsMigrated += result.recordsInserted;
      summary.recordsSkipped += result.recordsSkipped;
      
      if (result.errors.length > 0) {
        summary.success = false;
      }
    }

    // Check if migration was successful
    if (this.errorCollector.hasErrors()) {
      summary.success = false;
    }

    Logger.info('Migration summary generated', {
      success: summary.success,
      totalTables: summary.totalTables,
      recordsMigrated: summary.recordsMigrated,
      totalErrors: summary.totalErrors,
      durationMs: summary.duration,
    });

    return summary;
  }

  /**
   * Validates all Google Sheets URLs
   * @returns Validation results
   */
  async validateAllSheets(): Promise<{ valid: string[]; invalid: string[] }> {
    Logger.info('Validating all configured Google Sheets URLs');

    const configurations = await this.databaseMigration.getMigrationConfiguration();
    const urls = configurations.map(config => config.google_sheets_url);

    const result = await this.googleSheets.validateAllSheets(urls, this.errorCollector);

    Logger.info('Sheet validation completed', {
      totalSheets: urls.length,
      validSheets: result.valid.length,
      invalidSheets: result.invalid.length,
    });

    return result;
  }

  /**
   * Gets current database status for all tables
   * @returns Database status information
   */
  async getDatabaseStatus(): Promise<Array<{
    tableName: string;
    exists: boolean;
    recordCount: number;
  }>> {
    Logger.info('Getting database status for all tables');

    const configurations = await this.databaseMigration.getMigrationConfiguration();
    const status = [];

    for (const config of configurations) {
      try {
        const recordCount = await this.databaseMigration.getTableRecordCount(config.table_name);
        
        status.push({
          tableName: config.table_name,
          exists: true,
          recordCount,
        });
      } catch (error: any) {
        status.push({
          tableName: config.table_name,
          exists: false,
          recordCount: 0,
        });
      }
    }

    Logger.info('Database status retrieved', { 
      tables: status.length,
      totalRecords: status.reduce((sum, table) => sum + table.recordCount, 0)
    });

    return status;
  }

  /**
   * Closes all connections and cleans up resources
   */
  async cleanup(): Promise<void> {
    Logger.debug('Cleaning up migration service resources');
    
    try {
      await this.databaseMigration.close();
      Logger.debug('Migration service cleanup completed');
    } catch (error: any) {
      Logger.error('Error during migration service cleanup', { error: error.message });
    }
  }
}