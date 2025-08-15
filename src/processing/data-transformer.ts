import { Logger } from '../utils/logger';
import { ErrorCollector } from '../utils/error-handler';
import { RuleRecord } from '../database/schema';
import { ParsedSheet } from './xlsx-parser';

export interface TransformationResult {
  records: RuleRecord[];
  totalProcessed: number;
  validRecords: number;
  skippedRecords: number;
  errors: string[];
}

export class DataTransformer {
  private cachedSheetData: ParsedSheet[] = [];

  /**
   * Transforms parsed sheet data for database insertion
   * @param parsedSheets - Array of parsed sheets
   * @param sourceName - Source identifier for logging
   * @param errorCollector - Error collector instance
   * @returns Transformation result
   */
  async transformSheetsData(
    parsedSheets: ParsedSheet[],
    sourceName: string,
    errorCollector: ErrorCollector
  ): Promise<TransformationResult> {
    Logger.info('Starting data transformation', { 
      sourceName, 
      sheetsCount: parsedSheets.length 
    });

    let totalProcessed = 0;
    let validRecords = 0;
    let skippedRecords = 0;
    const allErrors: string[] = [];

    // For large datasets, return empty array and let database handle streaming
    const totalRows = parsedSheets.reduce((sum, sheet) => sum + sheet.data.length, 0);
    
    if (totalRows > 100000) {
      Logger.info('Large dataset detected - using direct database streaming', {
        sourceName,
        totalRows,
        note: 'Skipping in-memory transformation to prevent stack overflow'
      });
      
      // Store sheet data for direct database streaming
      this.cachedSheetData = parsedSheets;
      
      return {
        records: [], // Empty - will be streamed directly to database
        totalProcessed: totalRows,
        validRecords: totalRows,
        skippedRecords: 0,
        errors: [],
      };
    }

    // For smaller datasets, use normal transformation
    const allRecords: RuleRecord[] = [];

    for (const sheet of parsedSheets) {
      try {
        Logger.debug('Transforming sheet data', { 
          sheetName: sheet.sheetName, 
          records: sheet.data.length 
        });

        // Use streaming transformation for large single sheets
        const transformResult = this.streamingTransformation(sheet, sourceName);
        
        allRecords.push(...transformResult.records);
        allErrors.push(...transformResult.errors);
        totalProcessed += transformResult.totalProcessed;
        validRecords += transformResult.validRecords;
        skippedRecords += transformResult.skippedRecords;

      } catch (error: any) {
        const message = `Failed to transform sheet ${sheet.sheetName}`;
        Logger.error(message, { error: error.message, sourceName, sheetName: sheet.sheetName });
        errorCollector.addError('DataTransformer', message, { 
          sourceName, 
          sheetName: sheet.sheetName, 
          error: error.message 
        });
        allErrors.push(message);
      }
    }

    // NO DEDUPLICATION - Literal 1:1 migration as requested
    Logger.info('Preserving all records for literal 1:1 migration', {
      sourceName,
      totalRecords: allRecords.length,
      note: 'No deduplication applied - every XLSX row becomes a database record'
    });

    const result: TransformationResult = {
      records: allRecords,
      totalProcessed,
      validRecords: allRecords.length,
      skippedRecords,
      errors: allErrors,
    };

    Logger.info('Data transformation completed - LITERAL 1:1 MIGRATION', {
      sourceName,
      ...result,
      duplicatesRemoved: 0,
    });

    return result;
  }

