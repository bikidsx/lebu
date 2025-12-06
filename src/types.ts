export type ConnectionType = "ssh" | "database" | "sftp";

export type DatabaseType = "postgres" | "mysql" | "mongodb" | "redis";

export interface BaseConnection {
  id: string;
  name: string;
  type: ConnectionType;
  host: string;
  port?: number;
  tags: string[];
  createdAt: string;
  lastUsed?: string;
}

export interface SSHConnection extends BaseConnection {
  type: "ssh";
  user: string;
  authMethod: "key" | "password";
  keyPath?: string;
  password?: string;
  autoAcceptFingerprint?: boolean;
}

export interface DatabaseConnection extends BaseConnection {
  type: "database";
  dbType: DatabaseType;
  user: string;
  password?: string;
  database: string;
}

export interface SFTPConnection extends BaseConnection {
  type: "sftp";
  user: string;
  authMethod: "key" | "password";
  keyPath?: string;
  password?: string;
  autoAcceptFingerprint?: boolean;
}

export type Connection = SSHConnection | DatabaseConnection | SFTPConnection;
