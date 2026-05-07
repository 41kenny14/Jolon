import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

export class SignalLogger {
  constructor({ logFile = './runtime-signals.log' } = {}) {
    this.logFile = this.#sanitizeLogPath(logFile);
  }

  async log({ event, input = null, output = null, metadata = {} }) {
    const entry = {
      timestamp: new Date().toISOString(),
      event,
      input,
      output,
      metadata,
    };

    const dir = path.dirname(this.logFile);
    if (dir && dir !== '.') await mkdir(dir, { recursive: true });

    await appendFile(this.logFile, `${JSON.stringify(entry)}\n`, 'utf8');
    return entry;
  }

  #sanitizeLogPath(logFile) {
    const resolved = path.resolve(String(logFile || './runtime-signals.log'));
    const cwd = process.cwd();
    if (!resolved.startsWith(cwd + path.sep) && resolved !== cwd) {
      throw new Error('logFile fuera del directorio de trabajo no permitido.');
    }
    return resolved;
  }
}