  /**
   * Transforms a single sheet's data
   * @param sheet - Parsed sheet data
   * @param sourceName - Source identifier
   * @param errorCollector - Error collector instance
   * @returns Transformation result for the sheet
   */
  private async transformSheetData(
    sheet: ParsedSheet,
    sourceName: string,
    errorCollector: ErrorCollector
  ): Promise<TransformationResult> {
    const transformedRecords: RuleRecord[] = [];
    const errors: string[] = [];
    let skippedRecords = 0;

    // Process in batches to prevent stack overflow with large datasets
    const batchSize = 100;
    const totalRecords = sheet.data.length;
    
    Logger.debug('Processing sheet data in batches', {
      sheetName: sheet.sheetName,
      totalRecords,
      batchSize
    });

    for (let batchStart = 0; batchStart < totalRecords; batchStart += batchSize) {
      const batchEnd = Math.min(batchStart + batchSize, totalRecords);
      const batch = sheet.data.slice(batchStart, batchEnd);
      
      Logger.debug('Processing batch', {
        batchStart: batchStart + 1,
        batchEnd,
        batchSize: batch.length
      });

      // Process batch synchronously to avoid memory buildup
      for (let i = 0; i < batch.length; i++) {
        const globalIndex = batchStart + i;
        try {
          const record = batch[i];
          // Safely transform record with error boundaries
        const transformedRecord = this.safeTransformRecord(record, sheet.sheetName, globalIndex + 1);
          
          if (transformedRecord) {
            transformedRecords.push(transformedRecord);
          } else {
            skippedRecords++;
          }
        } catch (error: any) {
          const message = `Failed to transform record ${globalIndex + 1} in ${sheet.sheetName}`;
          Logger.error(message, { error: error.message, sourceName, sheetName: sheet.sheetName });
          errorCollector.addError('DataTransformer', message, {
            sourceName,
            sheetName: sheet.sheetName,
            recordIndex: globalIndex + 1,
            error: error.message,
          });
          errors.push(`Record ${globalIndex + 1}: ${error.message}`);
          skippedRecords++;
        }
      }
      
      // Log progress for large datasets
      if (totalRecords > 1000) {
        Logger.debug('Batch processing progress', {
          completed: batchEnd,
          total: totalRecords,
          progress: `${Math.round((batchEnd / totalRecords) * 100)}%`
        });
      }
    }

    return {
      records: transformedRecords,
      totalProcessed: sheet.data.length,
      validRecords: transformedRecords.length,
      skippedRecords,
      errors,
    };
  }

  /**
   * Literal 1:1 transformation - every XLSX row becomes a database record
   * Stream processing to prevent memory overflow for large datasets
   * @param sheet - Parsed sheet data
   * @param sourceName - Source identifier
   * @returns Literal transformation result
   */
  private bypassTransformation(sheet: ParsedSheet, sourceName: string): TransformationResult {
    const totalRows = sheet.data.length;
    
    Logger.info('Starting streaming transformation for literal 1:1 migration', {
      sourceName,
      totalRows,
      note: 'Processing records individually to prevent memory overflow'
    });
    
    // For very large datasets, use generator-based streaming
    if (totalRows > 50000) {
      return this.streamingTransformation(sheet, sourceName);
    }
    
    // For smaller datasets, use the original chunked approach
    const records: RuleRecord[] = [];
    const chunkSize = 25; // Even smaller chunks
    
    // Process in very small chunks
    for (let chunkStart = 0; chunkStart < totalRows; chunkStart += chunkSize) {
      const chunkEnd = Math.min(chunkStart + chunkSize, totalRows);
      
      Logger.debug('Processing chunk', {
        chunkStart: chunkStart + 1,
        chunkEnd,
        progress: `${Math.round((chunkEnd / totalRows) * 100)}%`
      });
      
      // Process this chunk with minimal memory usage
      for (let i = chunkStart; i < chunkEnd; i++) {
        const record = this.createMinimalRecord(sheet.data[i], i);
        records.push(record);
      }
      
      // Force garbage collection hint for large datasets
      if (totalRows > 10000 && chunkStart % 1000 === 0) {
        if (global.gc) {
          global.gc();
        }
      }
    }
    
    return {
      records,
      totalProcessed: totalRows,
      validRecords: records.length,
      skippedRecords: 0,
      errors: [],
    };
  }

