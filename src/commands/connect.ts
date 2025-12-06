import { spawn } from "child_process";
import chalk from "chalk";
import ora from "ora";
import { getConnectionWithPassword, updateLastUsed } from "../store";
import type { ConnectionType, SSHConnection, DatabaseConnection, SFTPConnection } from "../types";

export async function connectTo(
  name: string,
  type?: ConnectionType,
  asSftp = false
): Promise<void> {
  const connection = await getConnectionWithPassword(name);

  if (!connection) {
    console.log(chalk.red(`\n  ✗ Connection '${name}' not found.\n`));
    process.exit(1);
  }

  if (type && connection.type !== type) {
    console.log(chalk.red(`\n  ✗ '${name}' is not a ${type} connection.\n`));
    process.exit(1);
  }

  const spinner = ora(`Connecting to ${name}...`).start();

  try {
    updateLastUsed(name);

    switch (connection.type) {
      case "ssh":
        if (asSftp) {
          // Use SSH connection for SFTP
          spinner.succeed(`Connecting to ${chalk.cyan(name)} via SFTP`);
          await connectSSHAsSFTP(connection);
        } else {
          spinner.succeed(`Connecting to ${chalk.cyan(name)}`);
          await connectSSH(connection);
        }
        break;
      case "database":
        spinner.succeed(`Connecting to ${chalk.cyan(name)}`);
        await connectDatabase(connection);
        break;
      case "sftp":
        spinner.succeed(`Connecting to ${chalk.cyan(name)}`);
        await connectSFTP(connection);
        break;
    }
  } catch (error) {
    spinner.fail(`Failed to connect to ${name}`);
    console.error(chalk.red(`  ${error}`));
    process.exit(1);
  }
}

async function connectSSH(conn: SSHConnection): Promise<void> {
  const args: string[] = [];

  // Auto-accept fingerprint if enabled
  if (conn.autoAcceptFingerprint) {
    args.push("-o", "StrictHostKeyChecking=accept-new");
  }

  if (conn.port && conn.port !== 22) {
    args.push("-p", conn.port.toString());
  }

  if (conn.authMethod === "key" && conn.keyPath) {
    const keyPath = conn.keyPath.replace("~", process.env.HOME || "");
    args.push("-i", keyPath);
  }

  args.push(`${conn.user}@${conn.host}`);

  const child = spawn("ssh", args, {
    stdio: "inherit",
  });

  return new Promise((resolve, reject) => {
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`SSH exited with code ${code}`));
    });
    child.on("error", reject);
  });
}

async function connectDatabase(conn: DatabaseConnection): Promise<void> {
  let command: string;
  let args: string[];

  switch (conn.dbType) {
    case "postgres":
      command = "psql";
      args = [
        "-h", conn.host,
        "-p", (conn.port || 5432).toString(),
        "-U", conn.user,
        "-d", conn.database,
      ];
      if (conn.password) {
        process.env.PGPASSWORD = conn.password;
      }
      break;

    case "mysql":
      command = "mysql";
      args = [
        "-h", conn.host,
        "-P", (conn.port || 3306).toString(),
        "-u", conn.user,
        conn.database,
      ];
      if (conn.password) {
        args.push(`-p${conn.password}`);
      }
      break;

    case "mongodb":
      command = "mongosh";
      const mongoUri = conn.password
        ? `mongodb://${conn.user}:${conn.password}@${conn.host}:${conn.port || 27017}/${conn.database}`
        : `mongodb://${conn.host}:${conn.port || 27017}/${conn.database}`;
      args = [mongoUri];
      break;

    case "redis":
      command = "redis-cli";
      args = ["-h", conn.host, "-p", (conn.port || 6379).toString()];
      if (conn.password) {
        args.push("-a", conn.password);
      }
      break;

    default:
      throw new Error(`Unsupported database type: ${conn.dbType}`);
  }

  const child = spawn(command, args, {
    stdio: "inherit",
  });

  return new Promise((resolve, reject) => {
    child.on("close", (code) => {
      if (conn.dbType === "postgres") {
        delete process.env.PGPASSWORD;
      }
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}`));
    });
    child.on("error", (err) => {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        reject(new Error(`${command} not found. Please install it first.`));
      } else {
        reject(err);
      }
    });
  });
}

async function connectSFTP(conn: SFTPConnection): Promise<void> {
  const args: string[] = [];

  // Auto-accept fingerprint if enabled
  if (conn.autoAcceptFingerprint) {
    args.push("-o", "StrictHostKeyChecking=accept-new");
  }

  if (conn.port && conn.port !== 22) {
    args.push("-P", conn.port.toString());
  }

  if (conn.authMethod === "key" && conn.keyPath) {
    const keyPath = conn.keyPath.replace("~", process.env.HOME || "");
    args.push("-i", keyPath);
  }

  args.push(`${conn.user}@${conn.host}`);

  const child = spawn("sftp", args, {
    stdio: "inherit",
  });

  return new Promise((resolve, reject) => {
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`SFTP exited with code ${code}`));
    });
    child.on("error", reject);
  });
}

// Use SSH connection credentials for SFTP
async function connectSSHAsSFTP(conn: SSHConnection): Promise<void> {
  const args: string[] = [];

  // Auto-accept fingerprint if enabled
  if (conn.autoAcceptFingerprint) {
    args.push("-o", "StrictHostKeyChecking=accept-new");
  }

  if (conn.port && conn.port !== 22) {
    args.push("-P", conn.port.toString());
  }

  if (conn.authMethod === "key" && conn.keyPath) {
    const keyPath = conn.keyPath.replace("~", process.env.HOME || "");
    args.push("-i", keyPath);
  }

  args.push(`${conn.user}@${conn.host}`);

  const child = spawn("sftp", args, {
    stdio: "inherit",
  });

  return new Promise((resolve, reject) => {
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`SFTP exited with code ${code}`));
    });
    child.on("error", reject);
  });
}
