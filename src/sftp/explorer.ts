import { select, input, confirm } from "@inquirer/prompts";
import chalk from "chalk";
import ora from "ora";
import { join, basename, dirname } from "path";
import { existsSync } from "fs";
import { SFTPClient, RemoteFile } from "./client";
import { getConnectionWithPassword } from "../store";
import type { SSHConnection, SFTPConnection } from "../types";

export async function exploreSFTP(name: string): Promise<void> {
  const connection = await getConnectionWithPassword(name);

  if (!connection) {
    console.log(chalk.red(`\n  ✗ Connection '${name}' not found.\n`));
    return;
  }

  if (connection.type !== "ssh" && connection.type !== "sftp") {
    console.log(chalk.red(`\n  ✗ '${name}' is not an SSH/SFTP connection.\n`));
    return;
  }

  const conn = connection as SSHConnection | SFTPConnection;
  const client = new SFTPClient(
    conn.host,
    conn.port || 22,
    conn.user,
    conn.authMethod === "key" ? conn.keyPath : undefined,
    conn.authMethod === "password" ? conn.password : undefined,
    conn.autoAcceptFingerprint
  );

  const spinner = ora(`Connecting to ${name}...`).start();

  try {
    await client.connect();
    spinner.succeed(`Connected to ${chalk.cyan(name)}`);
  } catch (error) {
    spinner.fail(`Failed to connect to ${name}`);
    console.error(chalk.red(`  ${error}`));
    return;
  }

  try {
    await fileManager(client, name);
  } finally {
    await client.disconnect();
    console.log(chalk.gray("\n  Disconnected.\n"));
  }
}

async function fileManager(client: SFTPClient, connectionName: string): Promise<void> {
  let currentPath = "/home";

  // Try to detect home directory
  try {
    await client.list("/home");
  } catch {
    currentPath = "/";
  }

  while (true) {
    const result = await browseDirectory(client, currentPath, connectionName);

    if (result.action === "exit") {
      break;
    } else if (result.action === "navigate") {
      currentPath = result.path!;
    }
  }
}

interface ActionResult {
  action: "navigate" | "exit";
  path?: string;
}

async function browseDirectory(
  client: SFTPClient,
  currentPath: string,
  connectionName: string
): Promise<ActionResult> {
  const spinner = ora("Loading...").start();

  let files: RemoteFile[];
  try {
    files = await client.list(currentPath);
    spinner.stop();
  } catch (error) {
    spinner.fail(`Failed to list directory`);
    console.error(chalk.red(`  ${error}\n`));
    const parent = dirname(currentPath);
    return { action: "navigate", path: parent === currentPath ? "/" : parent };
  }

  // Filter hidden files
  const visibleFiles = files.filter((f) => !f.name.startsWith("."));

  // Build choices - folders and files directly selectable
  type ChoiceValue = { type: "folder"; path: string } | { type: "file"; file: RemoteFile } | { type: "action"; action: string };
  
  const choices: { name: string; value: ChoiceValue }[] = [];

  // Header info
  console.log();
  console.log(chalk.bold(`  📁 ${connectionName}`));
  console.log(chalk.gray(`  ${currentPath}`));
  console.log(chalk.gray("  ─────────────────────────────────────────"));

  // Parent directory
  if (currentPath !== "/") {
    choices.push({
      name: chalk.blue("📁 .."),
      value: { type: "folder", path: dirname(currentPath) },
    });
  }

  // Folders first
  for (const file of visibleFiles.filter((f) => f.isDirectory)) {
    choices.push({
      name: `📁 ${chalk.blue(file.name)}`,
      value: { type: "folder", path: join(currentPath, file.name) },
    });
  }

  // Then files
  for (const file of visibleFiles.filter((f) => !f.isDirectory)) {
    const size = formatSize(file.size);
    choices.push({
      name: `📄 ${file.name.padEnd(30)} ${chalk.gray(size)}`,
      value: { type: "file", file },
    });
  }

  // Action separator
  choices.push({
    name: chalk.gray("───────────────────────────────"),
    value: { type: "action", action: "separator" },
    // @ts-ignore - disabled choice
    disabled: true,
  });

  // Actions at bottom
  choices.push(
    { name: "⬆️  Upload file here", value: { type: "action", action: "upload" } },
    { name: "📁 New folder", value: { type: "action", action: "mkdir" } },
    { name: "👁️  Show hidden files", value: { type: "action", action: "hidden" } },
    { name: chalk.gray("← Exit"), value: { type: "action", action: "exit" } }
  );

  const selected = await select({
    message: `${visibleFiles.length} items`,
    choices,
    pageSize: 15,
  });

  // Handle selection
  if (selected.type === "folder") {
    return { action: "navigate", path: selected.path };
  }

  if (selected.type === "file") {
    await handleFileActions(client, currentPath, selected.file);
    return { action: "navigate", path: currentPath }; // Refresh
  }

  if (selected.type === "action") {
    switch (selected.action) {
      case "upload":
        await handleUpload(client, currentPath);
        return { action: "navigate", path: currentPath };
      case "mkdir":
        await handleMkdir(client, currentPath);
        return { action: "navigate", path: currentPath };
      case "hidden":
        await showAllFiles(client, currentPath, connectionName, files);
        return { action: "navigate", path: currentPath };
      case "exit":
        return { action: "exit" };
    }
  }

  return { action: "navigate", path: currentPath };
}

