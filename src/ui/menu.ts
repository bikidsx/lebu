import { select, search } from "@inquirer/prompts";
import chalk from "chalk";
import { getConnections } from "../store";
import { addConnection } from "../commands/add";
import { listConnections } from "../commands/list";
import { connectTo } from "../commands/connect";
import { exploreDatabase } from "../commands/explore";
import { exploreSFTP } from "../sftp/explorer";
import { deleteConnectionInteractive } from "../commands/remove";
import Fuse from "fuse.js";
import type { Connection } from "../types";

function printHeader() {
  console.log();
  console.log(chalk.cyan("  ██╗     ███████╗██████╗ ██╗   ██╗"));
  console.log(chalk.cyan("  ██║     ██╔════╝██╔══██╗██║   ██║"));
  console.log(chalk.cyan("  ██║     █████╗  ██████╔╝██║   ██║"));
  console.log(chalk.cyan("  ██║     ██╔══╝  ██╔══██╗██║   ██║"));
  console.log(chalk.cyan("  ███████╗███████╗██████╔╝╚██████╔╝"));
  console.log(chalk.cyan("  ╚══════╝╚══════╝╚═════╝  ╚═════╝ "));
  console.log();
  console.log(chalk.gray("  🔗 Connection Manager v0.1.0"));
  console.log(chalk.gray("  ─────────────────────────────────"));
  console.log();
}

let headerPrinted = false;

export async function mainMenu(): Promise<void> {
  if (!headerPrinted) {
    printHeader();
    headerPrinted = true;
  }

  const connections = getConnections();

  const action = await select({
    message: "What would you like to do?",
    choices: [
      {
        name: `🚀 Quick Connect ${chalk.gray(`(${connections.length} saved)`)}`,
        value: "connect",
        disabled: connections.length === 0 ? "(no connections)" : false,
      },
      { name: "➕ Add Connection", value: "add" },
      { name: "📋 List Connections", value: "list" },
      {
        name: `🗑️  Delete Connection`,
        value: "delete",
        disabled: connections.length === 0 ? "(no connections)" : false,
      },
      { name: "❓ Help", value: "help" },
      { name: chalk.red("✕ Exit"), value: "exit" },
    ],
  });

  switch (action) {
    case "connect":
      await quickConnect();
      break;
    case "add":
      await addConnection();
      await mainMenu();
      break;
    case "list":
      await listConnections();
      await mainMenu();
      break;
    case "delete":
      await deleteConnectionInteractive();
      await mainMenu();
      break;
    case "help":
      showHelp();
      await mainMenu();
      break;
    case "exit":
      console.log(chalk.gray("\n  Goodbye! 👋\n"));
      process.exit(0);
  }
}

async function quickConnect(): Promise<void> {
  const connections = getConnections();

  if (connections.length === 0) {
    console.log(chalk.yellow("\n  No connections saved yet. Add one first!\n"));
    return mainMenu();
  }

  const fuse = new Fuse(connections, {
    keys: ["name", "host", "tags"],
    threshold: 0.4,
  });

  const typeIcon = (conn: Connection) => {
    switch (conn.type) {
      case "ssh": return "🖥️ ";
      case "database": return "🗄️ ";
      case "sftp": return "📁";
    }
  };

  const selected = await search<Connection>({
    message: "Search connections:",
    source: async (input) => {
      if (!input) {
        return connections.map((c) => ({
          name: `${typeIcon(c)} ${c.name.padEnd(20)} ${chalk.gray(c.host)}`,
          value: c,
        }));
      }

      const results = fuse.search(input);
      return results.map((r) => ({
        name: `${typeIcon(r.item)} ${r.item.name.padEnd(20)} ${chalk.gray(r.item.host)}`,
        value: r.item,
      }));
    },
  });

  // Handle different connection types
  if (selected.type === "database") {
    await exploreDatabase(selected.name);
    await mainMenu();
  } else if (selected.type === "ssh") {
    // SSH connections can also be used for SFTP
    const mode = await select({
      message: `Connect to ${selected.name} as:`,
      choices: [
        { name: "🖥️  SSH (terminal)", value: "ssh" },
        { name: "📁 SFTP (file transfer)", value: "sftp" },
        { name: chalk.gray("← Back"), value: "back" },
      ],
    });

    if (mode === "back") {
      await quickConnect();
    } else if (mode === "sftp") {
      await exploreSFTP(selected.name);
      await mainMenu();
    } else {
      await connectTo(selected.name, "ssh");
    }
  } else {
    // SFTP connections - use built-in file manager
    await exploreSFTP(selected.name);
    await mainMenu();
  }
}

function showHelp(): void {
  console.log(`
${chalk.bold("Usage:")}
  ${chalk.cyan("lebu")}                    Interactive mode
  ${chalk.cyan("lebu ssh <name>")}         Quick SSH connect
  ${chalk.cyan("lebu explore <name>")}     Explore database (built-in)
  ${chalk.cyan("lebu db <name>")}          Open database CLI (psql, mysql...)
  ${chalk.cyan("lebu sftp <name>")}        Quick SFTP connect
  ${chalk.cyan("lebu add")}                Add new connection
  ${chalk.cyan("lebu list")}               List all connections
  ${chalk.cyan("lebu rm <name>")}          Remove connection

${chalk.bold("Examples:")}
  ${chalk.gray("$ lebu add")}
  ${chalk.gray("$ lebu ssh prod-server")}
  ${chalk.gray("$ lebu explore my-postgres")}
`);
}
