# 🔧 Technical Documentation

## Architecture Overview

The XLSX to Database Migration System is a Node.js TypeScript application designed for high-performance, memory-efficient migration of Google Sheets data to PostgreSQL databases.

## 🏗️ System Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Google Sheets │────│   XLSX Migration │────│   PostgreSQL    │
│                 │    │      System      │    │    Database     │
├─────────────────┤    ├──────────────────┤    ├─────────────────┤
│ • JWT Auth      │    │ • Stream Process │    │ • Connection    │
│ • CSV Export    │    │ • Memory Mgmt    │    │   Pooling       │
│ • Redirect      │    │ • Batch Insert   │    │ • Auto Schema   │
│   Handling      │    │ • Error Recovery │    │ • Transaction   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 📊 Data Flow Pipeline

```
1. Google Sheets Access
   ├── JWT Authentication
   ├── URL Conversion (share → export)
   └── Redirect Handling (307)

2. XLSX Download & Parsing
   ├── Large File Handling (79MB+)
   ├── CSV → XLSX Conversion
   └── Multi-sheet Processing

3. Smart Data Processing
   ├── Dataset Size Detection
   ├── Memory-efficient Streaming (>100K)
   └── Column Mapping & Validation

4. Database Migration
   ├── Auto Table Creation
   ├── Batch Processing (500-1000 records)
   └── Progress Monitoring

5. Verification & Reporting
   ├── Data Integrity Checks
   ├── Error Collection
   └── Final Status Report
```

## 🚀 Performance Characteristics

### **Memory Management**
- **Small Datasets (<100K)**: In-memory processing
- **Large Datasets (>100K)**: Automatic streaming with generator patterns
- **Memory Usage**: 400-550MB peak for 146K+ records
- **Garbage Collection**: Proactive cleanup every 1K batches

### **Processing Speed**
- **Average Throughput**: ~1,800 records/second
- **Largest Dataset**: 146,640 records in 81.7 seconds
- **Concurrent Processing**: Optimized for single-table sequential migration

## 🔐 Security Architecture

### **Authentication**
```typescript
// Manual JWT Implementation (bypasses googleapis hanging)
const jwt = {
  header: { alg: 'RS256', typ: 'JWT' },
  payload: {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  }
};
```

### **Database Security**
- Connection pooling with credential isolation
- Parameterized queries (SQL injection prevention)
- No sensitive data logging
- Environment variable configuration

## 📁 Code Architecture

### **Core Components**

```typescript
// Main Entry Point
src/index.ts
├── Signal handling (SIGINT, SIGTERM)
├── Global error catching
└── Graceful shutdown

// CLI Interface
src/cli.ts
├── Argument parsing & validation
├── Help system
└── Option handling

// Google Sheets Integration
src/google/sheets.ts
├── Manual JWT authentication
├── Redirect handling (307)
├── Large file downloads
└── Error recovery

// Data Processing
src/processing/
├── xlsx-parser.ts       // Multi-sheet parsing
└── data-transformer.ts  // Streaming transformation

// Database Layer
src/database/
├── connection.ts        // Pool management
├── schema.ts           // Table definitions
└── migration.ts        // Batch operations

// Services
src/services/migration-service.ts
└── Main orchestration logic
```

### **Streaming Implementation**

```typescript
// Large Dataset Detection
if (totalRows > 100000) {
  return this.streamingTransformation(sheet, sourceName);
}

// Generator-based Streaming
*streamRecordsFromCache(batchSize = 1000): Generator<RuleRecord[]> {
  for (const sheet of this.cachedSheetData) {
    const batch: RuleRecord[] = [];
    for (let i = 0; i < sheet.data.length; i++) {
      const record = this.createMinimalRecord(sheet.data[i], i);
      batch.push(record);
      
      if (batch.length >= batchSize) {
        yield batch.splice(0, batchSize);
      }
    }
    if (batch.length > 0) yield batch;
  }
}
```

## 🗄️ Database Schema Design

### **Migration Configuration Table**
```sql
CREATE TABLE migration_configuration (
  id SERIAL PRIMARY KEY,
  table_name TEXT UNIQUE NOT NULL,
  google_sheets_url TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### **Rule Tables Structure**
```sql
CREATE TABLE rules_[name] (
  id SERIAL PRIMARY KEY UNIQUE,        -- Auto-increment for uniqueness
  code TEXT,                          -- Rule identifier
  description TEXT,                   -- Rule description
  label TEXT,                         -- Display label
  requirement_level TEXT,             -- REQUIRED/OPTIONAL/RECOMMENDED
  roles TEXT,                         -- JSON array of roles
  type TEXT,                          -- Rule type
  validations TEXT,                   -- Validation rules
  variant TEXT,                       -- Variant flag
  "codigo-categoria-mirakl" TEXT,     -- Mirakl category code
  "nome-categoria-mirakl" TEXT,       -- Mirakl category name
  "parent_code-categoria-mirakl" TEXT -- Parent category
);
```

## 🔧 Configuration Management

### **Environment Variables**
```bash
# Database
DB_HOST=localhost
DB_PORT=5433
DB_NAME=marketplaces-inhelp
DB_USER=migration_user
DB_PASSWORD=migration_password
DB_SSL=false

