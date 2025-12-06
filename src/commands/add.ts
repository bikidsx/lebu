import { select, input, password, confirm } from "@inquirer/prompts";
import * as readline from "readline";
import chalk from "chalk";
import { readdirSync, existsSync, writeFileSync, mkdirSync, chmodSync } from "fs";
import { join } from "path";
import { saveConnection, getConnection } from "../store";
import type { Connection, ConnectionType, DatabaseType } from "../types";

interface SSHKeyResult {
  keyPath?: string;
  keyContent?: string;
  autoAcceptFingerprint: boolean;
}

async function readMultilineInput(): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const lines: string[] = [];
    let emptyLineCount = 0;

    rl.on("line", (line) => {
      if (line === "") {
        emptyLineCount++;
        if (emptyLineCount >= 1 && lines.length > 0) {
          rl.close();
          return;
        }
      } else {
        emptyLineCount = 0;
        lines.push(line);
      }
    });

    rl.on("close", () => {
      resolve(lines.join("\n"));
    });
  });
}

async function selectSSHKey(): Promise<SSHKeyResult> {
  const sshDir = join(process.env.HOME || "", ".ssh");
  let availableKeys: string[] = [];

  if (existsSync(sshDir)) {
    try {
      const files = readdirSync(sshDir);
      availableKeys = files.filter((f) => {
        if (f.endsWith(".pub") || f === "known_hosts" || f === "config" || f === "authorized_keys") {
          return false;
        }
        return f.startsWith("id_") || f.includes("key") || !f.includes(".");
      });
    } catch {
      // Can't read directory
    }
  }

  const keyInputMethod = await select<"select" | "path" | "paste">({
    message: "How would you like to provide the SSH key?",
    choices: [
      ...(availableKeys.length > 0
        ? [{ name: "📂 Select from ~/.ssh", value: "select" as const }]
        : []),
      { name: "📝 Enter file path", value: "path" as const },
      { name: "📋 Paste key content", value: "paste" as const },
    ],
  });

  let keyPath: string | undefined;
  let keyContent: string | undefined;

  if (keyInputMethod === "select" && availableKeys.length > 0) {
    keyPath = await select<string>({
      message: "Select SSH key:",
      choices: availableKeys.map((key) => ({
        name: `🔑 ~/.ssh/${key}`,
        value: join(sshDir, key),
      })),
    });
  } else if (keyInputMethod === "path") {
    keyPath = await input({
      message: "SSH Key path:",
      default: "~/.ssh/id_rsa",
      validate: (value) => {
        const expandedPath = value.replace("~", process.env.HOME || "");
        if (!existsSync(expandedPath)) {
          return `File not found: ${value}`;
        }
        return true;
      },
    });
  } else {
    // Paste key content - simple multi-line input
    console.log(chalk.cyan("\n  Paste your private key below."));
    console.log(chalk.gray("  Press Enter twice (empty line) when done:\n"));

    keyContent = await readMultilineInput();

    if (!keyContent.includes("PRIVATE KEY")) {
      console.log(chalk.red("  ✗ This doesn't look like a valid private key\n"));
      return selectSSHKey(); // Retry
    }

    // Save pasted key to a file
    const keyName = `lebu_key_${Date.now()}`;
    const keyFilePath = join(sshDir, keyName);

    if (!existsSync(sshDir)) {
      mkdirSync(sshDir, { recursive: true, mode: 0o700 });
    }

    writeFileSync(keyFilePath, keyContent.trim() + "\n", { mode: 0o600 });
    chmodSync(keyFilePath, 0o600);
    keyPath = keyFilePath;
    console.log(chalk.green(`\n  ✓ Key saved to ${keyFilePath}\n`));
  }

  // Ask about fingerprint auto-accept
  const autoAcceptFingerprint = await confirm({
    message: "Auto-accept host fingerprint on first connect?",
    default: true,
  });

  return {
    keyPath,
    keyContent,
    autoAcceptFingerprint,
  };
}

