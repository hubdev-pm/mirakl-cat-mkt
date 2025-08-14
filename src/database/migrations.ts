import { Logger } from '../utils/logger';
import { DatabaseConnection } from './connection';
import { generateCreateTableSQL, generateConfigurationTableSQL, generateInsertConfigurationSQL } from './schema';

export interface Migration {
  id: string;
  version: number;
  description: string;
  sql: string;
  rollbackSql?: string;
}

export class DatabaseMigrations {
  private db: DatabaseConnection;

  constructor() {
    this.db = DatabaseConnection.getInstance();
  }

  /**
   * Get all defined migrations in order
   */
  private getMigrations(): Migration[] {
    return [
      {
        id: 'create_migration_schema_table',
        version: 1,
        description: 'Create migration schema tracking table',
        sql: `
          CREATE TABLE IF NOT EXISTS migration_schema_versions (
            id SERIAL PRIMARY KEY,
            version INTEGER UNIQUE NOT NULL,
            migration_id TEXT UNIQUE NOT NULL,
            description TEXT NOT NULL,
            applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            rollback_sql TEXT
          );
          
          CREATE INDEX IF NOT EXISTS idx_migration_schema_versions_version 
          ON migration_schema_versions (version);
        `,
        rollbackSql: 'DROP TABLE IF EXISTS migration_schema_versions CASCADE;'
      },
      {
        id: 'create_configuration_table',
        version: 2,
        description: 'Create migration configuration table',
        sql: generateConfigurationTableSQL(),
        rollbackSql: 'DROP TABLE IF EXISTS migration_configuration CASCADE;'
      },
      {
        id: 'insert_initial_configuration',
        version: 3,
        description: 'Insert initial Google Sheets URL mappings',
        sql: generateInsertConfigurationSQL(),
        rollbackSql: 'DELETE FROM migration_configuration;'
      },
      {
        id: 'create_rules_worten_pt',
        version: 4,
        description: 'Create rules table for Worten Portugal',
        sql: generateCreateTableSQL('rules_worten_pt'),
        rollbackSql: 'DROP TABLE IF EXISTS rules_worten_pt CASCADE;'
      },
      {
        id: 'create_rules_pccomp_pt',
        version: 5,
        description: 'Create rules table for PCComp Portugal',
        sql: generateCreateTableSQL('rules_pccomp_pt'),
        rollbackSql: 'DROP TABLE IF EXISTS rules_pccomp_pt CASCADE;'
      },
      {
        id: 'create_rules_pccomp_es',
        version: 6,
        description: 'Create rules table for PCComp Spain',
        sql: generateCreateTableSQL('rules_pccomp_es'),
        rollbackSql: 'DROP TABLE IF EXISTS rules_pccomp_es CASCADE;'
      },
      {
        id: 'create_rules_carrefour_fr',
        version: 7,
        description: 'Create rules table for Carrefour France',
        sql: generateCreateTableSQL('rules_carrefour_fr'),
        rollbackSql: 'DROP TABLE IF EXISTS rules_carrefour_fr CASCADE;'
      },
      {
        id: 'create_rules_carrefour_es',
        version: 8,
        description: 'Create rules table for Carrefour Spain',
        sql: generateCreateTableSQL('rules_carrefour_es'),
        rollbackSql: 'DROP TABLE IF EXISTS rules_carrefour_es CASCADE;'
      },
      {
        id: 'add_performance_indexes',
        version: 9,
        description: 'Add performance indexes to all rule tables',
        sql: `
          -- Add indexes for better query performance
          DO $$
          DECLARE
              table_name text;
              tables text[] := ARRAY['rules_worten_pt', 'rules_pccomp_pt', 'rules_pccomp_es', 'rules_carrefour_fr', 'rules_carrefour_es'];
          BEGIN
              FOREACH table_name IN ARRAY tables
              LOOP
                  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_requirement_level ON %s (requirement_level)', table_name, table_name);
                  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_roles ON %s (roles)', table_name, table_name);
                  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_categoria_mirakl ON %s ("codigo-categoria-mirakl")', table_name, table_name);
                  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_created_at ON %s (created_at)', table_name, table_name);
              END LOOP;
          END$$;
        `,
        rollbackSql: `
          DROP INDEX IF EXISTS idx_rules_worten_pt_requirement_level;
          DROP INDEX IF EXISTS idx_rules_worten_pt_roles;
          DROP INDEX IF EXISTS idx_rules_worten_pt_categoria_mirakl;
          DROP INDEX IF EXISTS idx_rules_worten_pt_created_at;
          -- Repeat for all tables...
        `
      }
    ];
  }

  /**
   * Get current database schema version
   */
  async getCurrentVersion(): Promise<number> {
    try {
      const result = await this.db.query(`
        SELECT MAX(version) as current_version 
        FROM migration_schema_versions
      `);
      return result.rows[0]?.current_version || 0;
    } catch (error) {
      // If the table doesn't exist, we're at version 0
      Logger.debug('Migration schema table does not exist, starting from version 0');
      return 0;
    }
  }