  /**
   * Streaming transformation for very large datasets (50K+ records)
   * Uses generator pattern to minimize memory usage
   * @param sheet - Parsed sheet data
   * @param sourceName - Source identifier
   * @returns Literal transformation result
   */
  private streamingTransformation(sheet: ParsedSheet, sourceName: string): TransformationResult {
    Logger.info('Using streaming transformation for large dataset', {
      sourceName,
      totalRows: sheet.data.length,
      method: 'generator-based streaming'
    });
    
    const records: RuleRecord[] = [];
    const totalRows = sheet.data.length;
    const batchSize = 10; // Very small batches for streaming
    
    try {
      // Process in micro-batches
      for (let i = 0; i < totalRows; i += batchSize) {
        const batchEnd = Math.min(i + batchSize, totalRows);
        
        // Process micro-batch
        for (let j = i; j < batchEnd; j++) {
          const record = this.createMinimalRecord(sheet.data[j], j);
          records.push(record);
        }
        
        // Progress logging for large datasets
        if (i % 5000 === 0) {
          Logger.debug('Streaming progress', {
            processed: i,
            total: totalRows,
            progress: `${Math.round((i / totalRows) * 100)}%`,
            memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024 + ' MB'
          });
        }
        
        // Memory management
        if (i % 1000 === 0 && global.gc) {
          global.gc();
        }
      }
      
      Logger.info('Streaming transformation completed', {
        sourceName,
        totalProcessed: totalRows,
        recordsCreated: records.length
      });
      
      return {
        records,
        totalProcessed: totalRows,
        validRecords: records.length,
        skippedRecords: 0,
        errors: [],
      };
      
    } catch (error: any) {
      Logger.error('Streaming transformation failed', {
        sourceName,
        error: error.message,
        processedSoFar: records.length
      });
      
      // Return partial results instead of failing completely
      return {
        records,
        totalProcessed: records.length,
        validRecords: records.length,
        skippedRecords: totalRows - records.length,
        errors: [`Streaming transformation failed: ${error.message}`],
      };
    }
  }

  /**
   * Creates a minimal record with safe property access
   * @param sourceRecord - Source data record
   * @param index - Record index
   * @returns Minimal RuleRecord
   */
  private createMinimalRecord(sourceRecord: any, index: number): RuleRecord {
    try {
      // Ultra-minimal approach - direct property access without deep inspection
      return {
        code: this.getSafeValue(sourceRecord, ['code', 'Code'], `auto_row_${index + 1}`).slice(0, 100),
        description: this.getSafeValue(sourceRecord, ['description', 'Description'], '').slice(0, 500),
        label: this.getSafeValue(sourceRecord, ['label', 'Label'], '').slice(0, 200),
        requirement_level: this.getSafeValue(sourceRecord, ['requirement_level'], '').slice(0, 50),
        roles: this.getSafeValue(sourceRecord, ['roles', 'Roles'], '').slice(0, 200),
        type: this.getSafeValue(sourceRecord, ['type', 'Type'], '').slice(0, 50),
        validations: this.getSafeValue(sourceRecord, ['validations', 'Validations'], '').slice(0, 500),
        variant: this.getSafeValue(sourceRecord, ['variant', 'Variant'], '').slice(0, 100),
        'codigo-categoria-mirakl': this.getSafeValue(sourceRecord, ['codigo-categoria-mirakl'], '').slice(0, 100),
        'nome-categoria-mirakl': this.getSafeValue(sourceRecord, ['nome-categoria-mirakl'], '').slice(0, 200),
        'parent_code-categoria-mirakl': this.getSafeValue(sourceRecord, ['parent_code-categoria-mirakl'], '').slice(0, 100),
      };
    } catch (error) {
      // Return safe fallback record
      return {
        code: `error_row_${index + 1}`,
        description: 'Error processing this row',
        label: '',
        requirement_level: '',
        roles: '',
        type: '',
        validations: '',
        variant: '',
        'codigo-categoria-mirakl': '',
        'nome-categoria-mirakl': '',
        'parent_code-categoria-mirakl': '',
      };
    }
  }

  /**
   * Safely gets value from source record with fallback
   * @param record - Source record
   * @param keys - Possible property keys to try
   * @param fallback - Fallback value
   * @returns Safe string value
   */
  private getSafeValue(record: any, keys: string[], fallback: string = ''): string {
    if (!record || typeof record !== 'object') {
      return fallback;
    }
    
    for (const key of keys) {
      if (record[key] !== undefined && record[key] !== null) {
        return String(record[key]);
      }
    }
    
    return fallback;
  }

