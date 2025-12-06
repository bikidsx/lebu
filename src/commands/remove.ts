import { confirm, select } from "@inquirer/prompts";
import chalk from "chalk";
import { getConnection, getConnections, deleteConnection } from "../store";
import type { Connection } from "../types";

export async function removeConnection(name: string): Promise<void> {
  const connection = getConnection(name);

  if (!connection) {
    console.log(chalk.red(`\n  ✗ Connection '${name}' not found.\n`));
    process.exit(1);
  }

  const confirmed = await confirm({
    message: `Delete connection '${name}' (${connection.type})?`,
    default: false,
  });

  if (confirmed) {
    await deleteConnection(name);
    console.log(chalk.green(`\n  ✓ Connection '${name}' deleted (password removed from keychain).\n`));
  } else {
    console.log(chalk.gray("\n  Cancelled.\n"));
  }
}

export async function deleteConnectionInteractive(): Promise<void> {
  const connections = getConnections();

  if (connections.length === 0) {
    console.log(chalk.yellow("\n  No connections to delete.\n"));
    return;
  }

  const typeIcon = (conn: Connection) => {
    switch (conn.type) {
      case "ssh": return "🖥️ ";
      case "database": return "🗄️ ";
      case "sftp": return "📁";
    }
  };

  const selected = await select<Connection | null>({
    message: "Select connection to delete:",
    choices: [
      ...connections.map((c) => ({
        name: `${typeIcon(c)} ${c.name.padEnd(20)} ${chalk.gray(c.host)}`,
        value: c,
      })),
      { name: chalk.gray("← Back"), value: null },
    ],
  });

  if (!selected) {
    return;
  }

  const confirmed = await confirm({
    message: `Delete '${selected.name}' (${selected.type} - ${selected.host})?`,
    default: false,
  });

  if (confirmed) {
    await deleteConnection(selected.name);
    console.log(chalk.green(`\n  ✓ Connection '${selected.name}' deleted (password removed from keychain).\n`));
  } else {
    console.log(chalk.gray("\n  Cancelled.\n"));
  }
}
