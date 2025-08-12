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

        const transformResult = await this.transformSheetData(sheet, sourceName, errorCollector);
        
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

    for (let i = 0; i < sheet.data.length; i++) {
      try {
        const record = sheet.data[i];
        const transformedRecord = await this.transformRecord(record, sheet.sheetName, i + 1);
        
        if (transformedRecord) {
          transformedRecords.push(transformedRecord);
        } else {
          skippedRecords++;
        }
      } catch (error: any) {
        const message = `Failed to transform record ${i + 1} in ${sheet.sheetName}`;
        Logger.error(message, { error: error.message, sourceName, sheetName: sheet.sheetName });
        errorCollector.addError('DataTransformer', message, {
          sourceName,
          sheetName: sheet.sheetName,
          recordIndex: i + 1,
          error: error.message,
        });
        errors.push(`Record ${i + 1}: ${error.message}`);
        skippedRecords++;
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
   * Transforms a single record
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
   * Sanitizes text fields
   * @param text - Input text
   * @returns Sanitized text
   */
  private sanitizeText(text: string): string {
    if (!text) return '';
    
    return text
      .toString()
      .trim()
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/[\r\n\t]/g, ' ') // Replace line breaks and tabs with spaces
      .slice(0, 2000); // Limit length to prevent database issues
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