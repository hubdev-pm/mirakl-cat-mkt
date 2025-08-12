import * as winston from 'winston';
import { appConfig } from '../config/environment';

export class Logger {
  private static instance: winston.Logger;

  static getInstance(): winston.Logger {
    if (!Logger.instance) {
      Logger.instance = winston.createLogger({
        level: appConfig.logLevel,
        format: winston.format.combine(
          winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss',
          }),
          winston.format.errors({ stack: true }),
          winston.format.json(),
          winston.format.prettyPrint()
        ),
        defaultMeta: { service: 'xlsx-migration' },
        transports: [
          new winston.transports.Console({
            format: winston.format.combine(
              winston.format.colorize(),
              winston.format.simple(),
              winston.format.printf(({ timestamp, level, message, ...meta }) => {
                let log = `${timestamp} [${level}]: ${message}`;
                if (Object.keys(meta).length > 0) {
                  log += ` ${JSON.stringify(meta)}`;
                }
                return log;
              })
            ),
          }),
          new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
          }),
          new winston.transports.File({
            filename: 'logs/combined.log',
          }),
        ],
        exceptionHandlers: [
          new winston.transports.File({ filename: 'logs/exceptions.log' }),
        ],
        rejectionHandlers: [
          new winston.transports.File({ filename: 'logs/rejections.log' }),
        ],
      });

      if (appConfig.nodeEnv !== 'production') {
        Logger.instance.add(
          new winston.transports.Console({
            format: winston.format.simple(),
          })
        );
      }
    }

    return Logger.instance;
  }

  static info(message: string, meta?: any): void {
    Logger.getInstance().info(message, meta);
  }

  static error(message: string, meta?: any): void {
    Logger.getInstance().error(message, meta);
  }

  static warn(message: string, meta?: any): void {
    Logger.getInstance().warn(message, meta);
  }

  static debug(message: string, meta?: any): void {
    Logger.getInstance().debug(message, meta);
  }

  static verbose(message: string, meta?: any): void {
    Logger.getInstance().verbose(message, meta);
  }
}

export const logger = Logger.getInstance();