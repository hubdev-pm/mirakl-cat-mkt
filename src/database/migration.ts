import { Logger } from '../utils/logger';
import { ErrorCollector } from '../utils/error-handler';
import { DatabaseConnection } from './connection';
import { RuleRecord, generateCreateTableSQL, generateConfigurationTableSQL, generateInsertConfigurationSQL } from './schema';
import { appConfig } from '../config/environment';

export interface MigrationResult {
  tableName: string;
  recordsInserted: number;
  recordsSkipped: number;
  errors: string[];
  duration: number;
}

export interface MigrationOptions {
  dryRun?: boolean;
  batchSize?: number;
  skipExisting?: boolean;
  truncateTable?: boolean;
}

export class DatabaseMigration {
  private db: DatabaseConnection;

  constructor() {
    this.db = DatabaseConnection.getInstance();
  }

  /**
   * Sets up the database and configuration tables
   * @param errorCollector - Error collector instance
   * @returns Setup success status
   */
  async setupDatabase(errorCollector: ErrorCollector): Promise<boolean> {
    try {
      Logger.info('Setting up database and configuration tables');

      // Create database if it doesn't exist
      await this.db.createDatabase();

      // Create configuration table
      await this.createConfigurationTable();

      // Initialize configuration with URL mappings
      await this.initializeConfiguration();

      Logger.info('Database setup completed successfully');
      return true;
    } catch (error: any) {
      const message = 'Failed to setup database';
      Logger.error(message, { error: error.message });
      errorCollector.addError('DatabaseMigration', message, { error: error.message });
      return false;
    }
  }

  /**
   * Creates a rule table
   * @param tableName - Name of the table to create
   * @param errorCollector - Error collector instance
   * @returns Creation success status
   */
  async createRuleTable(tableName: string, errorCollector: ErrorCollector): Promise<boolean> {
    try {
      Logger.info('Creating rule table', { tableName });

      const sql = generateCreateTableSQL(tableName);
      await this.db.query(sql);

      Logger.info('Rule table created successfully', { tableName });
      return true;
    } catch (error: any) {
      const message = `Failed to create table ${tableName}`;
      Logger.error(message, { error: error.message, tableName });
      errorCollector.addError('DatabaseMigration', message, { tableName, error: error.message });
      return false;
    }
  }

  /**
   * Migrates data to a specific table
   * @param tableName - Target table name
   * @param records - Records to insert
   * @param options - Migration options
   * @param errorCollector - Error collector instance
   * @returns Migration result
   */
  async migrateToTable(
    tableName: string,
    records: RuleRecord[],
    options: MigrationOptions,
    errorCollector: ErrorCollector
  ): Promise<MigrationResult> {
    const startTime = Date.now();
    
    try {
      Logger.info('Starting table migration', { 
        tableName, 
        recordCount: records.length, 
        options 
      });

      // Create table if it doesn't exist
      await this.createRuleTable(tableName, errorCollector);

      // Truncate table if requested
      if (options.truncateTable && !options.dryRun) {
        await this.truncateTable(tableName);
      }

      // Perform the migration
      const result = await this.insertRecords(tableName, records, options, errorCollector);

      const duration = Date.now() - startTime;
      const finalResult: MigrationResult = {
        ...result,
        duration,
      };

      Logger.info('Table migration completed', { tableName, ...finalResult });
      return finalResult;

    } catch (error: any) {
      const duration = Date.now() - startTime;
      const message = `Migration failed for table ${tableName}`;
      Logger.error(message, { error: error.message, tableName, duration });
      errorCollector.addError('DatabaseMigration', message, { tableName, error: error.message });

      return {
        tableName,
        recordsInserted: 0,
        recordsSkipped: records.length,
        errors: [error.message],
        duration,
      };
    }
  }

