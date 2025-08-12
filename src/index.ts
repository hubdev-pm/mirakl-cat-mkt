#!/usr/bin/env node

import CLI from './cli';
import { Logger } from './utils/logger';

/**
 * Main entry point for the XLSX to Database Migration Tool
 */
async function main(): Promise<void> {
  let exitCode = 0;

  try {
    Logger.info('Starting XLSX to Database Migration Tool', {
      version: '1.0.0',
      nodeVersion: process.version,
      platform: process.platform,
      timestamp: new Date().toISOString(),
    });

    const cli = new CLI();
    exitCode = await cli.run(process.argv);

    Logger.info('Migration tool execution completed', { exitCode });

  } catch (error: any) {
    Logger.error('Fatal error in main execution', {
      error: error.message,
      stack: error.stack,
    });
    
    console.error('Fatal error:', error.message);
    exitCode = 1;
  }

  process.exit(exitCode);
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  Logger.error('Unhandled Promise Rejection', {
    reason: reason?.toString(),
    promise: promise.toString(),
  });
  console.error('Unhandled Promise Rejection:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  Logger.error('Uncaught Exception', {
    error: error.message,
    stack: error.stack,
  });
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Graceful shutdown handling
process.on('SIGINT', () => {
  Logger.info('Received SIGINT, performing graceful shutdown...');
  console.log('\nReceived interrupt signal. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  Logger.info('Received SIGTERM, performing graceful shutdown...');
  console.log('\nReceived termination signal. Shutting down gracefully...');
  process.exit(0);
});

// Run the main function
if (require.main === module) {
  main().catch((error: any) => {
    console.error('Failed to start application:', error);
    process.exit(1);
  });
}

export default main;