# 📝 Adding New Google Sheets for Migration

This guide shows you how to add new Google Sheets to the migration system. The process is simple and requires no code changes.

## 🎯 Quick Steps Overview

1. **Prepare the Google Sheet** with proper headers
2. **Add configuration** to the database
3. **Run the migration** command
4. **Verify the results**

---

## 📋 Step 1: Prepare Your Google Sheet

### **Required Sheet Structure**

Your Google Sheet must have these **exact column headers** in the first row:

```
code | description | label | requirement_level | roles | type | validations | variant | codigo-categoria-mirakl | nome-categoria-mirakl | parent_code-categoria-mirakl
```

### **Example Sheet Structure**
```
| code           | description        | label    | requirement_level | roles | type | validations | variant | codigo-categoria-mirakl | nome-categoria-mirakl | parent_code-categoria-mirakl |
|----------------|--------------------|----------|-------------------|-------|------|-------------|---------|-------------------------|----------------------|------------------------------|
| product_id     | Product identifier | ID       | REQUIRED          | []    | TEXT |             |         | CAT001                 | Electronics          |                              |
| product_name   | Product name       | Name     | REQUIRED          | []    | TEXT | MAX_LENGTH  |         | CAT001                 | Electronics          |                              |
```

### **Sheet Permissions**

1. **Share the Google Sheet** with the service account email:
   ```
   xlsx-migration-service@mirakl-catalogue-marketplaces.iam.gserviceaccount.com
   ```

2. **Set permissions** to "Viewer" or "Editor"

3. **Get the shareable link** from Google Sheets:
   - Click "Share" button
   - Copy the link (should look like: `https://docs.google.com/spreadsheets/d/SHEET_ID/edit...`)

---

## 🗄️ Step 2: Add Configuration to Database

### **Option A: Direct Database Command**

```bash
# Connect to the database
docker exec -it xlsx-migration-postgres psql -U migration_user -d marketplaces-inhelp

# Add your new sheet configuration
INSERT INTO migration_configuration (table_name, google_sheets_url) 
VALUES (
  'rules_new_marketplace',  -- Your table name (must start with 'rules_')
  'https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit?usp=sharing'  -- Your Google Sheet URL
);

# Verify the configuration
SELECT table_name, google_sheets_url FROM migration_configuration ORDER BY table_name;

# Exit the database
\q
```

### **Option B: Using SQL File**

Create a file `add_new_sheet.sql`:
```sql
INSERT INTO migration_configuration (table_name, google_sheets_url) 
VALUES (
  'rules_new_marketplace',
  'https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit?usp=sharing'
);
```

Execute it:
```bash
docker exec -i xlsx-migration-postgres psql -U migration_user -d marketplaces-inhelp < add_new_sheet.sql
```

---

## 🚀 Step 3: Run the Migration

### **Test with Dry Run First**
```bash
# Preview the migration without making changes
npm run start:ts -- --table rules_new_marketplace --dry-run --verbose
```

### **Execute the Migration**
```bash
# Migrate the new table
npm run start:ts -- --table rules_new_marketplace --verbose
```

### **Or Migrate All Tables** (including new ones)
```bash
# Migrate all configured tables
npm run start:ts
```

---

## ✅ Step 4: Verify the Results

### **Check Record Count**
```bash
docker exec xlsx-migration-postgres psql -U migration_user -d marketplaces-inhelp -c "
SELECT COUNT(*) as total_records FROM rules_new_marketplace;"
```

### **View Sample Data**
```bash
docker exec xlsx-migration-postgres psql -U migration_user -d marketplaces-inhelp -c "
SELECT id, code, description FROM rules_new_marketplace ORDER BY id LIMIT 5;"
```

### **Verify Table Structure**
```bash
docker exec xlsx-migration-postgres psql -U migration_user -d marketplaces-inhelp -c "
\d rules_new_marketplace"
```

---

## 📖 Multiple Sheets Example

To add multiple sheets at once:

```sql
INSERT INTO migration_configuration (table_name, google_sheets_url) VALUES
  ('rules_amazon_us', 'https://docs.google.com/spreadsheets/d/AMAZON_SHEET_ID/edit'),
  ('rules_ebay_uk', 'https://docs.google.com/spreadsheets/d/EBAY_SHEET_ID/edit'),
  ('rules_aliexpress_global', 'https://docs.google.com/spreadsheets/d/ALIEXPRESS_SHEET_ID/edit');
```

Then migrate all:
```bash
npm run start:ts
```

---

## 🔧 Advanced Configuration Options

### **Table Naming Convention**
- Table names must start with `rules_`
- Use lowercase letters and underscores
- Examples: `rules_marketplace_name`, `rules_region_country`

### **Large Dataset Handling**
The system automatically detects and handles large datasets:
- **< 100K records**: Normal processing
- **> 100K records**: Automatic streaming migration
- No configuration changes needed

### **Re-running Migrations**
To re-migrate a table (replace existing data):
```bash
# Drop the existing table first
docker exec xlsx-migration-postgres psql -U migration_user -d marketplaces-inhelp -c "
DROP TABLE IF EXISTS rules_new_marketplace;"

# Then run the migration again
npm run start:ts -- --table rules_new_marketplace
```

---

## 🛠️ Troubleshooting

### **Common Issues**

1. **"Table not found in configuration"**
   - Verify the table was added to `migration_configuration`
   - Check the table name spelling

2. **"Sheet validation failed"**
   - Ensure the service account has access to the sheet
   - Verify the Google Sheet URL is correct

3. **"Column mapping failed"**
   - Check that all required headers are present in the first row
   - Ensure headers match exactly (case-sensitive)

4. **"Stack overflow" errors**
   - This should not happen with the current streaming system
   - If it occurs, contact support

### **Debug Commands**

```bash
# View current configuration
docker exec xlsx-migration-postgres psql -U migration_user -d marketplaces-inhelp -c "
SELECT * FROM migration_configuration;"

# Check logs
npm run start:ts -- --table rules_new_marketplace --verbose

# Test Google Sheets access
npm run start:ts -- --table rules_new_marketplace --dry-run
```

---

## 📝 Configuration Management

### **View All Configured Tables**
```bash
docker exec xlsx-migration-postgres psql -U migration_user -d marketplaces-inhelp -c "
SELECT 
  table_name,
  google_sheets_url,
  created_at,
  updated_at 
FROM migration_configuration 
ORDER BY created_at;"
```

### **Update Existing Configuration**
```sql
UPDATE migration_configuration 
SET 
  google_sheets_url = 'https://docs.google.com/spreadsheets/d/NEW_SHEET_ID/edit',
  updated_at = CURRENT_TIMESTAMP
WHERE table_name = 'rules_existing_table';
```

### **Remove Configuration**
```sql
DELETE FROM migration_configuration 
WHERE table_name = 'rules_old_table';
```

---

## 🎯 Best Practices

1. **Always test with `--dry-run` first**
2. **Use descriptive table names** that reflect the marketplace/region
3. **Keep Google Sheets organized** with consistent formatting
4. **Monitor migration logs** for any warnings or errors
5. **Verify data integrity** after each migration
6. **Backup important data** before large migrations

---

## 🔗 Quick Reference

### **Essential Commands**
```bash
# Add new sheet configuration (replace values)
docker exec xlsx-migration-postgres psql -U migration_user -d marketplaces-inhelp -c "
INSERT INTO migration_configuration (table_name, google_sheets_url) 
VALUES ('rules_YOUR_TABLE', 'YOUR_GOOGLE_SHEETS_URL');"

# Test migration
npm run start:ts -- --table rules_YOUR_TABLE --dry-run

# Execute migration  
npm run start:ts -- --table rules_YOUR_TABLE

# Verify results
docker exec xlsx-migration-postgres psql -U migration_user -d marketplaces-inhelp -c "
SELECT COUNT(*) FROM rules_YOUR_TABLE;"
```

That's it! The system will handle everything else automatically, including creating the table, downloading the data, and migrating all records with zero data loss.