  /**
   * Migrates large datasets using streaming approach
   * @param tableName - Target table name
   * @param dataTransformer - Data transformer with cached data
   * @param options - Migration options
   * @param errorCollector - Error collector instance
   * @returns Migration result
   */
  async migrateToTableStreaming(
    tableName: string,
    dataTransformer: any, // DataTransformer type
    options: MigrationOptions,
    errorCollector: ErrorCollector
  ): Promise<MigrationResult> {
    const startTime = Date.now();
    
    try {
      Logger.info('Starting streaming table migration', { 
        tableName, 
        options,
        note: 'Processing large dataset with memory-efficient streaming'
      });

      // Create table if it doesn't exist
      await this.createRuleTable(tableName, errorCollector);

      // Truncate table if requested
      if (options.truncateTable && !options.dryRun) {
        await this.truncateTable(tableName);
      }

      // Perform streaming migration
      const result = await this.insertRecordsStreaming(tableName, dataTransformer, options, errorCollector);

      const duration = Date.now() - startTime;
      const finalResult: MigrationResult = {
        ...result,
        duration,
      };

      // Clear cached data to free memory
      dataTransformer.clearCachedSheetData();

      Logger.info('Streaming table migration completed', { tableName, ...finalResult });
      return finalResult;

    } catch (error: any) {
      const duration = Date.now() - startTime;
      const message = `Streaming migration failed for table ${tableName}`;
      Logger.error(message, { error: error.message, tableName, duration });
      errorCollector.addError('DatabaseMigration', message, { tableName, error: error.message });

      // Clear cached data even on error
      dataTransformer.clearCachedSheetData();

      return {
        tableName,
        recordsInserted: 0,
        recordsSkipped: 0,
        errors: [error.message],
        duration,
      };
    }
  }

