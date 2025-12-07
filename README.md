```
██╗     ███████╗██████╗ ██╗   ██╗
██║     ██╔════╝██╔══██╗██║   ██║
██║     █████╗  ██████╔╝██║   ██║
██║     ██╔══╝  ██╔══██╗██║   ██║
███████╗███████╗██████╔╝╚██████╔╝
╚══════╝╚══════╝╚═════╝  ╚═════╝ 
```

# Lebu

A terminal connection manager for SSH, databases, and SFTP.

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

I got tired of having SSH configs in one place, database credentials in TablePlus, SFTP bookmarks in FileZilla, and the rest scattered across random notes. Lebu keeps everything in one CLI tool.

The main thing: it has built-in database and SFTP support. You don't need psql, mysql, or mongosh installed - just connect and browse.

## Install

```bash
npm install -g lebu
# or
bun install -g lebu
```

Requires Node 18+ or Bun.

## What it does

**SSH** - Store connections with key or password auth. Fuzzy search to connect fast.

**Database Explorer** - Browse tables and run SELECT queries for PostgreSQL, MySQL, MongoDB, and Redis. No CLI tools to install.

**SFTP File Manager** - Navigate remote folders, upload, download, delete. All built-in.

**Security** - Passwords go in your system keychain (macOS Keychain, GNOME Keyring, Windows Credential Manager). Not plain text files.

## Usage

Run `lebu` for interactive mode, or use commands directly:

```bash
lebu                    # interactive menu
lebu add                # add a connection
lebu ssh prod-server    # SSH connect
lebu explore my-db      # database explorer
lebu sftp my-server     # file manager
lebu list               # show all connections
lebu rm old-server      # delete a connection
```

### Database Explorer

```
$ lebu explore my-postgres

  Connected to my-postgres (postgres)

? What would you like to do?
  > List Tables
    Browse Table
    Run Query
    Exit
```

### SFTP File Manager

```
  my-server
  /home/deploy

? 8 items
  > ..
    config/
    logs/
    app.js                        2.4 KB
    package.json                  1.1 KB
    ───────────────────────────────
    Upload file here
    New folder
    Exit
```

Click folders to navigate. Click files to download/delete.

## Where data is stored

Connection metadata (no passwords):
```
~/.config/lebu/config.json        # Linux
~/Library/Preferences/lebu/       # macOS
```

Passwords are in your system keychain under the service name "lebu".

## Development

```bash
git clone https://github.com/bikidsx/lebu.git
cd lebu
bun install
bun run dev
```

## Contributing

PRs welcome. Fork, branch, commit, push, open PR.

Some ideas:
- Import from ~/.ssh/config
- SSH tunneling
- Encrypted export/import
- Shell completions

## License

MIT