async function handleFileActions(
  client: SFTPClient,
  currentPath: string,
  file: RemoteFile
): Promise<void> {
  console.log();
  console.log(chalk.bold(`  📄 ${file.name}`));
  console.log(chalk.gray(`  Size: ${formatSize(file.size)} | Modified: ${formatDate(file.modifyTime)}`));
  console.log();

  const action = await select({
    message: "What do you want to do?",
    choices: [
      { name: "⬇️  Download", value: "download" },
      { name: "🗑️  Delete", value: "delete" },
      { name: "ℹ️  View details", value: "details" },
      { name: chalk.gray("← Back"), value: "back" },
    ],
  });

  const remotePath = join(currentPath, file.name);

  switch (action) {
    case "download":
      const localPath = await input({
        message: "Save to:",
        default: `./${file.name}`,
      });
      const spinner = ora(`Downloading ${file.name}...`).start();
      try {
        await client.download(remotePath, localPath);
        spinner.succeed(`Downloaded to ${chalk.green(localPath)}`);
      } catch (error) {
        spinner.fail(`Download failed: ${error}`);
      }
      break;

    case "delete":
      const confirmed = await confirm({
        message: `Delete '${file.name}'?`,
        default: false,
      });
      if (confirmed) {
        const delSpinner = ora(`Deleting ${file.name}...`).start();
        try {
          await client.delete(remotePath);
          delSpinner.succeed(`Deleted ${chalk.red(file.name)}`);
        } catch (error) {
          delSpinner.fail(`Delete failed: ${error}`);
        }
      }
      break;

    case "details":
      console.log();
      console.log(chalk.cyan("  File Details:"));
      console.log(`  Name:        ${file.name}`);
      console.log(`  Size:        ${formatSize(file.size)} (${file.size} bytes)`);
      console.log(`  Modified:    ${file.modifyTime.toLocaleString()}`);
      console.log(`  Permissions: ${file.permissions}`);
      console.log(`  Path:        ${remotePath}`);
      console.log();
      await input({ message: "Press Enter to continue..." });
      break;
  }
}

async function handleUpload(client: SFTPClient, currentPath: string): Promise<void> {
  const localPath = await input({
    message: "Local file path:",
    validate: (value) => {
      if (!value.trim()) return "Path is required";
      const expanded = value.replace("~", process.env.HOME || "");
      if (!existsSync(expanded)) return `File not found: ${value}`;
      return true;
    },
  });

  const expanded = localPath.replace("~", process.env.HOME || "");
  const fileName = basename(expanded);

  const remoteName = await input({
    message: "Save as:",
    default: fileName,
  });

  const spinner = ora(`Uploading ${fileName}...`).start();

  try {
    await client.upload(expanded, join(currentPath, remoteName));
    spinner.succeed(`Uploaded ${chalk.green(remoteName)}`);
  } catch (error) {
    spinner.fail(`Upload failed: ${error}`);
  }
}

async function handleMkdir(client: SFTPClient, currentPath: string): Promise<void> {
  const name = await input({
    message: "Folder name:",
    validate: (value) => (value.trim() ? true : "Name is required"),
  });

  const spinner = ora(`Creating ${name}...`).start();

  try {
    await client.mkdir(join(currentPath, name));
    spinner.succeed(`Created ${chalk.green(name)}`);
  } catch (error) {
    spinner.fail(`Failed: ${error}`);
  }
}

async function showAllFiles(
  client: SFTPClient,
  currentPath: string,
  connectionName: string,
  files: RemoteFile[]
): Promise<void> {
  type ChoiceValue = { type: "folder"; path: string } | { type: "file"; file: RemoteFile } | { type: "back" };

  const choices: { name: string; value: ChoiceValue }[] = [];

  console.log();
  console.log(chalk.bold(`  📁 ${connectionName} ${chalk.gray("(all files)")}`));
  console.log(chalk.gray(`  ${currentPath}`));
  console.log(chalk.gray("  ─────────────────────────────────────────"));

  if (currentPath !== "/") {
    choices.push({
      name: chalk.blue("📁 .."),
      value: { type: "folder", path: dirname(currentPath) },
    });
  }

  for (const file of files.filter((f) => f.isDirectory)) {
    const name = file.name.startsWith(".") ? chalk.gray(file.name) : chalk.blue(file.name);
    choices.push({
      name: `📁 ${name}`,
      value: { type: "folder", path: join(currentPath, file.name) },
    });
  }

  for (const file of files.filter((f) => !f.isDirectory)) {
    const name = file.name.startsWith(".") ? chalk.gray(file.name) : file.name;
    const size = formatSize(file.size);
    choices.push({
      name: `📄 ${name.padEnd(30)} ${chalk.gray(size)}`,
      value: { type: "file", file },
    });
  }

  choices.push({ name: chalk.gray("← Back"), value: { type: "back" } });

  const selected = await select({
    message: `${files.length} items (including hidden)`,
    choices,
    pageSize: 20,
  });

  if (selected.type === "file") {
    await handleFileActions(client, currentPath, selected.file);
  }
  // For folders, we just return and let the main loop handle navigation
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function formatDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  } else if (days < 7) {
    return `${days}d ago`;
  } else {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
}