  /**
   * Inserts records using streaming approach for large datasets
   * @param tableName - Target table name
   * @param dataTransformer - Data transformer with cached data
   * @param options - Migration options
   * @param errorCollector - Error collector instance
   * @returns Insertion results
   */
  private async insertRecordsStreaming(
    tableName: string,
    dataTransformer: any, // DataTransformer type
    options: MigrationOptions,
    errorCollector: ErrorCollector
  ): Promise<Omit<MigrationResult, 'duration'>> {
    const batchSize = options.batchSize || 500; // Smaller batches for streaming
    const errors: string[] = [];
    let recordsInserted = 0;
    let recordsSkipped = 0;
    let batchNumber = 0;

    if (options.dryRun) {
      Logger.info('Dry run mode - streaming without database changes', { tableName });
      
      // Count records in dry run mode
      let totalRecords = 0;
      for (const batch of dataTransformer.streamRecordsFromCache(batchSize)) {
        totalRecords += batch.length;
      }
      
      return {
        tableName,
        recordsInserted: totalRecords,
        recordsSkipped: 0,
        errors: [],
      };
    }

    try {
      // Stream records in batches
      for (const batch of dataTransformer.streamRecordsFromCache(batchSize)) {
        batchNumber++;
        
        try {
          Logger.debug('Processing streaming batch', { 
            tableName, 
            batchNumber, 
            batchSize: batch.length,
            recordsProcessedSoFar: recordsInserted + recordsSkipped
          });

          const result = await this.insertBatch(tableName, batch, options.skipExisting || false);
          recordsInserted += result.inserted;
          recordsSkipped += result.skipped;

          // Log progress for large datasets
          if (batchNumber % 10 === 0) {
            Logger.info('Streaming migration progress', {
              tableName,
              batchesProcessed: batchNumber,
              recordsInserted,
              recordsSkipped,
              memoryUsage: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`
            });
          }

        } catch (batchError: any) {
          Logger.error('Streaming batch failed', { 
            tableName, 
            batchNumber, 
            error: batchError.message 
          });
          errors.push(`Batch ${batchNumber}: ${batchError.message}`);
          recordsSkipped += batch.length;
        }
      }

      Logger.info('Streaming insertion completed', {
        tableName,
        totalBatches: batchNumber,
        recordsInserted,
        recordsSkipped,
        errors: errors.length
      });

      return {
        tableName,
        recordsInserted,
        recordsSkipped,
        errors,
      };

    } catch (error: any) {
      Logger.error('Streaming insertion failed', { 
        tableName, 
        error: error.message,
        batchesProcessed: batchNumber
      });
      
      return {
        tableName,
        recordsInserted,
        recordsSkipped,
        errors: [error.message],
      };
    }
  }

  /**
   * Inserts records into a table with batching
   * @param tableName - Target table name
   * @param records - Records to insert
   * @param options - Migration options
   * @param errorCollector - Error collector instance
   * @returns Insertion results
   */
  private async insertRecords(
    tableName: string,
    records: RuleRecord[],
    options: MigrationOptions,
    errorCollector: ErrorCollector
  ): Promise<Omit<MigrationResult, 'duration'>> {
    const batchSize = options.batchSize || appConfig.migration.batchSize;
    const errors: string[] = [];
    let recordsInserted = 0;
    let recordsSkipped = 0;

    if (options.dryRun) {
      Logger.info('Dry run mode - no actual database changes will be made', { 
        tableName, 
        recordCount: records.length 
      });
      return {
        tableName,
        recordsInserted: records.length, // Simulate successful insertion
        recordsSkipped: 0,
        errors: [],
      };
    }

    // Process records in batches
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(records.length / batchSize);

      try {
        Logger.debug('Processing batch', { 
          tableName, 
          batchNumber, 
          totalBatches, 
          batchSize: batch.length 
        });

        const batchResult = await this.insertBatch(tableName, batch, options);
        recordsInserted += batchResult.inserted;
        recordsSkipped += batchResult.skipped;
        errors.push(...batchResult.errors);

        // Log progress
        const progress = Math.round(((i + batch.length) / records.length) * 100);
        Logger.info('Batch processed', { 
          tableName, 
          batchNumber, 
          totalBatches, 
          progress: `${progress}%`,
          inserted: batchResult.inserted,
          skipped: batchResult.skipped,
        });

      } catch (error: any) {
        const message = `Failed to process batch ${batchNumber} for table ${tableName}`;
        Logger.error(message, { error: error.message, tableName, batchNumber });
        errorCollector.addError('DatabaseMigration', message, { 
          tableName, 
          batchNumber, 
          error: error.message 
        });
        
        errors.push(`Batch ${batchNumber}: ${error.message}`);
        recordsSkipped += batch.length;
      }
    }

    return {
      tableName,
      recordsInserted,
      recordsSkipped,
      errors,
    };
  }

  /**
   * Inserts a batch of records
   * @param tableName - Target table name
   * @param batch - Batch of records
   * @param options - Migration options
   * @returns Batch insertion results
   */
  private async insertBatch(
    tableName: string, 
    batch: RuleRecord[], 
    options: MigrationOptions
  ): Promise<{ inserted: number; skipped: number; errors: string[] }> {
    const columns = [
      'code', 'description', 'label', 'requirement_level', 'roles', 'type', 
      'validations', 'variant', 'codigo-categoria-mirakl', 'nome-categoria-mirakl', 
      'parent_code-categoria-mirakl'
    ];

    // Build the INSERT query with conflict handling
    const columnsList = columns.map(col => `"${col}"`).join(', ');
    const placeholders = batch.map((_, index) => {
      const recordPlaceholders = columns.map((_, colIndex) => `$${index * columns.length + colIndex + 1}`);
      return `(${recordPlaceholders.join(', ')})`;
    }).join(', ');

    // Since id is auto-increment and unique, we no longer need conflict resolution
    // Records will be inserted as new entries each time
    const conflictAction = '';

    const sql = `
      INSERT INTO "${tableName}" (${columnsList})
      VALUES ${placeholders}
      ${conflictAction}
      RETURNING "id"
    `;

    // Flatten values for parameterized query
    const values: string[] = [];
    for (const record of batch) {
      for (const column of columns) {
        values.push(record[column as keyof RuleRecord] || '');
      }
    }

    try {
      const result = await this.db.query(sql, values);
      const inserted = result.rowCount || 0;
      const skipped = batch.length - inserted;

      Logger.debug('Batch insertion completed', { 
        tableName, 
        batchSize: batch.length, 
        inserted, 
        skipped 
      });

      return { inserted, skipped, errors: [] };

    } catch (error: any) {
      Logger.error('Batch insertion failed', { 
        tableName, 
        batchSize: batch.length, 
        error: error.message 
      });
      
      return { 
        inserted: 0, 
        skipped: batch.length, 
        errors: [error.message] 
      };
    }
  }

  /**
   * Truncates a table
   * @param tableName - Table to truncate
   */
  private async truncateTable(tableName: string): Promise<void> {
    Logger.warn('Truncating table', { tableName });
    await this.db.query(`TRUNCATE TABLE "${tableName}" RESTART IDENTITY`);
    Logger.info('Table truncated successfully', { tableName });
  }

  /**
   * Creates the configuration table
   */
  private async createConfigurationTable(): Promise<void> {
    Logger.debug('Creating configuration table');
    const sql = generateConfigurationTableSQL();
    await this.db.query(sql);
    Logger.debug('Configuration table created/verified');
  }

  /**
   * Initializes configuration with default URL mappings
   */
  private async initializeConfiguration(): Promise<void> {
    Logger.debug('Initializing configuration table with URL mappings');
    const sql = generateInsertConfigurationSQL();
    const result = await this.db.query(sql);
    Logger.debug('Configuration initialization completed', { rowsAffected: result.rowCount });
  }

  /**
   * Gets migration configuration from database
   * @returns Array of table configurations
   */
  async getMigrationConfiguration(): Promise<Array<{ table_name: string; google_sheets_url: string }>> {
    Logger.debug('Fetching migration configuration');
    
    const sql = 'SELECT table_name, google_sheets_url FROM "migration_configuration" ORDER BY table_name';
    const result = await this.db.query(sql);
    
    Logger.debug('Migration configuration fetched', { configCount: result.rows.length });
    return result.rows;
  }

  /**
   * Gets record count for a table
   * @param tableName - Table name
   * @returns Record count
   */
  async getTableRecordCount(tableName: string): Promise<number> {
    try {
      const sql = `SELECT COUNT(*) as count FROM "${tableName}"`;
      const result = await this.db.query(sql);
      return parseInt(result.rows[0]?.count || '0', 10);
    } catch (error: any) {
      Logger.warn('Failed to get table record count', { tableName, error: error.message });
      return 0;
    }
  }

  /**
   * Validates database connection and setup
   * @param errorCollector - Error collector instance
   * @returns Validation success status
   */
  async validateDatabaseSetup(errorCollector: ErrorCollector): Promise<boolean> {
    try {
      Logger.info('Validating database setup');

      // Test database connection
      const isHealthy = await this.db.healthCheck();
      if (!isHealthy) {
        throw new Error('Database health check failed');
      }

      // Check if configuration table exists
      const configExists = await this.tableExists('migration_configuration');
      if (!configExists) {
        throw new Error('Configuration table does not exist');
      }

      Logger.info('Database setup validation passed');
      return true;
    } catch (error: any) {
      const message = 'Database setup validation failed';
      Logger.error(message, { error: error.message });
      errorCollector.addError('DatabaseMigration', message, { error: error.message });
      return false;
    }
  }

  /**
   * Checks if a table exists
   * @param tableName - Table name to check
   * @returns Table existence status
   */
  private async tableExists(tableName: string): Promise<boolean> {
    const sql = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      )
    `;
    
    const result = await this.db.query(sql, [tableName]);
    return result.rows[0]?.exists || false;
  }

  /**
   * Closes database connections
   */
  async close(): Promise<void> {
    await this.db.close();
  }
}