import type { DatabaseAdapter } from "./types";
import type { DatabaseConnection } from "../types";
import { PostgresAdapter } from "./postgres";
import { MySQLAdapter } from "./mysql";
import { MongoDBAdapter } from "./mongodb";
import { RedisAdapter } from "./redis";

export function createAdapter(conn: DatabaseConnection): DatabaseAdapter {
  const { host, port, user, password, database, dbType } = conn;

  switch (dbType) {
    case "postgres":
      return new PostgresAdapter(host, port || 5432, user, password || "", database);
    case "mysql":
      return new MySQLAdapter(host, port || 3306, user, password || "", database);
    case "mongodb":
      return new MongoDBAdapter(host, port || 27017, user, password || "", database);
    case "redis":
      return new RedisAdapter(host, port || 6379, user, password || "", "0");
    default:
      throw new Error(`Unsupported database type: ${dbType}`);
  }
}

export type { DatabaseAdapter, TableInfo, QueryResult } from "./types";
