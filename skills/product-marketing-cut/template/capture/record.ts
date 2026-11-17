// Frame-exact video capture of the product, read-only.
//   npx tsx capture/record.ts                 every shot
//   SHOTS=board-scroll npx tsx capture/record.ts  one shot (comma list)
//
// Not a screen recording. The page clock (Date, timers, requestAnimationFrame) is
// installed before any page script, then advanced exactly 1/FPS per frame with a
// screenshot after each step. Slow screenshots never drop or stretch frames, and JS
// animations (map flyTo, chart tweens) play at true speed in the output.
// CSS transitions run on REAL time, so do not build a shot around one (a dialog fade
// is fine: it simply completes within a frame or two).
//
// Output per shot:
//   raw/frames/<shot>/00000.png ...   lossless frames (2x device pixels)
//   public/footage/<shot>.mp4         4K x264 crf 12, the edit source
//   raw/preview/<shot>-1080p.mp4      quick-look preview
import { chromium, type Page } from 'playwright';
import ffmpeg from '@ffmpeg-installer/ffmpeg';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { BASE_URL, CLEARED, FPS, HOME_PATH, SCALE, SENSITIVE, STORAGE_STATE, VIEWPORT, onClearedAccount } from './config.ts';
import { installGuard } from './guard.ts';

const FRAMES = 'raw/frames';
const FOOTAGE = 'public/footage';
const PREVIEW = 'raw/preview';
const LOGS = 'raw/record';
const ONLY = process.env.SHOTS?.split(',').map((s) => s.trim());

export const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2); // easeInOutCubic

/** The element the page scrolls in (apps often scroll an inner container, not the window). */
export const scroller = (page: Page) =>
  page.evaluateHandle(
    () =>
      [...document.querySelectorAll<HTMLElement>('*')].find(
        (e) => /(auto|scroll)/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 50,
      ) ?? document.scrollingElement!,
  );

