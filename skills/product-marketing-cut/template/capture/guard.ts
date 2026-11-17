// Write guard: every request that is not GET/HEAD/OPTIONS is ABORTED unless it matches
// READ_ONLY_POSTS, or the caller opens a one-shot write window for an action the owner
// approved. ALWAYS_BLOCK wins over everything, including write windows.
// Every decision is appended to the log file, so the run leaves an audit trail.
import type { BrowserContext, Request } from 'playwright';
import { appendFileSync } from 'node:fs';
import { ALWAYS_BLOCK, READ_ONLY_POSTS } from './config.ts';

export interface Guard {
  allowWrites(patterns: RegExp[], max: number): void;
  closeWrites(): void;
  blocked: string[];
  allowed: string[];
}

export async function installGuard(context: BrowserContext, logFile: string): Promise<Guard> {
  let writeWindow: RegExp[] = [];
  let writesLeft = 0;
  const g: Guard = {
    blocked: [],
    allowed: [],
    allowWrites(patterns, max) {
      writeWindow = patterns;
      writesLeft = max;
    },
    closeWrites() {
      writeWindow = [];
      writesLeft = 0;
    },
  };
  const log = (line: string) => appendFileSync(logFile, `${new Date().toISOString()} ${line}\n`);

  await context.route('**/*', async (route) => {
    const req: Request = route.request();
    const m = req.method();
    if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return route.continue();
    const { host, pathname: path } = new URL(req.url());
    if (ALWAYS_BLOCK.some((r) => r.test(path))) {
      g.blocked.push(`${m} ${path}`);
      log(`BLOCK(always) ${m} ${path}`);
      return route.abort('blockedbyclient');
    }
    if (READ_ONLY_POSTS.some((r) => r.test(host + path))) {
      g.allowed.push(`${m} ${path}`);
      log(`ALLOW(read) ${m} ${path}`);
      return route.continue();
    }
    if (writesLeft > 0 && writeWindow.some((r) => r.test(path))) {
      writesLeft--;
      g.allowed.push(`${m} ${path}`);
      log(`ALLOW(write-window) ${m} ${path}`);
      return route.continue();
    }
    g.blocked.push(`${m} ${path}`);
    log(`BLOCK ${m} ${path}`);
    return route.abort('blockedbyclient');
  });
  return g;
}
