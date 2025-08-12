import { Logger } from './logger';

export interface MigrationError {
  source: string;
  message: string;
  details?: any;
  timestamp: Date;
}

export class ErrorCollector {
  private errors: MigrationError[] = [];

  addError(source: string, message: string, details?: any): void {
    const error: MigrationError = {
      source,
      message,
      details,
      timestamp: new Date(),
    };
    this.errors.push(error);
    Logger.error(`[${source}] ${message}`, { details, timestamp: error.timestamp });
  }

  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  getErrors(): MigrationError[] {
    return [...this.errors];
  }

  getErrorCount(): number {
    return this.errors.length;
  }

  getErrorsBySource(source: string): MigrationError[] {
    return this.errors.filter(error => error.source === source);
  }

  clear(): void {
    this.errors = [];
  }

  generateReport(): string {
    if (this.errors.length === 0) {
      return 'No errors occurred during migration.';
    }

    let report = `Migration completed with ${this.errors.length} error(s):\n\n`;
    
    // Group errors by source
    const errorsBySource = new Map<string, MigrationError[]>();
    
    this.errors.forEach(error => {
      if (!errorsBySource.has(error.source)) {
        errorsBySource.set(error.source, []);
      }
      errorsBySource.get(error.source)!.push(error);
    });

    errorsBySource.forEach((errors, source) => {
      report += `${source} (${errors.length} errors):\n`;
      errors.forEach((error, index) => {
        report += `  ${index + 1}. ${error.message}\n`;
        if (error.details) {
          report += `     Details: ${JSON.stringify(error.details, null, 2)}\n`;
        }
        report += `     Time: ${error.timestamp.toISOString()}\n\n`;
      });
    });

    return report;
  }

  logFinalReport(): void {
    const report = this.generateReport();
    if (this.hasErrors()) {
      Logger.error('Migration Error Report', { report });
      console.error('\n' + '='.repeat(60));
      console.error('MIGRATION ERROR REPORT');
      console.error('='.repeat(60));
      console.error(report);
      console.error('='.repeat(60) + '\n');
    } else {
      Logger.info('Migration completed successfully with no errors');
      console.log('\n' + '='.repeat(60));
      console.log('MIGRATION SUCCESS');
      console.log('='.repeat(60));
      console.log('All data has been migrated successfully with zero errors.');
      console.log('='.repeat(60) + '\n');
    }
  }
}