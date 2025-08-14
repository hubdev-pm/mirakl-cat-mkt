import { config } from 'dotenv';

config();

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
  pool: {
    min: number;
    max: number;
    idleTimeout: number;
    connectionTimeout: number;
  };
}

export interface GoogleCloudConfig {
  projectId: string;
  credentialsPath: string;
}

export interface MigrationConfig {
  batchSize: number;
  maxRetries: number;
  timeout: number;
}

export interface AppConfig {
  logLevel: string;
  nodeEnv: string;
  database: DatabaseConfig;
  googleCloud: GoogleCloudConfig;
  migration: MigrationConfig;
}

function getEnvVar(name: string, defaultValue?: string): string {
  const value = process.env[name];
  if (!value && !defaultValue) {
    console.warn(`Environment variable ${name} is not set, using empty string`);
    return '';
  }
  return value || defaultValue!;
}

function getEnvVarAsNumber(name: string, defaultValue: number): number {
  const value = process.env[name];
  if (!value) return defaultValue;
  const num = parseInt(value, 10);
  if (isNaN(num)) {
    throw new Error(`Environment variable ${name} must be a valid number`);
  }
  return num;
}

function getEnvVarAsBoolean(name: string, defaultValue: boolean): boolean {
  const value = process.env[name];
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true';
}

export const appConfig: AppConfig = {
  logLevel: getEnvVar('LOG_LEVEL', 'info'),
  nodeEnv: getEnvVar('NODE_ENV', 'development'),
  database: {
    host: getEnvVar('DB_HOST', 'localhost'),
    port: getEnvVarAsNumber('DB_PORT', 5432),
    database: getEnvVar('DB_NAME', 'marketplaces-inhelp'),
    user: getEnvVar('DB_USER', 'migration_user'),
    password: getEnvVar('DB_PASSWORD', 'migration_password'),
    ssl: getEnvVarAsBoolean('DB_SSL', false),
    pool: {
      min: getEnvVarAsNumber('DB_POOL_MIN', 2),
      max: getEnvVarAsNumber('DB_POOL_MAX', 10),
      idleTimeout: getEnvVarAsNumber('DB_POOL_IDLE_TIMEOUT', 30000),
      connectionTimeout: getEnvVarAsNumber('DB_POOL_CONNECTION_TIMEOUT', 60000),
    },
  },
  googleCloud: {
    projectId: getEnvVar('GOOGLE_CLOUD_PROJECT_ID', 'mirakl-catalogue-marketplaces'),
    credentialsPath: getEnvVar('GOOGLE_APPLICATION_CREDENTIALS', './service-account-mirakl-cat-mkt.json'),
  },
  migration: {
    batchSize: getEnvVarAsNumber('BATCH_SIZE', 1000),
    maxRetries: getEnvVarAsNumber('MAX_RETRIES', 3),
    timeout: getEnvVarAsNumber('MIGRATION_TIMEOUT', 300000),
  },
};