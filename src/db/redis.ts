import Redis from "ioredis";
import type { DatabaseAdapter, TableInfo, QueryResult } from "./types";

export class RedisAdapter implements DatabaseAdapter {
  private client: Redis;

  constructor(
    private host: string,
    private port: number,
    _user: string,
    private password: string,
    _database: string
  ) {
    this.client = new Redis({
      host,
      port,
      password: password || undefined,
      lazyConnect: true,
    });
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }

  async disconnect(): Promise<void> {
    await this.client.quit();
  }

  async listTables(): Promise<TableInfo[]> {
    // Redis doesn't have tables, list key patterns instead
    const keys = await this.client.keys("*");
    const uniquePrefixes = new Set<string>();

    for (const key of keys.slice(0, 1000)) {
      // Get prefix before first : or the whole key
      const prefix = key.includes(":") ? key.split(":")[0] : key;
      uniquePrefixes.add(prefix);
    }

    return Array.from(uniquePrefixes)
      .sort()
      .map((prefix) => ({
        name: prefix,
        type: "key-prefix",
      }));
  }

  async getTableData(pattern: string, limit = 50): Promise<QueryResult> {
    // Get keys matching the pattern
    const searchPattern = pattern.includes("*") ? pattern : `${pattern}*`;
    const keys = await this.client.keys(searchPattern);
    const limitedKeys = keys.slice(0, limit);

    const rows: Record<string, unknown>[] = [];

    for (const key of limitedKeys) {
      const type = await this.client.type(key);
      let value: unknown;

      switch (type) {
        case "string":
          value = await this.client.get(key);
          break;
        case "list":
          value = await this.client.lrange(key, 0, 10);
          break;
        case "set":
          value = await this.client.smembers(key);
          break;
        case "hash":
          value = await this.client.hgetall(key);
          break;
        case "zset":
          value = await this.client.zrange(key, 0, 10, "WITHSCORES");
          break;
        default:
          value = `<${type}>`;
      }

      rows.push({
        key,
        type,
        value: typeof value === "object" ? JSON.stringify(value) : value,
      });
    }

    return {
      columns: ["key", "type", "value"],
      rows,
      rowCount: rows.length,
    };
  }

  async runQuery(query: string): Promise<QueryResult> {
    // Support simple GET and KEYS commands
    const parts = query.trim().split(/\s+/);
    const command = parts[0].toUpperCase();

    if (command === "GET" && parts[1]) {
      const value = await this.client.get(parts[1]);
      return {
        columns: ["key", "value"],
        rows: [{ key: parts[1], value }],
        rowCount: 1,
      };
    }

    if (command === "KEYS" && parts[1]) {
      const keys = await this.client.keys(parts[1]);
      return {
        columns: ["key"],
        rows: keys.slice(0, 100).map((k) => ({ key: k })),
        rowCount: keys.length,
      };
    }

    throw new Error("Supported commands: GET <key>, KEYS <pattern>");
  }
}
