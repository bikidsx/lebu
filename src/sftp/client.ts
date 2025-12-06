import { Client, SFTPWrapper } from "ssh2";
import { readFileSync } from "fs";
import type { FileEntry } from "ssh2";

export interface RemoteFile {
  name: string;
  isDirectory: boolean;
  size: number;
  modifyTime: Date;
  permissions: string;
}

export class SFTPClient {
  private conn: Client;
  private sftp: SFTPWrapper | null = null;

  constructor(
    private host: string,
    private port: number,
    private username: string,
    private privateKeyPath?: string,
    private password?: string,
    private autoAcceptFingerprint = true
  ) {
    this.conn = new Client();
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.conn.on("ready", () => {
        this.conn.sftp((err, sftp) => {
          if (err) {
            reject(err);
            return;
          }
          this.sftp = sftp;
          resolve();
        });
      });

      this.conn.on("error", (err) => {
        reject(err);
      });

      const config: Record<string, unknown> = {
        host: this.host,
        port: this.port,
        username: this.username,
      };

      if (this.privateKeyPath) {
        const keyPath = this.privateKeyPath.replace("~", process.env.HOME || "");
        config.privateKey = readFileSync(keyPath);
      } else if (this.password) {
        config.password = this.password;
      }

      // Auto-accept host key
      if (this.autoAcceptFingerprint) {
        config.hostVerifier = () => true;
      }

      this.conn.connect(config);
    });
  }

  async disconnect(): Promise<void> {
    this.conn.end();
  }

  async list(remotePath: string): Promise<RemoteFile[]> {
    if (!this.sftp) throw new Error("Not connected");

    return new Promise((resolve, reject) => {
      this.sftp!.readdir(remotePath, (err, list) => {
        if (err) {
          reject(err);
          return;
        }

        const files: RemoteFile[] = list.map((item: FileEntry) => {
          // Check if directory using mode bits (S_IFDIR = 0o40000)
          const isDir = (item.attrs.mode & 0o170000) === 0o040000;
          return {
            name: item.filename,
            isDirectory: isDir,
            size: item.attrs.size,
            modifyTime: new Date(item.attrs.mtime * 1000),
            permissions: this.formatPermissions(item.attrs.mode),
          };
        });

        // Sort: directories first, then by name
        files.sort((a, b) => {
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          return a.name.localeCompare(b.name);
        });

        resolve(files);
      });
    });
  }

  async download(remotePath: string, localPath: string): Promise<void> {
    if (!this.sftp) throw new Error("Not connected");

    return new Promise((resolve, reject) => {
      this.sftp!.fastGet(remotePath, localPath, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async upload(localPath: string, remotePath: string): Promise<void> {
    if (!this.sftp) throw new Error("Not connected");

    return new Promise((resolve, reject) => {
      this.sftp!.fastPut(localPath, remotePath, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async delete(remotePath: string): Promise<void> {
    if (!this.sftp) throw new Error("Not connected");

    return new Promise((resolve, reject) => {
      this.sftp!.unlink(remotePath, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async rmdir(remotePath: string): Promise<void> {
    if (!this.sftp) throw new Error("Not connected");

    return new Promise((resolve, reject) => {
      this.sftp!.rmdir(remotePath, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async mkdir(remotePath: string): Promise<void> {
    if (!this.sftp) throw new Error("Not connected");

    return new Promise((resolve, reject) => {
      this.sftp!.mkdir(remotePath, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async stat(remotePath: string): Promise<{ isDirectory: boolean }> {
    if (!this.sftp) throw new Error("Not connected");

    return new Promise((resolve, reject) => {
      this.sftp!.stat(remotePath, (err, stats) => {
        if (err) reject(err);
        else {
          const isDir = (stats.mode & 0o170000) === 0o040000;
          resolve({ isDirectory: isDir });
        }
      });
    });
  }

  private formatPermissions(mode: number): string {
    const perms = ["---", "--x", "-w-", "-wx", "r--", "r-x", "rw-", "rwx"];
    const owner = perms[(mode >> 6) & 7];
    const group = perms[(mode >> 3) & 7];
    const other = perms[mode & 7];
    return owner + group + other;
  }
}
