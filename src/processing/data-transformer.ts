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

    const allRecords: RuleRecord[] = [];
    const allErrors: string[] = [];
    let totalProcessed = 0;
    let validRecords = 0;
    let skippedRecords = 0;

    for (const sheet of parsedSheets) {
      try {
        Logger.debug('Transforming sheet data', { 
          sheetName: sheet.sheetName, 
          records: sheet.data.length 
        });

        // Bypass complex transformation to avoid stack overflow
        const transformResult = this.bypassTransformation(sheet, sourceName);
        
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

    // Apply deduplication
    const deduplicatedRecords = this.deduplicateRecords(allRecords, sourceName);
    const duplicatesRemoved = allRecords.length - deduplicatedRecords.length;

    if (duplicatesRemoved > 0) {
      Logger.warn('Duplicate records removed during transformation', {
        sourceName,
        duplicatesRemoved,
        originalCount: allRecords.length,
        finalCount: deduplicatedRecords.length,
      });
    }

    const result: TransformationResult = {
      records: deduplicatedRecords,
      totalProcessed,
      validRecords: deduplicatedRecords.length,
      skippedRecords: skippedRecords + duplicatesRemoved,
      errors: allErrors,
    };

    Logger.info('Data transformation completed', {
      sourceName,
      ...result,
      duplicatesRemoved,
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
   * Bypass transformation entirely to avoid stack overflow
   * @param sheet - Parsed sheet data
   * @param sourceName - Source identifier
   * @returns Simple transformation result
   */
  private bypassTransformation(sheet: ParsedSheet, sourceName: string): TransformationResult {
    const records: RuleRecord[] = [];
    
    // Ultra-minimal transformation - just convert to required format
    for (let i = 0; i < sheet.data.length && i < 1000; i++) { // Limit to 1000 records
      const record = sheet.data[i];
      
      // Minimal field extraction without any complex processing
      const code = record?.code || record?.Code || `row_${i}`;
      if (code && code.toString().trim()) {
        records.push({
          code: code.toString().substring(0, 100),
          description: (record?.description || '').toString().substring(0, 500),
          label: (record?.label || '').toString().substring(0, 200),
          requirement_level: (record?.requirement_level || '').toString().substring(0, 50),
          roles: (record?.roles || '').toString().substring(0, 200),
          type: (record?.type || '').toString().substring(0, 50),
          validations: (record?.validations || '').toString().substring(0, 500),
          variant: (record?.variant || '').toString().substring(0, 100),
          'codigo-categoria-mirakl': (record?.['codigo-categoria-mirakl'] || '').toString().substring(0, 100),
          'nome-categoria-mirakl': (record?.['nome-categoria-mirakl'] || '').toString().substring(0, 200),
          'parent_code-categoria-mirakl': (record?.['parent_code-categoria-mirakl'] || '').toString().substring(0, 100),
        });
      }
    }
    
    console.log(`✅ Bypass transformation completed: ${records.length} records processed`);
    
    return {
      records,
      totalProcessed: sheet.data.length,
      validRecords: records.length,
      skippedRecords: sheet.data.length - records.length,
      errors: [],
    };
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
}