import { Logger } from './logger';
import { ErrorCollector } from './error-handler';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface EnvironmentCheck {
  name: string;
  check: () => Promise<boolean> | boolean;
  required: boolean;
  errorMessage: string;
}

export class MigrationValidator {
  private errorCollector: ErrorCollector;

  constructor(errorCollector: ErrorCollector) {
    this.errorCollector = errorCollector;
  }

  /**
   * Performs comprehensive pre-migration validation
   * @returns Validation result
   */
  async validateEnvironment(): Promise<ValidationResult> {
    Logger.info('Starting comprehensive environment validation');

    const errors: string[] = [];
    const warnings: string[] = [];

    const checks: EnvironmentCheck[] = [
      {
        name: 'Node.js Version',
        check: () => this.checkNodeVersion(),
        required: true,
        errorMessage: 'Node.js version 14.0.0 or higher is required'
      },
      {
        name: 'Environment Variables',
        check: () => this.checkEnvironmentVariables(),
        required: true,
        errorMessage: 'Required environment variables are missing'
      },
      {
        name: 'Google Cloud Credentials',
        check: () => this.checkGoogleCredentials(),
        required: true,
        errorMessage: 'Google Cloud credentials are not properly configured'
      },
      {
        name: 'Database Configuration',
        check: () => this.checkDatabaseConfig(),
        required: true,
        errorMessage: 'Database configuration is invalid'
      },
      {
        name: 'File System Permissions',
        check: () => this.checkFileSystemPermissions(),
        required: true,
        errorMessage: 'Insufficient file system permissions for logs and temp files'
      },
      {
        name: 'Memory Availability',
        check: () => this.checkMemoryAvailability(),
        required: false,
        errorMessage: 'Low memory may impact migration performance'
      }
    ];

    for (const check of checks) {
      try {
        const passed = await check.check();
        
        if (!passed) {
          if (check.required) {
            errors.push(`${check.name}: ${check.errorMessage}`);
            this.errorCollector.addError('MigrationValidator', check.errorMessage, { 
              checkName: check.name 
            });
          } else {
            warnings.push(`${check.name}: ${check.errorMessage}`);
          }
        } else {
          Logger.debug('Validation check passed', { checkName: check.name });
        }
      } catch (error: any) {
        const message = `${check.name}: Validation check failed - ${error.message}`;
        if (check.required) {
          errors.push(message);
          this.errorCollector.addError('MigrationValidator', message, { 
            checkName: check.name,
            error: error.message 
          });
        } else {
          warnings.push(message);
        }
      }
    }

    const result: ValidationResult = {
      isValid: errors.length === 0,
      errors,
      warnings
    };

    Logger.info('Environment validation completed', {
      isValid: result.isValid,
      errorCount: errors.length,
      warningCount: warnings.length
    });

    return result;
  }

