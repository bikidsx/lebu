import keytar from "keytar";

const SERVICE_NAME = "lebu";

export async function saveSecret(key: string, secret: string): Promise<void> {
  await keytar.setPassword(SERVICE_NAME, key, secret);
}

export async function getSecret(key: string): Promise<string | null> {
  return await keytar.getPassword(SERVICE_NAME, key);
}

export async function deleteSecret(key: string): Promise<boolean> {
  return await keytar.deletePassword(SERVICE_NAME, key);
}

// Helper to generate a unique key for a connection's password
export function getPasswordKey(connectionId: string): string {
  return `password:${connectionId}`;
}
