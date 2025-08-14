import { Pool, PoolClient } from 'pg';
import { appConfig } from '../config/environment';
import { Logger } from '../utils/logger';

export class DatabaseConnection {
  private static instance: DatabaseConnection;
  private pool: Pool;

  private constructor() {
    this.pool = new Pool({
      host: appConfig.database.host,
      port: appConfig.database.port,
      database: appConfig.database.database,
      user: appConfig.database.user,
      password: appConfig.database.password,
      ssl: appConfig.database.ssl,
      min: appConfig.database.pool.min,
      max: appConfig.database.pool.max,
      idleTimeoutMillis: appConfig.database.pool.idleTimeout,
      connectionTimeoutMillis: appConfig.database.pool.connectionTimeout,
    });

    this.pool.on('connect', () => {
      Logger.debug('New database client connected');
    });

    this.pool.on('error', (err) => {
      Logger.error('Database pool error', { error: err.message, stack: err.stack });
    });
  }

  static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  async connect(): Promise<PoolClient> {
    try {
      const client = await this.pool.connect();
      Logger.debug('Database client acquired from pool');
      return client;
    } catch (error: any) {
      Logger.error('Failed to acquire database client', { error: error.message });
      throw error;
    }
  }

  async getClient(): Promise<PoolClient> {
    return this.connect();
  }

  async query(text: string, params?: any[]): Promise<any> {
    const client = await this.connect();
    try {
      Logger.debug('Executing query', { query: text, params });
      const result = await client.query(text, params);
      Logger.debug('Query executed successfully', { rowCount: result.rowCount });
      return result;
    } catch (error: any) {
      Logger.error('Query execution failed', { 
        query: text, 
        params, 
        error: error.message 
      });
      throw error;
    } finally {
      client.release();
    }
  }

  async createDatabase(): Promise<void> {
    try {
      Logger.info('Creating database if not exists', { database: appConfig.database.database });
      
      // Connect to postgres database first to create target database
      const tempPool = new Pool({
        host: appConfig.database.host,
        port: appConfig.database.port,
        database: 'postgres',
        user: appConfig.database.user,
        password: appConfig.database.password,
        ssl: appConfig.database.ssl,
      });

      const client = await tempPool.connect();
      try {
        const result = await client.query(
          'SELECT 1 FROM pg_database WHERE datname = $1',
          [appConfig.database.database]
        );

        if (result.rows.length === 0) {
          await client.query(`CREATE DATABASE "${appConfig.database.database}"`);
          Logger.info('Database created successfully', { database: appConfig.database.database });
        } else {
          Logger.info('Database already exists', { database: appConfig.database.database });
        }
      } finally {
        client.release();
        await tempPool.end();
      }
    } catch (error: any) {
      Logger.error('Failed to create database', { 
        database: appConfig.database.database, 
        error: error.message 
      });
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.query('SELECT 1 as health_check');
      const isHealthy = result.rows.length > 0 && result.rows[0].health_check === 1;
      Logger.debug('Database health check', { healthy: isHealthy });
      return isHealthy;
    } catch (error: any) {
      Logger.error('Database health check failed', { error: error.message });
      return false;
    }
  }

  async close(): Promise<void> {
    try {
      await this.pool.end();
      Logger.info('Database connection pool closed');
    } catch (error: any) {
      Logger.error('Error closing database connection pool', { error: error.message });
      throw error;
    }
  }
}