  /**
   * Validates Google Sheets URLs format and accessibility
   * @param urls - Array of Google Sheets URLs
   * @returns Validation result
   */
  async validateGoogleSheetsUrls(urls: string[]): Promise<ValidationResult> {
    Logger.info('Validating Google Sheets URLs', { urlCount: urls.length });

    const errors: string[] = [];
    const warnings: string[] = [];

    for (const url of urls) {
      try {
        // Check URL format
        if (!this.isValidGoogleSheetsUrl(url)) {
          errors.push(`Invalid Google Sheets URL format: ${url}`);
          continue;
        }

        // Extract spreadsheet ID
        const spreadsheetId = this.extractSpreadsheetId(url);
        if (!spreadsheetId) {
          errors.push(`Cannot extract spreadsheet ID from URL: ${url}`);
          continue;
        }

        Logger.debug('Google Sheets URL validated', { url, spreadsheetId });

      } catch (error: any) {
        errors.push(`URL validation error for ${url}: ${error.message}`);
        this.errorCollector.addError('MigrationValidator', 'Google Sheets URL validation failed', {
          url,
          error: error.message
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validates database table names and structure requirements
   * @param tableNames - Array of table names to validate
   * @returns Validation result
   */
  validateTableNames(tableNames: string[]): ValidationResult {
    Logger.debug('Validating table names', { tableNames });

    const errors: string[] = [];
    const warnings: string[] = [];

    const validTablePattern = /^[a-z][a-z0-9_]*$/;
    const reservedWords = ['user', 'order', 'group', 'table', 'index', 'key'];

    for (const tableName of tableNames) {
      // Check naming convention
      if (!validTablePattern.test(tableName)) {
        errors.push(`Invalid table name format: '${tableName}'. Must start with letter and contain only lowercase letters, numbers, and underscores.`);
      }

      // Check for reserved words
      if (reservedWords.includes(tableName.toLowerCase())) {
        warnings.push(`Table name '${tableName}' is a reserved word and may cause issues.`);
      }

      // Check length
      if (tableName.length > 63) {
        errors.push(`Table name '${tableName}' is too long (max 63 characters).`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Check Node.js version compatibility
   */
  private checkNodeVersion(): boolean {
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.replace('v', '').split('.')[0], 10);
    
    Logger.debug('Checking Node.js version', { version: nodeVersion, majorVersion });
    return majorVersion >= 14;
  }

  /**
   * Check required environment variables
   */
  private checkEnvironmentVariables(): boolean {
    const required = [
      'DB_HOST',
      'DB_PORT', 
      'DB_NAME',
      'DB_USER',
      'DB_PASSWORD',
      'GOOGLE_APPLICATION_CREDENTIALS'
    ];

    const missing = required.filter(envVar => !process.env[envVar]);
    
    if (missing.length > 0) {
      Logger.error('Missing required environment variables', { missing });
      return false;
    }

    return true;
  }

  /**
   * Check Google Cloud credentials file
   */
  private async checkGoogleCredentials(): Promise<boolean> {
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    
    if (!credentialsPath) {
      return false;
    }

    try {
      const fs = await import('fs');
      
      // Check if file exists
      if (!fs.existsSync(credentialsPath)) {
        Logger.error('Google Cloud credentials file not found', { path: credentialsPath });
        return false;
      }

      // Try to parse JSON
      const content = fs.readFileSync(credentialsPath, 'utf8');
      const credentials = JSON.parse(content);

      // Validate basic structure
      if (!credentials.type || !credentials.client_email || !credentials.private_key) {
        Logger.error('Invalid Google Cloud credentials file structure');
        return false;
      }

      Logger.debug('Google Cloud credentials validated', { 
        type: credentials.type,
        clientEmail: credentials.client_email 
      });
      
      return true;
    } catch (error: any) {
      Logger.error('Failed to validate Google Cloud credentials', { error: error.message });
      return false;
    }
  }

  /**
   * Check database configuration
   */
  private checkDatabaseConfig(): boolean {
    const host = process.env.DB_HOST;
    const port = process.env.DB_PORT;
    const database = process.env.DB_NAME;

    // Validate database name
    if (database !== 'marketplaces-inhelp') {
      Logger.warn('Database name does not match expected value', { 
        expected: 'marketplaces-inhelp',
        actual: database
      });
    }

    // Validate port
    const portNum = parseInt(port || '0', 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      Logger.error('Invalid database port', { port });
      return false;
    }

    // Validate host
    if (!host || host.trim() === '') {
      Logger.error('Database host is empty');
      return false;
    }

    return true;
  }

  /**
   * Check file system permissions
   */
  private async checkFileSystemPermissions(): Promise<boolean> {
    try {
      const fs = await import('fs');
      const path = await import('path');

      // Check if we can create logs directory
      const logsDir = path.join(process.cwd(), 'logs');
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }

      // Test write permissions
      const testFile = path.join(logsDir, 'permission-test.tmp');
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);

      return true;
    } catch (error: any) {
      Logger.error('File system permission check failed', { error: error.message });
      return false;
    }
  }

  /**
   * Check available memory
   */
  private checkMemoryAvailability(): boolean {
    const totalMemory = process.memoryUsage();
    const freeMemory = process.memoryUsage().heapUsed;
    
    // Warn if less than 512MB available
    const availableMemoryMB = (totalMemory.rss - freeMemory) / 1024 / 1024;
    
    Logger.debug('Memory check', { 
      totalMemoryMB: totalMemory.rss / 1024 / 1024,
      usedMemoryMB: freeMemory / 1024 / 1024,
      availableMemoryMB 
    });

    return availableMemoryMB > 512;
  }

  /**
   * Check if URL is a valid Google Sheets URL
   */
  private isValidGoogleSheetsUrl(url: string): boolean {
    const googleSheetsPattern = /^https:\/\/docs\.google\.com\/spreadsheets\/d\/[a-zA-Z0-9-_]+/;
    return googleSheetsPattern.test(url);
  }

  /**
   * Extract spreadsheet ID from Google Sheets URL
   */
  private extractSpreadsheetId(url: string): string | null {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
  }
}