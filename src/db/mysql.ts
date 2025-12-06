import mysql from "mysql2/promise";
import type { DatabaseAdapter, TableInfo, QueryResult } from "./types";

export class MySQLAdapter implements DatabaseAdapter {
  private connection: mysql.Connection | null = null;

  constructor(
    private host: string,
    private port: number,
    private user: string,
    private password: string,
    private database: string
  ) {}

  async connect(): Promise<void> {
    this.connection = await mysql.createConnection({
      host: this.host,
      port: this.port,
      user: this.user,
      password: this.password,
      database: this.database,
    });
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.end();
    }
  }

  async listTables(): Promise<TableInfo[]> {
    if (!this.connection) throw new Error("Not connected");

    const [rows] = await this.connection.query("SHOW FULL TABLES");
    const tableRows = rows as Record<string, string>[];

    return tableRows.map((row) => {
      const values = Object.values(row);
      return {
        name: values[0],
        type: values[1]?.toLowerCase() === "view" ? "view" : "table",
      };
    });
  }

  async getTableData(table: string, limit = 50): Promise<QueryResult> {
    if (!this.connection) throw new Error("Not connected");

    // Sanitize table name
    const safeName = table.replace(/[^a-zA-Z0-9_]/g, "");
    const [rows, fields] = await this.connection.query(
      `SELECT * FROM \`${safeName}\` LIMIT ?`,
      [limit]
    );

    const resultRows = rows as Record<string, unknown>[];
    const resultFields = fields as mysql.FieldPacket[];

    return {
      columns: resultFields.map((f) => f.name),
      rows: resultRows,
      rowCount: resultRows.length,
    };
  }

  async runQuery(query: string): Promise<QueryResult> {
    if (!this.connection) throw new Error("Not connected");

    // Only allow SELECT queries
    const trimmed = query.trim().toUpperCase();
    if (!trimmed.startsWith("SELECT")) {
      throw new Error("Only SELECT queries are allowed");
    }

    const [rows, fields] = await this.connection.query(query);
    const resultRows = rows as Record<string, unknown>[];
    const resultFields = fields as mysql.FieldPacket[];

    return {
      columns: resultFields.map((f) => f.name),
      rows: resultRows,
      rowCount: resultRows.length,
    };
  }
}
