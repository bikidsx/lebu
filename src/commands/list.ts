import chalk from "chalk";
import Table from "cli-table3";
import { getConnections } from "../store";
import type { ConnectionType } from "../types";

export async function listConnections(typeFilter?: ConnectionType): Promise<void> {
  let connections = getConnections();

  if (typeFilter) {
    connections = connections.filter((c) => c.type === typeFilter);
  }

  if (connections.length === 0) {
    console.log(chalk.yellow("\n  No connections found.\n"));
    return;
  }

  const table = new Table({
    head: [
      chalk.cyan("Name"),
      chalk.cyan("Type"),
      chalk.cyan("Host"),
      chalk.cyan("User"),
      chalk.cyan("Tags"),
      chalk.cyan("Last Used"),
    ],
    style: { head: [], border: [] },
  });

  const typeIcon = (type: ConnectionType) => {
    switch (type) {
      case "ssh": return "🖥️  SSH";
      case "database": return "🗄️  DB";
      case "sftp": return "📁 SFTP";
    }
  };

  const formatLastUsed = (date?: string) => {
    if (!date) return chalk.gray("never");
    const diff = Date.now() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return chalk.green("just now");
    if (minutes < 60) return chalk.green(`${minutes}m ago`);
    if (hours < 24) return chalk.yellow(`${hours}h ago`);
    return chalk.gray(`${days}d ago`);
  };

  for (const conn of connections) {
    const user = "user" in conn ? conn.user : "-";
    table.push([
      chalk.white(conn.name),
      typeIcon(conn.type),
      chalk.gray(conn.host),
      chalk.gray(user),
      conn.tags.length > 0 ? chalk.blue(conn.tags.join(", ")) : chalk.gray("-"),
      formatLastUsed(conn.lastUsed),
    ]);
  }

  console.log(`\n  ${chalk.bold("📋 Connections")} ${chalk.gray(`(${connections.length} total)`)}\n`);
  console.log(table.toString());
  console.log();
}