  /**
   * Safely transforms a record with full error isolation
   * @param record - Raw record data
   * @param sheetName - Name of the source sheet
   * @param recordIndex - Index of the record for logging
   * @returns Transformed record or null if invalid
   */
  private safeTransformRecord(
    record: any,
    sheetName: string,
    recordIndex: number
  ): RuleRecord | null {
    try {
      // Ultra-safe approach: manually extract each field
      const code = this.extractSafeString(record?.code || record?.Code || '');
      
      // Skip records without code
      if (!code || code.trim() === '') {
        Logger.debug('Skipping record without code', { sheetName, recordIndex });
        return null;
      }

      // Create record using only safe string extraction - no recursion
      const transformedRecord: RuleRecord = {
        code: code,
        description: this.extractSafeString(record?.description || record?.Description || ''),
        label: this.extractSafeString(record?.label || record?.Label || ''),
        requirement_level: this.extractSafeString(record?.requirement_level || record?.['requirement_level'] || ''),
        roles: this.extractSafeString(record?.roles || record?.Roles || ''),
        type: this.extractSafeString(record?.type || record?.Type || ''),
        validations: this.extractSafeString(record?.validations || record?.Validations || ''),
        variant: this.extractSafeString(record?.variant || record?.Variant || ''),
        'codigo-categoria-mirakl': this.extractSafeString(record?.['codigo-categoria-mirakl'] || ''),
        'nome-categoria-mirakl': this.extractSafeString(record?.['nome-categoria-mirakl'] || ''),
        'parent_code-categoria-mirakl': this.extractSafeString(record?.['parent_code-categoria-mirakl'] || ''),
      };

      // Apply simple business rules
      transformedRecord.requirement_level = this.safeNormalize(transformedRecord.requirement_level, 'requirement');
      transformedRecord.type = this.safeNormalize(transformedRecord.type, 'type');

      Logger.debug('Record transformed safely', { 
        sheetName, 
        recordIndex, 
        code: transformedRecord.code,
      });

      return transformedRecord;
    } catch (error) {
      Logger.error('Safe transform failed', { sheetName, recordIndex, error: error.message });
      return null;
    }
  }

  /**
   * Extracts string safely without recursion
   * @param value - Input value
   * @returns Safe string
   */
  private extractSafeString(value: any): string {
    if (value === null || value === undefined) return '';
    
    let str = '';
    if (typeof value === 'string') {
      str = value;
    } else if (typeof value === 'number') {
      str = value.toString();
    } else if (typeof value === 'boolean') {
      str = value ? 'true' : 'false';
    } else {
      str = String(value);
    }
    
    // Simple cleanup without complex regex
    return str
      .trim()
      .substring(0, 2000)
      .replace(/\s+/g, ' ')
      .replace(/[\r\n\t]/g, ' ');
  }

  /**
   * Safe normalization without recursion
   * @param value - Value to normalize
   * @param type - Type of normalization
   * @returns Normalized value
   */
  private safeNormalize(value: string, type: string): string {
    if (!value) return '';
    
    const lowerValue = value.toLowerCase().trim();
    
    if (type === 'requirement') {
      if (lowerValue.includes('required') || lowerValue.includes('mandatory')) return 'required';
      if (lowerValue.includes('optional')) return 'optional';
      if (lowerValue.includes('conditional')) return 'conditional';
    }
    
    if (type === 'type') {
      if (lowerValue.includes('text')) return 'text';
      if (lowerValue.includes('number')) return 'number';
      if (lowerValue.includes('date')) return 'date';
      if (lowerValue.includes('boolean')) return 'boolean';
    }
    
    return value;
  }

  /**
   * Legacy transform method (kept for compatibility but not used)
   * @param record - Raw record data
   * @param sheetName - Name of the source sheet
   * @param recordIndex - Index of the record for logging
   * @returns Transformed record or null if invalid
   */
  private transformRecordSync(
    record: RuleRecord,
    sheetName: string,
    recordIndex: number
  ): RuleRecord | null {
    // Skip records without required fields
    if (!record.code || record.code.toString().trim() === '') {
      Logger.debug('Skipping record without code', { sheetName, recordIndex });
      return null;
    }

    // Create a clean copy of the record
    const transformedRecord: RuleRecord = {
      code: this.sanitizeText(record.code),
      description: this.sanitizeText(record.description),
      label: this.sanitizeText(record.label),
      requirement_level: this.sanitizeText(record.requirement_level),
      roles: this.sanitizeText(record.roles),
      type: this.sanitizeText(record.type),
      validations: this.sanitizeText(record.validations),
      variant: this.sanitizeText(record.variant),
      'codigo-categoria-mirakl': this.sanitizeText(record['codigo-categoria-mirakl']),
      'nome-categoria-mirakl': this.sanitizeText(record['nome-categoria-mirakl']),
      'parent_code-categoria-mirakl': this.sanitizeText(record['parent_code-categoria-mirakl']),
    };

    // Apply business rules transformation
    transformedRecord.requirement_level = this.normalizeRequirementLevel(transformedRecord.requirement_level);
    transformedRecord.type = this.normalizeType(transformedRecord.type);

    Logger.debug('Record transformed', { 
      sheetName, 
      recordIndex, 
      code: transformedRecord.code,
      type: transformedRecord.type,
    });

    return transformedRecord;
  }

