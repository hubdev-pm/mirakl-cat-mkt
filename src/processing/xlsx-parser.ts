import * as XLSX from 'xlsx';
import { Logger } from '../utils/logger';
import { ErrorCollector } from '../utils/error-handler';
import { RuleRecord, RULE_TABLE_COLUMNS } from '../database/schema';

export interface ParsedSheet {
  sheetName: string;
  data: RuleRecord[];
  totalRows: number;
  validRows: number;
  errors: string[];
}

export class XLSXParser {
  /**
   * Parses XLSX buffer and extracts rule data
   * @param buffer - Buffer containing XLSX data
   * @param sourceName - Name for logging/error tracking
   * @param errorCollector - Error collector instance
   * @returns Promise with parsed data
   */
  async parseXLSXBuffer(
    buffer: Buffer, 
    sourceName: string, 
    errorCollector: ErrorCollector
  ): Promise<ParsedSheet[]> {
    try {
      Logger.info('Starting XLSX parsing', { sourceName, bufferSize: buffer.length });

      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheets: ParsedSheet[] = [];

      for (const sheetName of workbook.SheetNames) {
        Logger.debug('Processing sheet', { sheetName, sourceName });
        
        const worksheet = workbook.Sheets[sheetName];
        const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        const parsedSheet = this.processSheet(rawData, sheetName, sourceName, errorCollector);
        sheets.push(parsedSheet);
      }

      Logger.info('XLSX parsing completed', { 
        sourceName, 
        sheetsCount: sheets.length,
        totalRows: sheets.reduce((sum, sheet) => sum + sheet.totalRows, 0),
        validRows: sheets.reduce((sum, sheet) => sum + sheet.validRows, 0)
      });

      return sheets;
    } catch (error: any) {
      const message = `Failed to parse XLSX for ${sourceName}`;
      Logger.error(message, { error: error.message, sourceName });
      errorCollector.addError('XLSXParser', message, { sourceName, error: error.message });
      throw error;
    }
  }

  /**
   * Processes a single worksheet and extracts rule records
   * @param rawData - Raw sheet data from XLSX
   * @param sheetName - Name of the sheet
   * @param sourceName - Source name for logging
   * @param errorCollector - Error collector instance
   * @returns Processed sheet data
   */
  private processSheet(
    rawData: any[][], 
    sheetName: string, 
    sourceName: string,
    errorCollector: ErrorCollector
  ): ParsedSheet {
    Logger.debug('Processing sheet data', { sheetName, sourceName, rows: rawData.length });

    if (rawData.length === 0) {
      Logger.warn('Empty sheet detected', { sheetName, sourceName });
      return {
        sheetName,
        data: [],
        totalRows: 0,
        validRows: 0,
        errors: ['Sheet is empty'],
      };
    }

    // Assume first row contains headers
    const headers = rawData[0]?.map(h => String(h || '').trim()) || [];
    const dataRows = rawData.slice(1);

    Logger.debug('Sheet structure', { 
      sheetName, 
      sourceName, 
      headers: headers.length, 
      dataRows: dataRows.length 
    });

    const data: RuleRecord[] = [];
    const errors: string[] = [];
    let validRows = 0;

    // Map headers to expected column names
    const columnMapping = this.createColumnMapping(headers, sheetName, errorCollector);

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNumber = i + 2; // +2 because we start from row 1 (header) + 1 (0-indexed)

      try {
        const record = this.processRow(row, columnMapping, rowNumber);
        if (record) {
          data.push(record);
          validRows++;
        }
      } catch (error: any) {
        const errorMessage = `Row ${rowNumber}: ${error.message}`;
        errors.push(errorMessage);
        errorCollector.addError(
          'XLSXParser',
          `Error processing row in ${sheetName}`,
          { sheetName, sourceName, rowNumber, error: error.message }
        );
      }
    }

    Logger.info('Sheet processing completed', {
      sheetName,
      sourceName,
      totalRows: dataRows.length,
      validRows,
      errorCount: errors.length,
    });

