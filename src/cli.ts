#!/usr/bin/env node

import { Logger } from './utils/logger';
import { ErrorCollector } from './utils/error-handler';

export interface CLIOptions {
  help: boolean;
  verbose: boolean;
  quiet: boolean;
  dryRun: boolean;
  tableName?: string;
  configOnly: boolean;
}

export class CLI {
  private errorCollector: ErrorCollector;

  constructor() {
    this.errorCollector = new ErrorCollector();
  }

  /**
   * Parses command line arguments
   * @param args - Command line arguments
   * @returns Parsed CLI options
   */
  parseArguments(args: string[]): CLIOptions {
    const options: CLIOptions = {
      help: false,
      verbose: false,
      quiet: false,
      dryRun: false,
      configOnly: false,
    };

    for (let i = 2; i < args.length; i++) {
      const arg = args[i];

      switch (arg) {
        case '--help':
        case '-h':
          options.help = true;
          break;
        
        case '--verbose':
        case '-v':
          options.verbose = true;
          break;
        
        case '--quiet':
        case '-q':
          options.quiet = true;
          break;
        
        case '--dry-run':
        case '-d':
          options.dryRun = true;
          break;
        
        case '--config-only':
          options.configOnly = true;
          break;
        
        case '--table':
        case '-t':
          if (i + 1 < args.length) {
            options.tableName = args[i + 1];
            i++; // Skip next argument as it's the table name
          } else {
            throw new Error('--table option requires a table name');
          }
          break;
        
        default:
          if (arg.startsWith('-')) {
            throw new Error(`Unknown option: ${arg}`);
          }
          break;
      }
    }

    return options;
  }

  /**
   * Displays help information
   */
  showHelp(): void {
    const helpText = `
XLSX to Database Migration Tool

USAGE:
  npm start [OPTIONS]

OPTIONS:
  -h, --help          Show this help message
  -v, --verbose       Enable verbose logging
  -q, --quiet         Enable quiet mode (errors only)
  -d, --dry-run       Run migration simulation without actual database changes
  -t, --table NAME    Migrate specific table only
  --config-only       Only setup configuration tables, don't migrate data

EXAMPLES:
  npm start                           # Migrate all configured tables
  npm start --verbose                 # Migrate with detailed logging
  npm start --table rules_worten_pt   # Migrate only the worten_pt rules
  npm start --dry-run                 # Preview migration without changes
  npm start --config-only             # Setup configuration tables only

ENVIRONMENT VARIABLES:
  See .env.example for required environment variables

For more information, visit: https://github.com/your-repo/xlsx-database-migration
`;

    console.log(helpText);
  }

  /**
   * Sets up logging based on CLI options
   * @param options - CLI options
   */
  setupLogging(options: CLIOptions): void {
    if (options.verbose) {
      // Set verbose logging
      Logger.getInstance().level = 'debug';
      Logger.info('Verbose logging enabled');
    } else if (options.quiet) {
      // Set quiet logging (errors only)
      Logger.getInstance().level = 'error';
    } else {
      // Default logging level
      Logger.getInstance().level = 'info';
    }

    Logger.info('XLSX to Database Migration Tool started', {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      options: {
        verbose: options.verbose,
        quiet: options.quiet,
        dryRun: options.dryRun,
        tableName: options.tableName,
        configOnly: options.configOnly,
      },
    });
  }

  /**
   * Validates CLI options and environment
   * @param options - CLI options
   * @returns Validation result
   */
  async validateOptions(options: CLIOptions): Promise<{
    isValid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    try {
      // Validate environment variables
      const requiredEnvVars = [
        'DB_HOST',
        'DB_PORT',
        'DB_NAME',
        'DB_USER',
        'DB_PASSWORD',
        'GOOGLE_APPLICATION_CREDENTIALS',
      ];

      for (const envVar of requiredEnvVars) {
        if (!process.env[envVar]) {
          errors.push(`Missing required environment variable: ${envVar}`);
        }
      }

      // Validate conflicting options
      if (options.verbose && options.quiet) {
        errors.push('Cannot use both --verbose and --quiet options');
      }

      // Validate table name if provided
      if (options.tableName) {
        const validTableNames = [
          'rules_worten_pt',
          'rules_pccomp_pt',
          'rules_pccomp_es',
          'rules_carrefour_fr',
          'rules_carrefour_es',
        ];

        if (!validTableNames.includes(options.tableName)) {
          errors.push(
            `Invalid table name: ${options.tableName}. Valid options: ${validTableNames.join(', ')}`
          );
        }
      }

      // Check if Google Cloud credentials file exists
      if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        // TODO: Add file existence check once fs module is imported
        // const fs = require('fs');
        // if (!fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
        //   errors.push(`Google Cloud credentials file not found: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`);
        // }
      }

    } catch (error: any) {
      errors.push(`Validation error: ${error.message}`);
    }

    if (errors.length > 0) {
      errors.forEach(error => {
        this.errorCollector.addError('CLI', error);
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Main CLI entry point
   * @param args - Command line arguments
   */
  async run(args: string[]): Promise<number> {
    try {
      const options = this.parseArguments(args);

      if (options.help) {
        this.showHelp();
        return 0;
      }

      this.setupLogging(options);

      const validation = await this.validateOptions(options);
      if (!validation.isValid) {
        Logger.error('CLI validation failed', { errors: validation.errors });
        validation.errors.forEach(error => console.error(`Error: ${error}`));
        console.error('\nUse --help for usage information');
        return 1;
      }

      Logger.info('CLI validation passed, starting migration process');

      // TODO: Import and run the main migration logic
      // const migrationService = new MigrationService(this.errorCollector);
      // await migrationService.run(options);

      // For now, just show that CLI parsing works
      console.log('CLI setup completed successfully!');
      console.log('Migration logic will be implemented in the next phase.');

      this.errorCollector.logFinalReport();

      return this.errorCollector.hasErrors() ? 1 : 0;

    } catch (error: any) {
      Logger.error('CLI execution failed', { error: error.message });
      console.error(`Fatal error: ${error.message}`);
      return 1;
    }
  }
}

// Export for testing and main entry point
export default CLI;

// If this file is run directly, execute the CLI
if (require.main === module) {
  const cli = new CLI();
  cli.run(process.argv).then(exitCode => {
    process.exit(exitCode);
  }).catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}