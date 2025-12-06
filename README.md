```
██╗     ███████╗██████╗ ██╗   ██╗
██║     ██╔════╝██╔══██╗██║   ██║
██║     █████╗  ██████╔╝██║   ██║
██║     ██╔══╝  ██╔══██╗██║   ██║
███████╗███████╗██████╔╝╚██████╔╝
╚══════╝╚══════╝╚═════╝  ╚═════╝ 
```

# Lebu

> 🔗 A beautiful terminal connection manager for SSH, databases, and SFTP.

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Bun](https://img.shields.io/badge/Bun-%23000000.svg?logo=bun&logoColor=white)](https://bun.sh)

Stop juggling SSH configs, database credentials, and SFTP bookmarks across different tools. Lebu keeps all your connections in one place, accessible with a single command.


## ✨ Features

- 🖥️ **SSH Connections** - Quick connect with key or password auth
- 🗄️ **Database Explorer** - Browse tables, run queries (PostgreSQL, MySQL, MongoDB, Redis) - no CLI tools needed!
- 📁 **SFTP File Manager** - Built-in file browser with upload/download/delete
- 🔍 **Fuzzy Search** - Find connections instantly
- 🔐 **Secure Storage** - Passwords stored in system keychain
- 🏷️ **Tags & Organization** - Group and filter connections
- 🎨 **Beautiful TUI** - Interactive terminal interface

## 📦 Installation

```bash
# Using bun (recommended)
bun install -g lebu

# Using npm
npm install -g lebu

# Using yarn
yarn global add lebu
```

### Requirements

- Node.js 18+ or Bun
- SSH client (for SSH connections only)

No database CLI tools needed! Lebu has built-in database drivers.

## 🚀 Quick Start

```bash
# Launch interactive mode
lebu

# Or use direct commands
lebu add                    # Add a new connection
lebu ssh my-server          # Quick SSH connect
lebu db production-pg       # Connect to database
lebu list                   # List all connections
```

## 📖 Usage

### Interactive Mode

Just run `lebu` to open the interactive menu:

```
  ██╗     ███████╗██████╗ ██╗   ██╗
  ██║     ██╔════╝██╔══██╗██║   ██║
  ██║     █████╗  ██████╔╝██║   ██║
  ██║     ██╔══╝  ██╔══██╗██║   ██║
  ███████╗███████╗██████╔╝╚██████╔╝
  ╚══════╝╚══════╝╚═════╝  ╚═════╝ 

  🔗 Connection Manager v0.1.0
  ─────────────────────────────────

? What would you like to do?
  ❯ 🚀 Quick Connect (3 saved)
    ➕ Add Connection
    📋 List Connections
    🗑️  Delete Connection
    ❓ Help
    ✕ Exit
```

### Commands

| Command | Description |
|---------|-------------|
| `lebu` | Interactive mode with fuzzy search |
| `lebu add` | Add a new connection |
| `lebu list` | List all saved connections |
| `lebu ssh <name>` | Quick SSH connect |
| `lebu sftp <name>` | SFTP file manager (built-in) |
| `lebu explore <name>` | Database explorer (built-in) |
| `lebu db <name>` | Open database CLI (psql, mysql...) |
| `lebu rm <name>` | Remove a connection |

### Adding Connections

```bash
$ lebu add

  ➕ Add New Connection

? Connection type: SSH
? Connection name: prod-server
? Host: 192.168.1.100
? Username: deploy
? Port: 22
? Authentication method: SSH Key
? How would you like to provide the SSH key?
  ❯ 📂 Select from ~/.ssh
    📝 Enter file path
    📋 Paste key content
? Auto-accept host fingerprint on first connect? Yes
? Tags (comma separated, optional): production, api

  ✓ Connection 'prod-server' saved!
```

### Quick Connect with Fuzzy Search

```bash
$ lebu

? Search connections: prod█

  ❯ 🖥️  prod-server          192.168.1.100
    🗄️  prod-database        db.prod.internal
    📁  prod-backup          backup.prod.com
```

### Database Explorer

Browse tables and run queries without installing psql, mysql, or mongosh:

```bash
$ lebu explore my-postgres

  ✓ Connected to my-postgres (postgres)
  ─────────────────────────────────────────

? What would you like to do?
  ❯ 📋 List Tables
    🔍 Browse Table
    ⚡ Run Query
    ← Exit
```

### SFTP File Manager

Built-in file browser - click folders to navigate, click files for actions:

```
  📁 my-server
  /home/deploy
  ─────────────────────────────────────────

? 8 items
  ❯ 📁 ..
    📁 config
    📁 logs
    📄 app.js                        2.4 KB
    📄 package.json                  1.1 KB
    ───────────────────────────────
    ⬆️  Upload file here
    📁 New folder
    ← Exit
```

Features:
- Navigate folders by clicking
- Download/delete files
- Upload from local machine
- Create new folders
- View hidden files

## 🔐 Security

Lebu takes security seriously. Your credentials never touch disk in plain text.

### System Keychain Integration

Passwords are stored in your operating system's secure credential storage:

| OS | Storage |
|----|---------|
| macOS | Keychain Access |
| Linux | Secret Service (GNOME Keyring / KWallet) |
| Windows | Windows Credential Manager |

This means:
- ✅ Passwords encrypted by your OS
- ✅ Protected by your system login
- ✅ Never stored in plain text files
- ✅ Automatically removed when you delete a connection

### SSH Key Handling

- Select existing keys from `~/.ssh`
- Enter a custom path
- Paste key content directly (saved with `chmod 600`)

### Host Fingerprint

- Optional auto-accept for first connection (`StrictHostKeyChecking=accept-new`)
- Changed fingerprints are always rejected (protects against MITM attacks)

## 🗂️ Data Storage

```
# Connection metadata (no passwords)
~/.config/lebu/config.json        # Linux
~/Library/Preferences/lebu/       # macOS

# Passwords
System Keychain (service: "lebu")
```

You can view stored credentials in:
- **macOS**: Keychain Access → search "lebu"
- **Linux**: Seahorse (GNOME) or KWalletManager
- **Windows**: Credential Manager → Windows Credentials

## 🛠️ Development

```bash
# Clone the repo
git clone https://github.com/yourusername/lebu.git
cd lebu

# Install dependencies
bun install

# Run in development
bun run dev

# Build standalone binary
bun run build
```

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Development Guidelines

- Write clean, readable TypeScript
- Follow existing code style
- Test your changes manually before submitting
- Update documentation if needed

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

```
MIT License

Copyright (c) 2024 Lebu Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 💖 Acknowledgments

Built with:
- [Bun](https://bun.sh) - Fast JavaScript runtime
- [Inquirer](https://github.com/SBoudrias/Inquirer.js) - Interactive prompts
- [Chalk](https://github.com/chalk/chalk) - Terminal styling
- [Commander](https://github.com/tj/commander.js) - CLI framework
- [Fuse.js](https://fusejs.io) - Fuzzy search
- [Keytar](https://github.com/atom/node-keytar) - System keychain integration
- [ssh2](https://github.com/mscdex/ssh2) - SSH/SFTP client
- [pg](https://github.com/brianc/node-postgres) / [mysql2](https://github.com/sidorares/node-mysql2) / [mongodb](https://github.com/mongodb/node-mongodb-native) - Database drivers

---

<p align="center">
  Made with ☕ by developers, for developers.
</p>