    return {
      sheetName,
      data,
      totalRows: dataRows.length,
      validRows,
      errors,
    };
  }

  /**
   * Creates a mapping between sheet headers and database columns
   * @param headers - Array of header strings from the sheet
   * @param sheetName - Name of the sheet for logging
   * @param errorCollector - Error collector instance
   * @returns Mapping object
   */
  private createColumnMapping(
    headers: string[], 
    sheetName: string,
    errorCollector: ErrorCollector
  ): Map<string, number> {
    const mapping = new Map<string, number>();
    
    // Create a flexible mapping that handles common variations
    const headerVariations: { [key: string]: string[] } = {
      'code': ['code', 'codigo', 'id'],
      'description': ['description', 'descricao', 'desc'],
      'label': ['label', 'nome', 'name'],
      'requirement_level': ['requirement_level', 'nivel_requisito', 'required'],
      'roles': ['roles', 'papeis', 'functions'],
      'type': ['type', 'tipo', 'category'],
      'validations': ['validations', 'validacoes', 'rules'],
      'variant': ['variant', 'variante', 'version'],
      'codigo-categoria-mirakl': ['codigo-categoria-mirakl', 'mirakl_category_code'],
      'nome-categoria-mirakl': ['nome-categoria-mirakl', 'mirakl_category_name'],
      'parent_code-categoria-mirakl': ['parent_code-categoria-mirakl', 'parent_mirakl_code'],
    };

    for (const [dbColumn, variations] of Object.entries(headerVariations)) {
      const headerIndex = headers.findIndex(header => 
        variations.some(variation => 
          header.toLowerCase().includes(variation.toLowerCase())
        )
      );

      if (headerIndex !== -1) {
        mapping.set(dbColumn, headerIndex);
        Logger.debug('Column mapped', { 
          dbColumn, 
          sheetHeader: headers[headerIndex], 
          index: headerIndex,
          sheetName 
        });
      } else {
        errorCollector.addError(
          'XLSXParser',
          `Could not map database column '${dbColumn}' to any sheet header`,
          { sheetName, availableHeaders: headers, dbColumn }
        );
      }
    }

    Logger.info('Column mapping completed', { 
      sheetName, 
      mappedColumns: mapping.size, 
      expectedColumns: RULE_TABLE_COLUMNS.length 
    });

    return mapping;
  }

  /**
   * Processes a single row of data
   * @param row - Array of cell values
   * @param mapping - Column mapping
   * @param rowNumber - Row number for error reporting
   * @returns Processed RuleRecord or null if invalid
   */
  private processRow(
    row: any[], 
    mapping: Map<string, number>,
    rowNumber: number
  ): RuleRecord | null {
    // Skip empty rows
    if (!row || row.every(cell => !cell || String(cell).trim() === '')) {
      return null;
    }

    const record: Partial<RuleRecord> = {};

    // Map each database column to the corresponding row value
    for (const dbColumn of RULE_TABLE_COLUMNS) {
      const headerIndex = mapping.get(dbColumn);
      if (headerIndex !== undefined && headerIndex < row.length) {
        const cellValue = row[headerIndex];
        record[dbColumn as keyof RuleRecord] = cellValue ? String(cellValue).trim() : '';
      } else {
        record[dbColumn as keyof RuleRecord] = '';
      }
    }

    // Validate required fields (you can customize this based on business rules)
    if (!record.code || record.code.trim() === '') {
      throw new Error(`Missing required field 'code'`);
    }

    Logger.debug('Row processed successfully', { rowNumber, code: record.code });

    return record as RuleRecord;
  }

  /**
   * Validates XLSX file structure
   * @param buffer - XLSX buffer
   * @param sourceName - Source name for logging
   * @returns Validation result
   */
  async validateXLSXStructure(buffer: Buffer, sourceName: string): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      Logger.debug('Validating XLSX structure', { sourceName });

      const workbook = XLSX.read(buffer, { type: 'buffer' });
      
      if (workbook.SheetNames.length === 0) {
        errors.push('No sheets found in XLSX file');
      }

      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
        
        if (range.e.r < 1) {
          warnings.push(`Sheet '${sheetName}' appears to have no data rows`);
        }
      }

      Logger.debug('XLSX structure validation completed', { 
        sourceName, 
        sheets: workbook.SheetNames.length, 
        errors: errors.length, 
        warnings: warnings.length 
      });

    } catch (error: any) {
      errors.push(`Failed to validate XLSX structure: ${error.message}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}