export async function addConnection(): Promise<void> {
  console.log(chalk.bold("\n  ➕ Add New Connection\n"));

  const type = await select<ConnectionType>({
    message: "Connection type:",
    choices: [
      { name: "🖥️  SSH", value: "ssh" },
      { name: "🗄️  Database", value: "database" },
      { name: "📁 SFTP", value: "sftp" },
    ],
  });

  const name = await input({
    message: "Connection name:",
    validate: (value) => {
      if (!value.trim()) return "Name is required";
      if (getConnection(value)) return "Connection with this name already exists";
      if (!/^[a-zA-Z0-9_-]+$/.test(value)) return "Use only letters, numbers, dashes, underscores";
      return true;
    },
  });

  const host = await input({
    message: "Host:",
    validate: (value) => (value.trim() ? true : "Host is required"),
  });

  let connection: Connection;

  switch (type) {
    case "ssh":
      connection = await createSSHConnection(name, host);
      break;
    case "database":
      connection = await createDatabaseConnection(name, host);
      break;
    case "sftp":
      connection = await createSFTPConnection(name, host);
      break;
  }

  const tagsInput = await input({
    message: "Tags (comma separated, optional):",
  });

  connection.tags = tagsInput
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  await saveConnection(connection);
  console.log(chalk.green(`\n  ✓ Connection '${name}' saved! (password stored in system keychain)\n`));
}

async function createSSHConnection(name: string, host: string): Promise<Connection> {
  const user = await input({
    message: "Username:",
    validate: (value) => (value.trim() ? true : "Username is required"),
  });

  const portInput = await input({
    message: "Port:",
    default: "22",
  });

  const authMethod = await select<"key" | "password">({
    message: "Authentication method:",
    choices: [
      { name: "🔑 SSH Key", value: "key" },
      { name: "🔒 Password", value: "password" },
    ],
  });

  let keyPath: string | undefined;
  let pwd: string | undefined;
  let autoAcceptFingerprint = false;

  if (authMethod === "key") {
    const keyResult = await selectSSHKey();
    keyPath = keyResult.keyPath;
    autoAcceptFingerprint = keyResult.autoAcceptFingerprint;
  } else {
    pwd = await password({
      message: "Password:",
    });
    autoAcceptFingerprint = await confirm({
      message: "Auto-accept host fingerprint on first connect?",
      default: true,
    });
  }

  return {
    id: crypto.randomUUID(),
    name,
    type: "ssh",
    host,
    port: parseInt(portInput) || 22,
    user,
    authMethod,
    keyPath,
    password: pwd,
    autoAcceptFingerprint,
    tags: [],
    createdAt: new Date().toISOString(),
  };
}

async function createDatabaseConnection(name: string, host: string): Promise<Connection> {
  const dbType = await select<DatabaseType>({
    message: "Database type:",
    choices: [
      { name: "🐘 PostgreSQL", value: "postgres" },
      { name: "🐬 MySQL", value: "mysql" },
      { name: "🍃 MongoDB", value: "mongodb" },
      { name: "🔴 Redis", value: "redis" },
    ],
  });

  const defaultPorts: Record<DatabaseType, string> = {
    postgres: "5432",
    mysql: "3306",
    mongodb: "27017",
    redis: "6379",
  };

  const portInput = await input({
    message: "Port:",
    default: defaultPorts[dbType],
  });

  const user = await input({
    message: "Username:",
    validate: (value) => (value.trim() ? true : "Username is required"),
  });

  const pwd = await password({
    message: "Password:",
  });

  const database = await input({
    message: "Database name:",
    validate: (value) => (value.trim() ? true : "Database name is required"),
  });

  return {
    id: crypto.randomUUID(),
    name,
    type: "database",
    dbType,
    host,
    port: parseInt(portInput),
    user,
    password: pwd,
    database,
    tags: [],
    createdAt: new Date().toISOString(),
  };
}

async function createSFTPConnection(name: string, host: string): Promise<Connection> {
  const user = await input({
    message: "Username:",
    validate: (value) => (value.trim() ? true : "Username is required"),
  });

  const portInput = await input({
    message: "Port:",
    default: "22",
  });

  const authMethod = await select<"key" | "password">({
    message: "Authentication method:",
    choices: [
      { name: "🔑 SSH Key", value: "key" },
      { name: "🔒 Password", value: "password" },
    ],
  });

  let keyPath: string | undefined;
  let pwd: string | undefined;
  let autoAcceptFingerprint = false;

  if (authMethod === "key") {
    const keyResult = await selectSSHKey();
    keyPath = keyResult.keyPath;
    autoAcceptFingerprint = keyResult.autoAcceptFingerprint;
  } else {
    pwd = await password({
      message: "Password:",
    });
    autoAcceptFingerprint = await confirm({
      message: "Auto-accept host fingerprint on first connect?",
      default: true,
    });
  }

  return {
    id: crypto.randomUUID(),
    name,
    type: "sftp",
    host,
    port: parseInt(portInput) || 22,
    user,
    authMethod,
    keyPath,
    password: pwd,
    autoAcceptFingerprint,
    tags: [],
    createdAt: new Date().toISOString(),
  };
}