# Google Cloud
GOOGLE_CLOUD_PROJECT_ID=mirakl-catalogue-marketplaces
GOOGLE_APPLICATION_CREDENTIALS=./service-account-mirakl-cat-mkt.json

# Application
LOG_LEVEL=info
NODE_ENV=development
BATCH_SIZE=1000
```

### **Runtime Configuration**
```typescript
export const appConfig = {
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'marketplaces-inhelp',
    user: process.env.DB_USER || 'migration_user',
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === 'true'
  },
  migration: {
    batchSize: parseInt(process.env.BATCH_SIZE || '1000'),
    maxRetries: parseInt(process.env.MAX_RETRIES || '3'),
    timeout: parseInt(process.env.MIGRATION_TIMEOUT || '300000')
  }
};
```

## 📈 Error Handling Strategy

### **Error Collection System**
```typescript
export class ErrorCollector {
  private errors: ErrorEntry[] = [];

  addError(source: string, message: string, context?: any): void {
    this.errors.push({
      source,
      message,
      context,
      timestamp: new Date().toISOString()
    });
  }

  generateReport(): string {
    // Comprehensive error reporting
  }
}
```

### **Recovery Mechanisms**
1. **Google Sheets Access**: Automatic fallback to direct HTTP download
2. **Memory Issues**: Automatic streaming for large datasets
3. **Database Errors**: Transaction rollback and retry logic
4. **Network Issues**: Configurable retry with exponential backoff

## 🔍 Monitoring & Logging

### **Structured Logging**
```typescript
// Winston Configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console()
  ]
});
```

### **Progress Tracking**
```typescript
// Real-time Migration Progress
Logger.info('Streaming migration progress', {
  tableName,
  batchesProcessed: 150,
  recordsInserted: 75000,
  recordsSkipped: 0,
  memoryUsage: '432MB',
  progress: '59%'
});
```

## 🧪 Testing Strategy

### **Integration Testing**
```bash
# Dry Run Testing
npm run start:ts -- --table rules_test --dry-run --verbose

# Small Dataset Testing
npm run start:ts -- --table rules_small_test --verbose

# Large Dataset Testing (production simulation)
npm run start:ts -- --table rules_worten_pt --verbose
```

### **Database Verification**
```sql
-- Record Count Verification
SELECT 
  table_name,
  (xpath('/row/c/text()', xml_count))[1]::text::int as count 
FROM (
  SELECT 
    'rules_worten_pt' as table_name,
    query_to_xml('SELECT COUNT(*) as c FROM rules_worten_pt', false, true, '') as xml_count
) as subq;

-- Data Integrity Checks
SELECT 
  COUNT(*) as total_records,
  COUNT(DISTINCT id) as unique_ids,
  COUNT(CASE WHEN code IS NULL OR code = '' THEN 1 END) as missing_codes
FROM rules_worten_pt;
```

## 🚀 Performance Optimization

### **Memory Optimization**
1. **Streaming Processing**: Generator patterns for large datasets
2. **Garbage Collection**: Explicit cleanup every 1K records
3. **Batch Processing**: Configurable batch sizes (500-1000)
4. **Connection Pooling**: Reuse database connections

### **I/O Optimization**
1. **HTTP Connection Reuse**: Keep-alive for Google Sheets
2. **Database Prepared Statements**: Query plan caching
3. **Transaction Batching**: Reduce commit overhead
4. **Asynchronous Processing**: Non-blocking operations

### **Bottleneck Analysis**
- **Memory**: 400-550MB peak usage (well within Node.js limits)
- **CPU**: Single-threaded processing (can be parallelized if needed)
- **Network**: Dependent on Google Sheets API response times
- **Database**: PostgreSQL can handle >2K inserts/second

## 🔄 Deployment Considerations

### **Production Requirements**
- Node.js v18+ recommended
- PostgreSQL 13+ with sufficient storage
- Google Cloud Service Account with Sheets API access
- Minimum 1GB RAM, 2GB recommended for large datasets

### **Scalability**
- **Horizontal**: Multiple instances for different marketplaces
- **Vertical**: Increase memory for larger datasets
- **Database**: PostgreSQL read replicas for analytics

### **Monitoring**
- Application logs in structured JSON format
- Database performance metrics
- Memory usage tracking
- Migration success/failure rates

This technical documentation provides a comprehensive overview of the system's architecture, performance characteristics, and implementation details for development and maintenance purposes.