/** Natural-time wait for data: network idle, skeletons and spinners gone, a beat to paint. */
async function settle(page: Page) {
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  for (let i = 0; i < 60; i++) {
    const busy = await page.locator('.MuiSkeleton-root:visible, [role="progressbar"]:visible, [aria-busy="true"]:visible').count().catch(() => 0);
    if (!busy) break;
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(1500);
}

/** Network assets (map tiles, lazy images) arrive in real time; hold the frame until visible ones load. */
async function assetsReady(page: Page) {
  await page
    .waitForFunction(() => [...document.images].filter((i) => i.getBoundingClientRect().height > 0).every((i) => i.complete), undefined, {
      timeout: 4000,
    })
    .catch(() => {});
}

export class Recorder {
  private n = 0;
  constructor(private page: Page, private dir: string) {}
  /** Advances the page clock one frame and saves it. */
  async frame() {
    await this.page.clock.runFor(1000 / FPS);
    await assetsReady(this.page);
    await this.page.screenshot({ path: `${this.dir}/${String(this.n++).padStart(5, '0')}.png` });
  }
  async hold(seconds: number) {
    for (let i = 0; i < Math.round(seconds * FPS); i++) await this.frame();
  }
  get count() {
    return this.n;
  }
}

interface Shot {
  name: string;
  /** Runs in natural time before the clock is paused (navigation, opening views, waiting for data). */
  setup?: (page: Page) => Promise<void>;
  /** Runs on the frozen clock: every rec.frame() is one output frame. */
  run: (page: Page, rec: Recorder) => Promise<void>;
}

// TODO: the shots for this cut. Record generous holds: the edit can trim, not extend.
const SHOTS: Shot[] = [
  {
    // The whole page, top to bottom: hold, eased scroll, hold.
    name: 'board-scroll',
    async run(page, rec) {
      const el = await scroller(page);
      const max = await el.evaluate((e) => e.scrollHeight - e.clientHeight);
      await rec.hold(1);
      const frames = 7 * FPS;
      for (let i = 1; i <= frames; i++) {
        await el.evaluate((e, y) => (e.scrollTop = y), Math.round(max * ease(i / frames)));
        await rec.frame();
      }
      await rec.hold(1);
    },
  },
  // Example of a click shot (client-state only; never click anything that saves):
  // {
  //   name: 'customize',
  //   async run(page, rec) {
  //     await rec.hold(0.8);
  //     await page.getByRole('button', { name: 'Customize', exact: true }).click({ noWaitAfter: true });
  //     await page.mouse.move(0, 0); // no hover states on screen
  //     await rec.hold(3);
  //   },
  // },
];

function encode(name: string) {
  mkdirSync(FOOTAGE, { recursive: true });
  mkdirSync(PREVIEW, { recursive: true });
  const input = ['-v', 'error', '-y', '-framerate', String(FPS), '-i', `${FRAMES}/${name}/%05d.png`];
  const x264 = ['-c:v', 'libx264', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an'];
  execFileSync(ffmpeg.path, [...input, ...x264, '-crf', '12', `${FOOTAGE}/${name}.mp4`]);
  execFileSync(ffmpeg.path, [...input, '-vf', `scale=${VIEWPORT.width}:${VIEWPORT.height}:flags=lanczos`, ...x264, '-crf', '16', `${PREVIEW}/${name}-1080p.mp4`]);
}

mkdirSync(LOGS, { recursive: true });
const browser = await chromium.launch({ headless: true });
const leaks: string[] = [];
for (const shot of SHOTS.filter((s) => !ONLY || ONLY.includes(s.name))) {
  const context = await browser.newContext({ storageState: STORAGE_STATE, viewport: VIEWPORT, deviceScaleFactor: SCALE });
  const guard = await installGuard(context, `${LOGS}/guard.log`);
  const page = await context.newPage();
  await page.clock.install(); // before any page script, so libraries bind to the controllable rAF
  await page.goto(`${BASE_URL}${HOME_PATH}`, { waitUntil: 'domcontentloaded' });
  await settle(page);
  if (!(await onClearedAccount(page))) throw new Error('Not on the cleared demo account (or the session expired): run npm run login.');
  await page.mouse.move(0, 0);

  if (shot.setup) await shot.setup(page);
  await settle(page);

  const dir = `${FRAMES}/${shot.name}`;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 200); // a beat ahead: pauseAt cannot go back
  const rec = new Recorder(page, dir);
  const t0 = Date.now();
  await shot.run(page, rec);

  const text = await page.evaluate(() => document.body.innerText);
  const hits = [...new Set(SENSITIVE.flatMap((r) => text.match(new RegExp(r.source, r.flags.includes('g') ? r.flags : r.flags + 'g')) ?? []))];
  const bad = hits.filter((h) => !CLEARED.includes(h));
  await context.close();
  if (guard.blocked.length) console.log(`${shot.name}: guard blocked ${guard.blocked.join('; ')}`);
  if (bad.length) {
    // Never leave leaked footage where the edit can pick it up.
    leaks.push(`${shot.name}: ${bad.join(', ')}`);
    rmSync(dir, { recursive: true, force: true });
    rmSync(`${FOOTAGE}/${shot.name}.mp4`, { force: true });
    rmSync(`${PREVIEW}/${shot.name}-1080p.mp4`, { force: true });
    console.error(`${shot.name}: LEAK, frames and footage deleted`);
    continue;
  }

  encode(shot.name);
  console.log(`${shot.name}: ${rec.count} frames (${(rec.count / FPS).toFixed(1)} s) captured in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
await browser.close();
writeFileSync(`${LOGS}/audit.txt`, leaks.length ? leaks.join('\n') : 'OK\n');
if (leaks.length) {
  console.error(`ON-SCREEN LEAKS (do not use this footage):\n${leaks.join('\n')}`);
  process.exit(1);
}
console.log('on-screen audit OK');