  /**
   * Transforms a single record (async version - deprecated, kept for compatibility)
   * @param record - Raw record from XLSX
   * @param sheetName - Name of the source sheet
   * @param recordIndex - Index of the record for logging
   * @returns Transformed record or null if should be skipped
   */
  private async transformRecord(
    record: RuleRecord,
    sheetName: string,
    recordIndex: number
  ): Promise<RuleRecord | null> {
    // Skip records without required fields
    if (!record.code || record.code.trim() === '') {
      Logger.debug('Skipping record without code', { sheetName, recordIndex });
      return null;
    }

    // Create a clean copy of the record
    const transformedRecord: RuleRecord = {
      code: this.sanitizeText(record.code),
      description: this.sanitizeText(record.description),
      label: this.sanitizeText(record.label),
      requirement_level: this.sanitizeText(record.requirement_level),
      roles: this.sanitizeText(record.roles),
      type: this.sanitizeText(record.type),
      validations: this.sanitizeText(record.validations),
      variant: this.sanitizeText(record.variant),
      'codigo-categoria-mirakl': this.sanitizeText(record['codigo-categoria-mirakl']),
      'nome-categoria-mirakl': this.sanitizeText(record['nome-categoria-mirakl']),
      'parent_code-categoria-mirakl': this.sanitizeText(record['parent_code-categoria-mirakl']),
    };

    // Apply business rules transformation
    transformedRecord.requirement_level = this.normalizeRequirementLevel(transformedRecord.requirement_level);
    transformedRecord.type = this.normalizeType(transformedRecord.type);

    Logger.debug('Record transformed', { 
      sheetName, 
      recordIndex, 
      code: transformedRecord.code,
      type: transformedRecord.type,
    });

    return transformedRecord;
  }

