#!/usr/bin/env ts-node
/**
 * Database Migration CLI Tool
 * 
 * This script provides a command-line interface for managing database migrations.
 * It ensures the database schema is always up-to-date and provides rollback capabilities.
 */

import { config } from 'dotenv';
import { DatabaseMigrations } from '../database/migrations';
import { Logger } from '../utils/logger';

// Load environment variables
config();

interface CLIArgs {
  command: string;
  force?: boolean;
  verbose?: boolean;
}

class MigrationCLI {
  private migrations: DatabaseMigrations;

  constructor() {
    this.migrations = new DatabaseMigrations();
  }

  /**
   * Parse command line arguments
   */
  private parseArgs(args: string[]): CLIArgs {
    const command = args[2] || 'up';
    const force = args.includes('--force') || args.includes('-f');
    const verbose = args.includes('--verbose') || args.includes('-v');

    return { command, force, verbose };
  }

  /**
   * Display help information
   */
  private showHelp(): void {
    console.log(`
Database Migration CLI Tool

USAGE:
  npm run migrate [COMMAND] [OPTIONS]

COMMANDS:
  up       Run all pending migrations (default)
  status   Show migration status
  reset    Reset entire migration system (destructive)
  help     Show this help message

OPTIONS:
  -f, --force     Force operation (skip confirmations)
  -v, --verbose   Enable verbose logging

EXAMPLES:
  npm run migrate              # Run all pending migrations
  npm run migrate status       # Show current migration status
  npm run migrate up --verbose # Run migrations with detailed output
  npm run migrate reset --force # Reset system without confirmation

DATABASE MIGRATION SYSTEM:
  This tool manages the database schema versioning for the XLSX migration system.
  It ensures that all database changes are applied consistently and can be tracked.

  The migration system creates these tables:
  - migration_schema_versions: Tracks applied migrations
  - migration_configuration: Stores Google Sheets URL mappings
  - rules_[marketplace]_[country]: Rule tables for each marketplace

SAFETY:
  - All migrations run in transactions
  - Failed migrations are automatically rolled back
  - Migration history is preserved
  - System can be reset if needed
`);
  }

  /**
   * Display migration status
   */
  private async showStatus(): Promise<void> {
    try {
      console.log('🔍 Checking migration status...\n');

      const status = await this.migrations.getStatus();

      console.log('📊 Migration Status:');
      console.log(`   Current Version: ${status.currentVersion}`);
      console.log(`   Available Version: ${status.availableVersion}`);
      console.log(`   Status: ${status.currentVersion === status.availableVersion ? '✅ Up to date' : '⚠️ Migrations pending'}\n`);

      if (status.appliedMigrations.length > 0) {
        console.log('✅ Applied Migrations:');
        for (const migration of status.appliedMigrations) {
          console.log(`   ${migration.version}. ${migration.description}`);
          console.log(`      Applied: ${migration.appliedAt.toISOString()}`);
        }
        console.log('');
      }

      if (status.pendingMigrations.length > 0) {
        console.log('⏳ Pending Migrations:');
        for (const migration of status.pendingMigrations) {
          console.log(`   ${migration.version}. ${migration.description}`);
        }
        console.log('');
        console.log(`Run 'npm run migrate' to apply ${status.pendingMigrations.length} pending migration(s)`);
      } else {
        console.log('🎉 All migrations are up to date!');
      }

      // Run integrity check
      console.log('\n🔧 Running integrity check...');
      const integrity = await this.migrations.verifyIntegrity();
      
      if (integrity.valid) {
        console.log('✅ Database integrity check passed');
      } else {
        console.log('❌ Database integrity issues found:');
        for (const issue of integrity.issues) {
          console.log(`   - ${issue}`);
        }
      }

    } catch (error: any) {
      console.error('❌ Failed to get migration status:', error.message);
      process.exit(1);
    }
  }

  /**
   * Run migrations
   */
  private async runMigrations(verbose: boolean = false): Promise<void> {
    try {
      if (verbose) {
        Logger.getInstance().level = 'debug';
      }

      console.log('🚀 Running database migrations...\n');

      const result = await this.migrations.migrate();

      console.log('📊 Migration Results:');
      console.log(`   Applied: ${result.applied}/${result.total} migrations`);
      
      if (result.errors.length > 0) {
        console.log('\n❌ Errors encountered:');
        for (const error of result.errors) {
          console.log(`   - ${error}`);
        }
        process.exit(1);
      } else {
        console.log('\n✅ All migrations completed successfully!');
        
        // Run integrity check after successful migration
        console.log('\n🔧 Verifying database integrity...');
        const integrity = await this.migrations.verifyIntegrity();
        
        if (integrity.valid) {
          console.log('✅ Database integrity verified');
          console.log('\n🎉 Migration system is ready for use!');
        } else {
          console.log('❌ Database integrity issues found:');
          for (const issue of integrity.issues) {
            console.log(`   - ${issue}`);
          }
        }
      }

    } catch (error: any) {
      console.error('❌ Migration failed:', error.message);
      if (verbose) {
        console.error('Stack trace:', error.stack);
      }
      process.exit(1);
    }
  }

  /**
   * Reset the migration system
   */
  private async resetSystem(force: boolean = false): Promise<void> {
    if (!force) {
      console.log('⚠️  WARNING: This will completely reset the migration system!');
      console.log('This action will:');
      console.log('- Drop all migration tables');
      console.log('- Drop all rule tables');
      console.log('- Remove all data');
      console.log('- Reset migration history');
      console.log('');
      
      // In a real CLI, you'd use a proper prompt library
      console.log('This operation cannot be undone.');
      console.log('Use --force flag to skip this confirmation.');
      process.exit(1);
    }

    try {
      console.log('🔄 Resetting migration system...');

      // We'll use the database function for this
      const { DatabaseConnection } = await import('../database/connection');
      const db = DatabaseConnection.getInstance();

      const result = await db.query('SELECT reset_migration_system()');
      console.log('📋 Reset result:');
      console.log(result.rows[0].reset_migration_system);

      console.log('\n✅ Migration system reset completed!');
      console.log('Run "npm run migrate" to reinitialize the system.');

    } catch (error: any) {
      console.error('❌ Reset failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Main CLI entry point
   */
  async run(): Promise<void> {
    const args = this.parseArgs(process.argv);

    try {
      switch (args.command) {
        case 'up':
          await this.runMigrations(args.verbose);
          break;

        case 'status':
          await this.showStatus();
          break;

        case 'reset':
          await this.resetSystem(args.force);
          break;

        case 'help':
        case '--help':
        case '-h':
          this.showHelp();
          break;

        default:
          console.error(`❌ Unknown command: ${args.command}`);
          console.log('Run "npm run migrate help" for usage information.');
          process.exit(1);
      }
    } catch (error: any) {
      console.error('❌ CLI error:', error.message);
      if (args.verbose) {
        console.error('Stack trace:', error.stack);
      }
      process.exit(1);
    }
  }
}

// Run the CLI if this file is executed directly
if (require.main === module) {
  const cli = new MigrationCLI();
  cli.run().catch((error) => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });
}

export default MigrationCLI;