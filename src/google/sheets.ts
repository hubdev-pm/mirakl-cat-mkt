import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';
import { appConfig } from '../config/environment';
import { Logger } from '../utils/logger';
import { ErrorCollector } from '../utils/error-handler';

export class GoogleSheetsService {
  private auth: GoogleAuth;
  private sheets: any;

  constructor() {
    this.auth = new google.auth.GoogleAuth({
      keyFile: appConfig.googleCloud.credentialsPath,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    this.sheets = google.sheets({ version: 'v4', auth: this.auth });
  }

  /**
   * Converts a Google Sheets sharing URL to an XLSX export URL
   * @param shareUrl - The Google Sheets sharing URL
   * @returns The XLSX export URL
   */
  convertToExportUrl(shareUrl: string): string {
    try {
      Logger.debug('Converting Google Sheets URL to export format', { shareUrl });

      // Extract the spreadsheet ID from the URL
      const match = shareUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (!match) {
        throw new Error('Invalid Google Sheets URL format');
      }

      const spreadsheetId = match[1];
      const exportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=xlsx`;
      
      Logger.debug('Converted URL successfully', { exportUrl });
      return exportUrl;
    } catch (error: any) {
      Logger.error('Failed to convert Google Sheets URL', { 
        shareUrl, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Downloads XLSX data from a Google Sheets URL
   * @param shareUrl - The Google Sheets sharing URL
   * @returns Buffer containing the XLSX data
   */
  async downloadXLSX(shareUrl: string): Promise<Buffer> {
    try {
      Logger.info('Downloading XLSX from Google Sheets', { shareUrl });

      const exportUrl = this.convertToExportUrl(shareUrl);
      
      // Use built-in https module to download the file
      const https = await import('https');
      const { URL } = await import('url');
      
      return new Promise((resolve, reject) => {
        const url = new URL(exportUrl);
        const request = https.get(url, (response) => {
          if (response.statusCode !== 200) {
            reject(new Error(`Failed to download: ${response.statusCode} ${response.statusMessage}`));
            return;
          }

          const chunks: Buffer[] = [];
          response.on('data', (chunk: Buffer) => {
            chunks.push(chunk);
          });

          response.on('end', () => {
            const buffer = Buffer.concat(chunks);
            Logger.info('XLSX download completed', { 
              shareUrl, 
              bufferSize: buffer.length 
            });
            resolve(buffer);
          });

          response.on('error', (error) => {
            Logger.error('Response error during download', { shareUrl, error: error.message });
            reject(error);
          });
        });

        request.on('error', (error) => {
          Logger.error('Request error during download', { shareUrl, error: error.message });
          reject(error);
        });

        request.setTimeout(30000, () => {
          request.destroy();
          reject(new Error('Download timeout after 30 seconds'));
        });
      });
      
    } catch (error: any) {
      Logger.error('Failed to download XLSX from Google Sheets', { 
        shareUrl, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Validates if a Google Sheets URL is accessible
   * @param shareUrl - The Google Sheets sharing URL
   * @returns Promise<boolean> indicating if the sheet is accessible
   */
  async validateSheetAccess(shareUrl: string): Promise<boolean> {
    try {
      Logger.debug('Validating Google Sheets access', { shareUrl });

      const spreadsheetId = this.extractSpreadsheetId(shareUrl);
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId,
        fields: 'properties.title',
      });
      
      const isValid = !!response.data;
      Logger.debug('Sheet validation completed', { shareUrl, isValid, title: response.data?.properties?.title });
      return isValid;
    } catch (error: any) {
      Logger.error('Sheet validation failed', { shareUrl, error: error.message });
      return false;
    }
  }

  /**
   * Gets basic information about a Google Sheet
   * @param shareUrl - The Google Sheets sharing URL
   * @returns Promise with sheet information
   */
  async getSheetInfo(shareUrl: string): Promise<{ title: string; sheetCount: number }> {
    try {
      Logger.debug('Getting sheet information', { shareUrl });

      const spreadsheetId = this.extractSpreadsheetId(shareUrl);
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId,
        fields: 'properties.title,sheets.properties.title',
      });

      const info = {
        title: response.data.properties.title || 'Unknown Sheet',
        sheetCount: response.data.sheets?.length || 0,
      };

      Logger.debug('Sheet information retrieved', { shareUrl, info });
      return info;
    } catch (error: any) {
      Logger.error('Failed to get sheet information', { shareUrl, error: error.message });
      throw error;
    }
  }

  private extractSpreadsheetId(shareUrl: string): string {
    const match = shareUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) {
      throw new Error('Invalid Google Sheets URL format');
    }
    return match[1];
  }

  /**
   * Validates all configured Google Sheets URLs
   * @param urls - Array of Google Sheets URLs
   * @param errorCollector - Error collector instance
   * @returns Promise with validation results
   */
  async validateAllSheets(
    urls: string[], 
    errorCollector: ErrorCollector
  ): Promise<{ valid: string[]; invalid: string[] }> {
    Logger.info('Validating all Google Sheets URLs', { count: urls.length });

    const valid: string[] = [];
    const invalid: string[] = [];

    for (const url of urls) {
      try {
        const isValid = await this.validateSheetAccess(url);
        if (isValid) {
          valid.push(url);
          Logger.debug('Sheet validation passed', { url });
        } else {
          invalid.push(url);
          errorCollector.addError(
            'GoogleSheetsService',
            `Sheet validation failed for URL: ${url}`,
            { url }
          );
        }
      } catch (error: any) {
        invalid.push(url);
        errorCollector.addError(
          'GoogleSheetsService',
          `Sheet validation error for URL: ${url}`,
          { url, error: error.message }
        );
      }
    }

    Logger.info('Sheet validation completed', { 
      total: urls.length, 
      valid: valid.length, 
      invalid: invalid.length 
    });

    return { valid, invalid };
  }
}