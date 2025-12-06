import Conf from "conf";
import { saveSecret, getSecret, deleteSecret, getPasswordKey } from "./keychain";
import type { Connection } from "./types";

// Connection without password (stored in config file)
type StoredConnection = Omit<Connection, "password"> & { hasPassword?: boolean };

interface StoreSchema {
  connections: StoredConnection[];
}

const store = new Conf<StoreSchema>({
  projectName: "lebu",
  defaults: {
    connections: [],
  },
});

export function getConnections(): Connection[] {
  // Return connections without passwords (passwords fetched separately when needed)
  return store.get("connections") as Connection[];
}

export function getConnection(name: string): Connection | undefined {
  return getConnections().find((c) => c.name === name);
}

export async function getConnectionWithPassword(name: string): Promise<Connection | undefined> {
  const connection = getConnection(name);
  if (!connection) return undefined;

  // Fetch password from keychain if it exists
  const storedConn = store.get("connections").find((c) => c.name === name);
  if (storedConn?.hasPassword) {
    const password = await getSecret(getPasswordKey(connection.id));
    if (password) {
      return { ...connection, password };
    }
  }

  return connection;
}

export async function saveConnection(connection: Connection): Promise<void> {
  const connections = store.get("connections");
  const existingIndex = connections.findIndex((c) => c.id === connection.id);

  // Extract password to store in keychain
  const { password, ...connectionWithoutPassword } = connection as Connection & { password?: string };
  const storedConnection: StoredConnection = {
    ...connectionWithoutPassword,
    hasPassword: !!password,
  };

  // Save password to system keychain if provided
  if (password) {
    await saveSecret(getPasswordKey(connection.id), password);
  }

  if (existingIndex >= 0) {
    connections[existingIndex] = storedConnection;
  } else {
    connections.push(storedConnection);
  }

  store.set("connections", connections);
}

export async function deleteConnection(name: string): Promise<boolean> {
  const connections = store.get("connections");
  const connection = connections.find((c) => c.name === name);

  if (!connection) {
    return false;
  }

  // Delete password from keychain
  if (connection.hasPassword) {
    await deleteSecret(getPasswordKey(connection.id));
  }

  const filtered = connections.filter((c) => c.name !== name);
  store.set("connections", filtered);
  return true;
}

export function updateLastUsed(name: string): void {
  const connections = store.get("connections");
  const connection = connections.find((c) => c.name === name);

  if (connection) {
    connection.lastUsed = new Date().toISOString();
    store.set("connections", connections);
  }
}
