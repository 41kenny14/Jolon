import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

export class SignalLogger {
  constructor({ logFile = './runtime-signals.log' } = {}) {
    this.logFile = logFile;
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
}
