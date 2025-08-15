// Dynamic imports to avoid blocking during module loading
import { Logger } from '../utils/logger';
import { ErrorCollector } from '../utils/error-handler';

export class GoogleSheetsService {
  private auth: GoogleAuth | null = null;
  private sheets: any = null;
  private isInitialized: boolean = false;

  constructor() {
    // Don't initialize Google Auth in constructor to avoid blocking operations
    Logger.debug('GoogleSheetsService created - authentication will be lazy-loaded');
  }

  /**
   * Initialize manual JWT authentication (avoiding googleapis package hang)
   */
  private async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      Logger.debug('Initializing manual JWT authentication for Google Sheets');

      const { appConfig } = await import('../config/environment');
      const fs = await import('fs');

      // Check if credentials file exists
      if (!fs.existsSync(appConfig.googleCloud.credentialsPath)) {
        throw new Error(`Google Cloud credentials file not found: ${appConfig.googleCloud.credentialsPath}`);
      }

      // Read and parse service account credentials
      const credentials = JSON.parse(fs.readFileSync(appConfig.googleCloud.credentialsPath, 'utf8'));
      
      Logger.debug('Service account credentials loaded', {
        projectId: credentials.project_id,
        clientEmail: credentials.client_email
      });

      // Store credentials for JWT creation
      this.auth = credentials;
      this.isInitialized = true;

      Logger.info('Manual JWT authentication initialized successfully');

    } catch (error: any) {
      Logger.error('Failed to initialize manual JWT authentication', {
        error: error.message
      });
      throw new Error(`Google Sheets authentication failed: ${error.message}`);
    }
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
   * Downloads XLSX data from Google Sheets using manual JWT authentication
   * @param shareUrl - The Google Sheets sharing URL
   * @returns Buffer containing the XLSX data
   */
  async downloadXLSX(shareUrl: string): Promise<Buffer> {
    try {
      Logger.info('Downloading XLSX from Google Sheets using manual JWT authentication', { shareUrl });

      await this.initialize();
      const spreadsheetId = this.extractSpreadsheetId(shareUrl);

      // Create JWT access token
      const accessToken = await this.createAccessToken();
      Logger.debug('JWT access token created successfully');

      // Download CSV data using authenticated request
      const csvData = await this.downloadCSVWithAuth(spreadsheetId, accessToken);
      Logger.debug('CSV data downloaded', { dataSize: csvData.length });

      // Convert CSV to XLSX
      const xlsx = await import('xlsx');
      const workbook = xlsx.read(csvData, { type: 'string' });
      const xlsxBuffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      
      Logger.info('XLSX conversion completed', { 
        shareUrl, 
        bufferSize: xlsxBuffer.length
      });
      
      return xlsxBuffer;
      
    } catch (error: any) {
      Logger.error('Failed to download XLSX using JWT auth', { 
        shareUrl, 
        error: error.message 
      });
      
      // Fallback to direct HTTP download if JWT fails
      Logger.info('Attempting fallback to direct HTTP download', { shareUrl });
      return this.downloadXLSXDirect(shareUrl);
    }
  }

  /**
   * Fallback method for direct HTTP download (original implementation)
   * @param shareUrl - The Google Sheets sharing URL
   * @returns Buffer containing the XLSX data
   */
  private async downloadXLSXDirect(shareUrl: string): Promise<Buffer> {
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
          Logger.info('XLSX direct download completed', { 
            shareUrl, 
            bufferSize: buffer.length 
          });
          resolve(buffer);
        });

        response.on('error', (error) => {
          Logger.error('Response error during direct download', { shareUrl, error: error.message });
          reject(error);
        });
      });

      request.on('error', (error) => {
        Logger.error('Request error during direct download', { shareUrl, error: error.message });
        reject(error);
      });

      request.setTimeout(30000, () => {
        request.destroy();
        reject(new Error('Download timeout after 30 seconds'));
      });
    });
  }

  /**
   * Validates if a Google Sheets URL is accessible
   * @param shareUrl - The Google Sheets sharing URL
   * @returns Promise<boolean> indicating if the sheet is accessible
   */
  async validateSheetAccess(shareUrl: string): Promise<boolean> {
    try {
      Logger.debug('Validating Google Sheets access', { shareUrl });

      await this.initialize();
      const spreadsheetId = this.extractSpreadsheetId(shareUrl);
      const response = await this.sheets!.spreadsheets.get({
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

      await this.initialize();
      const spreadsheetId = this.extractSpreadsheetId(shareUrl);
      const response = await this.sheets!.spreadsheets.get({
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
   * Creates JWT access token for Google API authentication
   * @returns Promise<string> access token
   */
  private async createAccessToken(): Promise<string> {
    const crypto = await import('crypto');
    
    const credentials = this.auth as any;
    const now = Math.floor(Date.now() / 1000);
    const expiry = now + 3600; // 1 hour

    // JWT header
    const header = {
      alg: 'RS256',
      typ: 'JWT'
    };

    // JWT payload
    const payload = {
      iss: credentials.client_email,
      scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: expiry
    };

    // Create JWT
    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const unsignedToken = `${encodedHeader}.${encodedPayload}`;

    // Sign JWT
    const privateKey = credentials.private_key;
    const signature = crypto.createSign('RSA-SHA256')
      .update(unsignedToken)
      .sign(privateKey, 'base64url');

    const jwt = `${unsignedToken}.${signature}`;

    // Exchange JWT for access token
    const https = await import('https');
    const querystring = await import('querystring');

    const postData = querystring.stringify({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    });

    return new Promise((resolve, reject) => {
      const req = https.request('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': postData.length
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            if (response.access_token) {
              resolve(response.access_token);
            } else {
              reject(new Error(`Token exchange failed: ${data}`));
            }
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  }

  /**
   * Downloads CSV data using authenticated request
   * @param spreadsheetId - The Google Sheets spreadsheet ID
   * @param accessToken - The OAuth2 access token
   * @returns Promise<string> CSV data
   */
  private async downloadCSVWithAuth(spreadsheetId: string, accessToken: string): Promise<string> {
    const https = await import('https');
    const { URL } = await import('url');

    const exportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`;
    
    return new Promise((resolve, reject) => {
      const url = new URL(exportUrl);
      const request = https.request({
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download CSV: ${response.statusCode} ${response.statusMessage}`));
          return;
        }

        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => resolve(data));
        response.on('error', reject);
      });

      request.on('error', reject);
      request.setTimeout(30000, () => {
        request.destroy();
        reject(new Error('CSV download timeout'));
      });
      request.end();
    });
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