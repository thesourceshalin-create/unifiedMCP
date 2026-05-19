export type SourceType = 'excel' | 'sheets' | 'airtable'

export interface Row {
  _rowId: string  // row number (1-based) for Excel/Sheets; record ID for Airtable
  [column: string]: string | number | boolean | null
}

export interface ColumnSchema {
  name: string
  type: 'string' | 'number' | 'boolean' | 'date' | 'unknown'
  nullCount: number
  sampleValues: (string | number | boolean | null)[]
}

export interface SheetSchema {
  name: string
  rowCount: number
  columns: ColumnSchema[]
}

export type FilterOperator = '=' | '!=' | '>' | '<' | '>=' | '<=' | 'contains' | 'not_contains'

export interface QueryFilter {
  column: string
  operator: FilterOperator
  value: string | number | boolean
}

export interface ExcelConfig {
  filePath: string
}

export interface SheetsConfig {
  spreadsheetId: string
  refreshToken: string
  clientId: string
  clientSecret: string
}

export interface AirtableConfig {
  baseId: string
  apiKey: string
}

export type ConnectionConfig = ExcelConfig | SheetsConfig | AirtableConfig

export interface Connection {
  id: string
  type: SourceType
  label: string
  config: ConnectionConfig
}

export interface DataSource {
  listSheets(target: unknown): Promise<string[]>
  describe(target: unknown, sheet: string): Promise<SheetSchema>
  query(target: unknown, sheet: string, filters?: QueryFilter[], limit?: number): Promise<Row[]>
  insert(target: unknown, sheet: string, rows: Omit<Row, '_rowId'>[]): Promise<void>
  updateCell(target: unknown, sheet: string, rowId: string, column: string, value: string | number | boolean | null): Promise<void>
  deleteRow(target: unknown, sheet: string, rowId: string): Promise<void>
  createSheet(target: unknown, name: string): Promise<void>
  renameSheet(target: unknown, oldName: string, newName: string): Promise<void>
  duplicateSheet(target: unknown, name: string, newName: string): Promise<void>
}

export interface McpToolResult {
  content: Array<{ type: 'text'; text: string }>
  isError?: boolean
}

export interface Schedule {
  id: string
  type: 'summary' | 'alert'
  source: SourceType
  target: string
  sheet: string
  cron?: string
  column?: string
  condition?: string
  pollIntervalMs?: number
  delivery: { type: 'file'; dir: string }
}