  /**
   * Check if a specific migration has been applied
   */
  async isMigrationApplied(migrationId: string): Promise<boolean> {
    try {
      const result = await this.db.query(`
        SELECT 1 FROM migration_schema_versions 
        WHERE migration_id = $1
      `, [migrationId]);
      return result.rows.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Apply a single migration
   */
  async applyMigration(migration: Migration): Promise<boolean> {
    const client = await this.db.getClient();
    
    try {
      await client.query('BEGIN');
      
      Logger.info('Applying migration', { 
        version: migration.version, 
        id: migration.id,
        description: migration.description 
      });

      // Execute the migration SQL
      await client.query(migration.sql);

      // Record the migration in the schema versions table
      // Only if the table exists (for migrations after version 1)
      if (migration.version > 1) {
        await client.query(`
          INSERT INTO migration_schema_versions (version, migration_id, description, rollback_sql)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (migration_id) DO NOTHING
        `, [migration.version, migration.id, migration.description, migration.rollbackSql]);
      }

      await client.query('COMMIT');
      
      Logger.info('Migration applied successfully', { 
        version: migration.version, 
        id: migration.id 
      });
      
      return true;
    } catch (error: any) {
      await client.query('ROLLBACK');
      Logger.error('Migration failed', { 
        version: migration.version, 
        id: migration.id,
        error: error.message 
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Apply all pending migrations
   */
  async migrate(): Promise<{ applied: number; total: number; errors: string[] }> {
    const migrations = this.getMigrations();
    const currentVersion = await this.getCurrentVersion();
    const errors: string[] = [];
    let applied = 0;

    Logger.info('Starting database migrations', { 
      currentVersion, 
      totalMigrations: migrations.length 
    });

    for (const migration of migrations) {
      try {
        if (migration.version <= currentVersion) {
          // Check if this specific migration was applied
          const isApplied = await this.isMigrationApplied(migration.id);
          if (isApplied) {
            Logger.debug('Migration already applied, skipping', { 
              version: migration.version, 
              id: migration.id 
            });
            continue;
          }
        }

        await this.applyMigration(migration);
        applied++;
      } catch (error: any) {
        const errorMsg = `Migration ${migration.version} (${migration.id}) failed: ${error.message}`;
        errors.push(errorMsg);
        Logger.error('Migration failed, stopping migration process', { 
          migration: migration.id,
          error: error.message 
        });
        break; // Stop on first error to maintain consistency
      }
    }

    const finalVersion = await this.getCurrentVersion();
    Logger.info('Database migrations completed', { 
      appliedMigrations: applied,
      totalMigrations: migrations.length,
      finalVersion,
      errors: errors.length 
    });

    return { applied, total: migrations.length, errors };
  }

  /**
   * Get migration status and information
   */
  async getStatus(): Promise<{
    currentVersion: number;
    availableVersion: number;
    appliedMigrations: Array<{
      version: number;
      id: string;
      description: string;
      appliedAt: Date;
    }>;
    pendingMigrations: Array<{
      version: number;
      id: string;
      description: string;
    }>;
  }> {
    const migrations = this.getMigrations();
    const currentVersion = await this.getCurrentVersion();
    const availableVersion = Math.max(...migrations.map(m => m.version));

    let appliedMigrations = [];
    try {
      const result = await this.db.query(`
        SELECT version, migration_id, description, applied_at
        FROM migration_schema_versions
        ORDER BY version ASC
      `);
      appliedMigrations = result.rows.map(row => ({
        version: row.version,
        id: row.migration_id,
        description: row.description,
        appliedAt: row.applied_at
      }));
    } catch (error) {
      // Schema table doesn't exist yet
    }

    const appliedIds = new Set(appliedMigrations.map(m => m.id));
    const pendingMigrations = migrations
      .filter(m => !appliedIds.has(m.id))
      .map(m => ({
        version: m.version,
        id: m.id,
        description: m.description
      }));

    return {
      currentVersion,
      availableVersion,
      appliedMigrations,
      pendingMigrations
    };
  }

  /**
   * Verify database integrity after migrations
   */
  async verifyIntegrity(): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = [];

    try {
      // Check that all expected tables exist
      const expectedTables = [
        'migration_schema_versions',
        'migration_configuration',
        'rules_worten_pt',
        'rules_pccomp_pt',
        'rules_pccomp_es',
        'rules_carrefour_fr',
        'rules_carrefour_es'
      ];

      const result = await this.db.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      `);

      const existingTables = result.rows.map(row => row.table_name);
      
      for (const table of expectedTables) {
        if (!existingTables.includes(table)) {
          issues.push(`Missing table: ${table}`);
        }
      }

      // Check that rule tables have required columns and constraints
      for (const table of expectedTables.filter(t => t.startsWith('rules_'))) {
        try {
          await this.db.query(`SELECT code FROM ${table} LIMIT 1`);
          
          // Check unique constraint on code
          const constraintResult = await this.db.query(`
            SELECT constraint_name 
            FROM information_schema.table_constraints 
            WHERE table_name = $1 
            AND constraint_type = 'UNIQUE'
            AND constraint_name LIKE '%code%'
          `, [table]);
          
          if (constraintResult.rows.length === 0) {
            issues.push(`Missing unique constraint on code column in ${table}`);
          }
        } catch (error) {
          issues.push(`Table ${table} is missing required columns or constraints`);
        }
      }

      // Check configuration data
      const configResult = await this.db.query(`
        SELECT COUNT(*) as count FROM migration_configuration
      `);
      
      if (configResult.rows[0].count < 5) {
        issues.push('Insufficient configuration data - expected 5 Google Sheets mappings');
      }

    } catch (error: any) {
      issues.push(`Integrity check failed: ${error.message}`);
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }
}