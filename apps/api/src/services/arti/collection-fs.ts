import fsPromises from "node:fs/promises";
import path from "node:path";
import lockfile from "proper-lockfile";
import fg from "fast-glob";

export interface CollectionFS {
  readFile(filePath: string): Promise<string>;
  writeFile(filePath: string, content: string): Promise<void>;
  readdir(dirPath: string): Promise<{ name: string; isDirectory: boolean }[]>;
  exists(filePath: string): Promise<boolean>;
  unlink(filePath: string): Promise<void>;
  mkdir(dirPath: string): Promise<void>;
  glob(pattern: string): Promise<string[]>;
  lock(filePath: string): Promise<() => Promise<void>>;
}

export class LocalFS implements CollectionFS {
  constructor(private basePath: string) {}

  async readFile(filePath: string): Promise<string> {
    return fsPromises.readFile(path.join(this.basePath, filePath), "utf-8");
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    const fullPath = path.join(this.basePath, filePath);
    await fsPromises.mkdir(path.dirname(fullPath), { recursive: true });
    await fsPromises.writeFile(fullPath, content, "utf-8");
  }

  async readdir(dirPath: string): Promise<{ name: string; isDirectory: boolean }[]> {
    const entries = await fsPromises.readdir(path.join(this.basePath, dirPath), {
      withFileTypes: true,
    });
    return entries.map((e) => ({ name: e.name, isDirectory: e.isDirectory() }));
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      await fsPromises.access(path.join(this.basePath, filePath));
      return true;
    } catch {
      return false;
    }
  }

  async unlink(filePath: string): Promise<void> {
    await fsPromises.unlink(path.join(this.basePath, filePath));
  }

  async mkdir(dirPath: string): Promise<void> {
    await fsPromises.mkdir(path.join(this.basePath, dirPath), { recursive: true });
  }

  async glob(pattern: string): Promise<string[]> {
    return fg(pattern, { cwd: this.basePath, ignore: [".arti/**"] });
  }

  async lock(filePath: string): Promise<() => Promise<void>> {
    const fullPath = path.join(this.basePath, filePath);
    // Ensure the file exists for locking
    await fsPromises.mkdir(path.dirname(fullPath), { recursive: true });
    try {
      await fsPromises.access(fullPath);
    } catch {
      await fsPromises.writeFile(fullPath, "", "utf-8");
    }
    const release = await lockfile.lock(fullPath, { retries: { retries: 10, minTimeout: 50, maxTimeout: 500 } });
    return release;
  }
}
