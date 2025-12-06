import { MongoClient, Db } from "mongodb";
import type { DatabaseAdapter, TableInfo, QueryResult } from "./types";

export class MongoDBAdapter implements DatabaseAdapter {
  private client: MongoClient;
  private db: Db | null = null;

  constructor(
    private host: string,
    private port: number,
    private user: string,
    private password: string,
    private database: string
  ) {
    const uri = password
      ? `mongodb://${user}:${password}@${host}:${port}`
      : `mongodb://${host}:${port}`;

    this.client = new MongoClient(uri);
  }

  async connect(): Promise<void> {
    await this.client.connect();
    this.db = this.client.db(this.database);
  }

  async disconnect(): Promise<void> {
    await this.client.close();
  }

  async listTables(): Promise<TableInfo[]> {
    if (!this.db) throw new Error("Not connected");

    const collections = await this.db.listCollections().toArray();

    return collections.map((col) => ({
      name: col.name,
      type: col.type === "view" ? "view" : "collection",
    }));
  }

  async getTableData(table: string, limit = 50): Promise<QueryResult> {
    if (!this.db) throw new Error("Not connected");

    const collection = this.db.collection(table);
    const docs = await collection.find({}).limit(limit).toArray();

    if (docs.length === 0) {
      return { columns: ["_id"], rows: [], rowCount: 0 };
    }

    // Get all unique keys from documents
    const columns = [...new Set(docs.flatMap((doc) => Object.keys(doc)))];

    return {
      columns,
      rows: docs.map((doc) => {
        const row: Record<string, unknown> = {};
        for (const col of columns) {
          row[col] = doc[col] !== undefined ? doc[col] : null;
        }
        return row;
      }),
      rowCount: docs.length,
    };
  }

  async runQuery(query: string): Promise<QueryResult> {
    if (!this.db) throw new Error("Not connected");

    // Parse simple find queries like: collection.find({field: "value"})
    const match = query.match(/^(\w+)\.find\((\{.*\})?\)$/);
    if (!match) {
      throw new Error(
        'Query format: collectionName.find({}) or collectionName.find({"field": "value"})'
      );
    }

    const [, collectionName, filterStr] = match;
    const filter = filterStr ? JSON.parse(filterStr) : {};

    const collection = this.db.collection(collectionName);
    const docs = await collection.find(filter).limit(100).toArray();

    if (docs.length === 0) {
      return { columns: ["_id"], rows: [], rowCount: 0 };
    }

    const columns = [...new Set(docs.flatMap((doc) => Object.keys(doc)))];

    return {
      columns,
      rows: docs.map((doc) => {
        const row: Record<string, unknown> = {};
        for (const col of columns) {
          row[col] = doc[col] !== undefined ? doc[col] : null;
        }
        return row;
      }),
      rowCount: docs.length,
    };
  }
}
