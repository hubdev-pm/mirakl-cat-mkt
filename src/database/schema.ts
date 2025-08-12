export interface RuleRecord {
  code: string;
  description: string;
  label: string;
  requirement_level: string;
  roles: string;
  type: string;
  validations: string;
  variant: string;
  'codigo-categoria-mirakl': string;
  'nome-categoria-mirakl': string;
  'parent_code-categoria-mirakl': string;
}

export interface ConfigurationMapping {
  table_name: string;
  google_sheets_url: string;
  created_at: Date;
  updated_at: Date;
}

export const RULE_TABLE_COLUMNS = [
  'code',
  'description',
  'label',
  'requirement_level',
  'roles',
  'type',
  'validations',
  'variant',
  'codigo-categoria-mirakl',
  'nome-categoria-mirakl',
  'parent_code-categoria-mirakl',
] as const;

export const INITIAL_TABLE_MAPPINGS: Omit<ConfigurationMapping, 'created_at' | 'updated_at'>[] = [
  {
    table_name: 'rules_worten_pt',
    google_sheets_url: 'https://docs.google.com/spreadsheets/d/13NijIiZQpwKbLndz76Mj7-MkNurehiNu/edit?usp=sharing&ouid=108323945213256378916&rtpof=true&sd=true',
  },
  {
    table_name: 'rules_pccomp_pt',
    google_sheets_url: 'https://docs.google.com/spreadsheets/d/1EiycfU4p87g5bwP1lF0rS1kSZTLfq8Pj/edit?usp=drive_link&ouid=108323945213256378916&rtpof=true&sd=true',
  },
  {
    table_name: 'rules_pccomp_es',
    google_sheets_url: 'https://docs.google.com/spreadsheets/d/1fVX8KA_SK0kW1TD-wSrRs0U6ahoP7DQI/edit?usp=drive_link&ouid=108323945213256378916&rtpof=true&sd=true',
  },
  {
    table_name: 'rules_carrefour_fr',
    google_sheets_url: 'https://docs.google.com/spreadsheets/d/1C33ky1xGnfwvFYCGl6mbve6hmtxr_7Hf/edit?usp=drive_link&ouid=108323945213256378916&rtpof=true&sd=true',
  },
  {
    table_name: 'rules_carrefour_es',
    google_sheets_url: 'https://docs.google.com/spreadsheets/d/1C2qm-ccZnhDMaXTVvrtr4VB-CbS0UD5l/edit?usp=drive_link&ouid=108323945213256378916&rtpof=true&sd=true',
  },
];

export function generateCreateTableSQL(tableName: string): string {
  const columns = RULE_TABLE_COLUMNS.map(col => `"${col}" TEXT`).join(',\n  ');
  
  return `
CREATE TABLE IF NOT EXISTS "${tableName}" (
  id SERIAL PRIMARY KEY,
  ${columns},
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_${tableName}_code" ON "${tableName}" ("code");
CREATE INDEX IF NOT EXISTS "idx_${tableName}_type" ON "${tableName}" ("type");
  `.trim();
}

export function generateConfigurationTableSQL(): string {
  return `
CREATE TABLE IF NOT EXISTS "migration_configuration" (
  id SERIAL PRIMARY KEY,
  table_name TEXT UNIQUE NOT NULL,
  google_sheets_url TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_migration_configuration_table_name" ON "migration_configuration" ("table_name");
  `.trim();
}

export function generateInsertConfigurationSQL(): string {
  const values = INITIAL_TABLE_MAPPINGS.map(
    mapping => `('${mapping.table_name}', '${mapping.google_sheets_url}')`
  ).join(',\n  ');

  return `
INSERT INTO "migration_configuration" (table_name, google_sheets_url)
VALUES
  ${values}
ON CONFLICT (table_name) 
DO UPDATE SET 
  google_sheets_url = EXCLUDED.google_sheets_url,
  updated_at = CURRENT_TIMESTAMP;
  `.trim();
}