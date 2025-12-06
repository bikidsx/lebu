export interface TableInfo {
  name: string;
  type?: string; // 'table', 'view', 'collection', etc.
}

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
}

export interface DatabaseAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  listTables(): Promise<TableInfo[]>;
  getTableData(table: string, limit?: number): Promise<QueryResult>;
  runQuery(query: string): Promise<QueryResult>;
}
