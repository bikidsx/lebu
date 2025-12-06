import { select, input } from "@inquirer/prompts";
import chalk from "chalk";
import Table from "cli-table3";
import ora from "ora";
import { getConnectionWithPassword } from "../store";
import { createAdapter } from "../db";
import type { DatabaseAdapter, QueryResult } from "../db";
import type { DatabaseConnection } from "../types";

export async function exploreDatabase(name: string): Promise<void> {
  const connection = await getConnectionWithPassword(name);

  if (!connection) {
    console.log(chalk.red(`\n  ✗ Connection '${name}' not found.\n`));
    process.exit(1);
  }

  if (connection.type !== "database") {
    console.log(chalk.red(`\n  ✗ '${name}' is not a database connection.\n`));
    process.exit(1);
  }

  const dbConn = connection as DatabaseConnection;
  const adapter = createAdapter(dbConn);

  const spinner = ora(`Connecting to ${name}...`).start();

  try {
    await adapter.connect();
    spinner.succeed(`Connected to ${chalk.cyan(name)} (${dbConn.dbType})`);
  } catch (error) {
    spinner.fail(`Failed to connect to ${name}`);
    console.error(chalk.red(`  ${error}`));
    process.exit(1);
  }

  console.log(chalk.gray("  ─────────────────────────────────────────\n"));

  try {
    await explorerMenu(adapter, dbConn);
  } finally {
    await adapter.disconnect();
  }
}

async function explorerMenu(adapter: DatabaseAdapter, conn: DatabaseConnection): Promise<void> {
  const action = await select({
    message: "What would you like to do?",
    choices: [
      { name: "📋 List Tables", value: "tables" },
      { name: "🔍 Browse Table", value: "browse" },
      { name: "⚡ Run Query", value: "query" },
      { name: chalk.gray("← Exit"), value: "exit" },
    ],
  });

  switch (action) {
    case "tables":
      await listTables(adapter, conn);
      await explorerMenu(adapter, conn);
      break;
    case "browse":
      await browseTable(adapter, conn);
      await explorerMenu(adapter, conn);
      break;
    case "query":
      await runQuery(adapter, conn);
      await explorerMenu(adapter, conn);
      break;
    case "exit":
      console.log(chalk.gray("\n  Disconnected.\n"));
      break;
  }
}

async function listTables(adapter: DatabaseAdapter, conn: DatabaseConnection): Promise<void> {
  const spinner = ora("Fetching tables...").start();

  try {
    const tables = await adapter.listTables();
    spinner.stop();

    if (tables.length === 0) {
      console.log(chalk.yellow("\n  No tables found.\n"));
      return;
    }

    const tableLabel = conn.dbType === "mongodb" ? "Collections" : "Tables";
    console.log(`\n  ${chalk.bold(`📋 ${tableLabel}`)} ${chalk.gray(`(${tables.length})`)}\n`);

    const table = new Table({
      head: [chalk.cyan("Name"), chalk.cyan("Type")],
      style: { head: [], border: [] },
    });

    for (const t of tables) {
      table.push([t.name, chalk.gray(t.type || "table")]);
    }

    console.log(table.toString());
    console.log();
  } catch (error) {
    spinner.fail("Failed to fetch tables");
    console.error(chalk.red(`  ${error}\n`));
  }
}

async function browseTable(adapter: DatabaseAdapter, conn: DatabaseConnection): Promise<void> {
  const spinner = ora("Fetching tables...").start();
  const tables = await adapter.listTables();
  spinner.stop();

  if (tables.length === 0) {
    console.log(chalk.yellow("\n  No tables found.\n"));
    return;
  }

  const tableName = await select({
    message: "Select table:",
    choices: [
      ...tables.map((t) => ({
        name: `${t.name} ${chalk.gray(`(${t.type || "table"})`)}`,
        value: t.name,
      })),
      { name: chalk.gray("← Back"), value: "__back__" },
    ],
  });

  if (tableName === "__back__") return;

  const limitStr = await input({
    message: "Limit rows:",
    default: "50",
  });

  const limit = parseInt(limitStr) || 50;

  await fetchAndDisplayData(adapter, tableName, limit);
}

async function runQuery(adapter: DatabaseAdapter, conn: DatabaseConnection): Promise<void> {
  let placeholder = "SELECT * FROM table_name LIMIT 10";
  if (conn.dbType === "mongodb") {
    placeholder = 'collectionName.find({"field": "value"})';
  } else if (conn.dbType === "redis") {
    placeholder = "KEYS * or GET keyname";
  }

  const query = await input({
    message: "Enter query:",
    default: placeholder,
  });

  if (!query.trim()) return;

  const spinner = ora("Running query...").start();

  try {
    const result = await adapter.runQuery(query);
    spinner.stop();
    displayResult(result);
  } catch (error) {
    spinner.fail("Query failed");
    console.error(chalk.red(`  ${error}\n`));
  }
}

async function fetchAndDisplayData(
  adapter: DatabaseAdapter,
  tableName: string,
  limit: number
): Promise<void> {
  const spinner = ora(`Fetching data from ${tableName}...`).start();

  try {
    const result = await adapter.getTableData(tableName, limit);
    spinner.stop();
    displayResult(result, tableName);
  } catch (error) {
    spinner.fail(`Failed to fetch data from ${tableName}`);
    console.error(chalk.red(`  ${error}\n`));
  }
}

function displayResult(result: QueryResult, tableName?: string): void {
  if (result.rows.length === 0) {
    console.log(chalk.yellow("\n  No data found.\n"));
    return;
  }

  const title = tableName ? `📊 ${tableName}` : "📊 Results";
  console.log(`\n  ${chalk.bold(title)} ${chalk.gray(`(${result.rowCount} rows)`)}\n`);

  // Truncate columns if too many
  const maxCols = 8;
  const displayCols = result.columns.slice(0, maxCols);
  const hasMoreCols = result.columns.length > maxCols;

  const table = new Table({
    head: displayCols.map((c) => chalk.cyan(c)),
    style: { head: [], border: [] },
    colWidths: displayCols.map(() => Math.min(30, Math.floor(100 / displayCols.length))),
    wordWrap: true,
  });

  for (const row of result.rows.slice(0, 100)) {
    const values = displayCols.map((col) => {
      const val = row[col];
      if (val === null || val === undefined) return chalk.gray("NULL");
      const str = typeof val === "object" ? JSON.stringify(val) : String(val);
      // Truncate long values
      return str.length > 50 ? str.slice(0, 47) + "..." : str;
    });
    table.push(values);
  }

  console.log(table.toString());

  if (hasMoreCols) {
    console.log(chalk.gray(`\n  ... and ${result.columns.length - maxCols} more columns`));
  }

  if (result.rowCount > 100) {
    console.log(chalk.gray(`  Showing first 100 of ${result.rowCount} rows`));
  }

  console.log();
}