  /**
   * Sanitizes text fields safely
   * @param text - Input text
   * @returns Sanitized text
   */
  private sanitizeText(text: any): string {
    if (text === null || text === undefined) return '';
    
    // Convert to string safely
    let str: string;
    if (typeof text === 'string') {
      str = text;
    } else if (typeof text === 'number') {
      str = text.toString();
    } else if (typeof text === 'boolean') {
      str = text.toString();
    } else {
      str = String(text);
    }
    
    // Basic sanitization without complex regex that could cause stack overflow
    return str
      .trim()
      .substring(0, 2000) // Limit length first to prevent memory issues
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/[\r\n\t]/g, ' '); // Replace line breaks and tabs with spaces
  }

  /**
   * Normalizes requirement level values
   * @param level - Raw requirement level
   * @returns Normalized requirement level
   */
  private normalizeRequirementLevel(level: string): string {
    if (!level) return '';

    const normalized = level.toLowerCase().trim();
    
    const mappings: { [key: string]: string } = {
      'required': 'REQUIRED',
      'mandatory': 'REQUIRED',
      'obrigatorio': 'REQUIRED',
      'obrigatório': 'REQUIRED',
      'optional': 'OPTIONAL',
      'opcional': 'OPTIONAL',
      'recommended': 'RECOMMENDED',
      'recomendado': 'RECOMMENDED',
    };

    return mappings[normalized] || level.toUpperCase();
  }

  /**
   * Normalizes type values
   * @param type - Raw type value
   * @returns Normalized type
   */
  private normalizeType(type: string): string {
    if (!type) return '';

    const normalized = type.toLowerCase().trim();
    
    const mappings: { [key: string]: string } = {
      'attribute': 'ATTRIBUTE',
      'atributo': 'ATTRIBUTE',
      'category': 'CATEGORY',
      'categoria': 'CATEGORY',
      'validation': 'VALIDATION',
      'validacao': 'VALIDATION',
      'validação': 'VALIDATION',
      'rule': 'RULE',
      'regra': 'RULE',
    };

    return mappings[normalized] || type.toUpperCase();
  }

  /**
   * Removes duplicate records based on code
   * @param records - Array of records
   * @param sourceName - Source identifier for logging
   * @returns Deduplicated records
   */
  private deduplicateRecords(records: RuleRecord[], sourceName: string): RuleRecord[] {
    Logger.debug('Starting deduplication', { sourceName, recordCount: records.length });

    const seen = new Set<string>();
    const deduplicated: RuleRecord[] = [];

    for (const record of records) {
      const key = record.code.toLowerCase().trim();
      
      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(record);
      } else {
        Logger.debug('Duplicate record skipped', { sourceName, code: record.code });
      }
    }

    Logger.debug('Deduplication completed', {
      sourceName,
      originalCount: records.length,
      deduplicatedCount: deduplicated.length,
      duplicatesRemoved: records.length - deduplicated.length,
    });

    return deduplicated;
  }

  /**
   * Validates transformed records before database insertion
   * @param records - Transformed records
   * @param sourceName - Source identifier
   * @param errorCollector - Error collector instance
   * @returns Validation results
   */
  async validateTransformedRecords(
    records: RuleRecord[],
    sourceName: string,
    errorCollector: ErrorCollector
  ): Promise<{ validRecords: RuleRecord[]; invalidRecords: number; errors: string[] }> {
    Logger.info('Starting record validation', { sourceName, recordCount: records.length });

    const validRecords: RuleRecord[] = [];
    const errors: string[] = [];
    let invalidRecords = 0;

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const validationErrors = this.validateRecord(record, i + 1);

      if (validationErrors.length === 0) {
        validRecords.push(record);
      } else {
        invalidRecords++;
        const errorMessage = `Record ${i + 1} (${record.code}): ${validationErrors.join(', ')}`;
        errors.push(errorMessage);
        errorCollector.addError('DataTransformer', errorMessage, {
          sourceName,
          recordIndex: i + 1,
          code: record.code,
          validationErrors,
        });
      }
    }

    Logger.info('Record validation completed', {
      sourceName,
      totalRecords: records.length,
      validRecords: validRecords.length,
      invalidRecords,
      errorCount: errors.length,
    });

    return { validRecords, invalidRecords, errors };
  }

  /**
   * Validates a single record
   * @param record - Record to validate
   * @param index - Record index for error messages
   * @returns Array of validation error messages
   */
  private validateRecord(record: RuleRecord, index: number): string[] {
    const errors: string[] = [];

    // Required fields validation
    if (!record.code || record.code.trim() === '') {
      errors.push('Missing required field: code');
    }

    // Length validations
    if (record.code && record.code.length > 255) {
      errors.push('Code field too long (max 255 characters)');
    }

    if (record.description && record.description.length > 2000) {
      errors.push('Description field too long (max 2000 characters)');
    }

    // Business rules validation
    if (record.requirement_level && !['REQUIRED', 'OPTIONAL', 'RECOMMENDED'].includes(record.requirement_level)) {
      errors.push(`Invalid requirement_level: ${record.requirement_level}`);
    }

    return errors;
  }

  /**
   * Gets cached sheet data for direct database streaming
   * @returns Cached parsed sheets
   */
  getCachedSheetData(): ParsedSheet[] {
    return this.cachedSheetData;
  }

  /**
   * Clears cached sheet data to free memory
   */
  clearCachedSheetData(): void {
    this.cachedSheetData = [];
  }

  /**
   * Generator function to stream records directly from cached data
   * @param batchSize - Number of records per batch
   * @yields Batches of RuleRecord
   */
  *streamRecordsFromCache(batchSize: number = 1000): Generator<RuleRecord[], void, unknown> {
    Logger.info('Starting direct record streaming from cached data', {
      sheetsCount: this.cachedSheetData.length,
      batchSize,
      totalRows: this.cachedSheetData.reduce((sum, sheet) => sum + sheet.data.length, 0)
    });

    for (const sheet of this.cachedSheetData) {
      Logger.debug('Streaming records from sheet', {
        sheetName: sheet.sheetName,
        totalRows: sheet.data.length
      });

      const batch: RuleRecord[] = [];
      
      for (let i = 0; i < sheet.data.length; i++) {
        try {
          const record = this.createMinimalRecord(sheet.data[i], i);
          batch.push(record);

          // Yield batch when full
          if (batch.length >= batchSize) {
            yield batch.splice(0, batchSize);
          }
        } catch (error: any) {
          Logger.debug('Skipping problematic record during streaming', {
            sheetName: sheet.sheetName,
            recordIndex: i,
            error: error.message
          });
        }
      }

      // Yield remaining records in batch
      if (batch.length > 0) {
        yield batch;
      }
    }

    Logger.info('Record streaming completed');
  }
}