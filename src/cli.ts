#!/usr/bin/env bun
import { Command } from "commander";
import chalk from "chalk";
import { mainMenu } from "./ui/menu";
import { addConnection } from "./commands/add";
import { listConnections } from "./commands/list";
import { connectTo } from "./commands/connect";
import { removeConnection } from "./commands/remove";
import { exploreDatabase } from "./commands/explore";
import { exploreSFTP } from "./sftp/explorer";

// Graceful exit message
const exitGracefully = () => {
  console.log(chalk.gray("\n\n  Goodbye! 👋\n"));
  process.exit(0);
};

// Handle Ctrl+C gracefully
process.on("SIGINT", exitGracefully);
process.on("SIGTERM", exitGracefully);

// Handle uncaught errors from inquirer prompts
process.on("uncaughtException", (error) => {
  if (
    error.name === "ExitPromptError" ||
    error.message?.includes("force closed") ||
    error.message?.includes("SIGINT")
  ) {
    exitGracefully();
  }
  // Log other errors and exit
  console.error(chalk.red("\n  Error:"), error.message);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason) => {
  const error = reason as Error;
  if (
    error?.name === "ExitPromptError" ||
    error?.message?.includes("force closed") ||
    error?.message?.includes("SIGINT")
  ) {
    exitGracefully();
  }
  console.error(chalk.red("\n  Error:"), error?.message || reason);
  process.exit(1);
});

const program = new Command();

program
  .name("lebu")
  .description("Terminal connection manager for SSH, databases, and SFTP")
  .version("0.1.0");

// Default: interactive mode
program
  .action(async () => {
    await mainMenu();
  });

// Quick connect
program
  .command("ssh <name>")
  .description("Connect to SSH connection")
  .action(async (name: string) => {
    await connectTo(name, "ssh");
  });

program
  .command("db <name>")
  .description("Connect to database CLI")
  .action(async (name: string) => {
    await connectTo(name, "database");
  });

program
  .command("explore <name>")
  .alias("ex")
  .description("Explore database (view tables, run queries)")
  .action(async (name: string) => {
    await exploreDatabase(name);
  });

program
  .command("sftp <name>")
  .description("SFTP file manager (built-in)")
  .action(async (name: string) => {
    await exploreSFTP(name);
  });

// Management commands
program
  .command("add")
  .description("Add a new connection")
  .action(async () => {
    await addConnection();
  });

program
  .command("list")
  .alias("ls")
  .description("List all connections")
  .option("-t, --type <type>", "Filter by type (ssh, database, sftp)")
  .action(async (options) => {
    await listConnections(options.type);
  });

program
  .command("rm <name>")
  .description("Remove a connection")
  .action(async (name: string) => {
    await removeConnection(name);
  });

program.parse();
