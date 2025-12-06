import pg from "pg";
import type { DatabaseAdapter, TableInfo, QueryResult } from "./types";

export class PostgresAdapter implements DatabaseAdapter {
  private client: pg.Client;

  constructor(
    private host: string,
    private port: number,
    private user: string,
    private password: string,
    private database: string
  ) {
    this.client = new pg.Client({
      host,
      port,
      user,
      password,
      database,
    });
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }

  async disconnect(): Promise<void> {
    await this.client.end();
  }

  async listTables(): Promise<TableInfo[]> {
    const result = await this.client.query(`
      SELECT tablename, 'table' as type 
      FROM pg_tables 
      WHERE schemaname = 'public'
      UNION ALL
      SELECT viewname, 'view' as type
      FROM pg_views
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);

    return result.rows.map((row) => ({
      name: row.tablename || row.viewname,
      type: row.type,
    }));
  }

  async getTableData(table: string, limit = 50): Promise<QueryResult> {
    // Sanitize table name to prevent SQL injection
    const safeName = table.replace(/[^a-zA-Z0-9_]/g, "");
    const result = await this.client.query(
      `SELECT * FROM "${safeName}" LIMIT $1`,
      [limit]
    );

    return {
      columns: result.fields.map((f) => f.name),
      rows: result.rows,
      rowCount: result.rowCount || 0,
    };
  }

  async runQuery(query: string): Promise<QueryResult> {
    // Only allow SELECT queries
    const trimmed = query.trim().toUpperCase();
    if (!trimmed.startsWith("SELECT")) {
      throw new Error("Only SELECT queries are allowed");
    }

    const result = await this.client.query(query);

    return {
      columns: result.fields.map((f) => f.name),
      rows: result.rows,
      rowCount: result.rowCount || 0,
    };
  }
}
