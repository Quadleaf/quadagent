// Opens a real browser so the OWNER logs in and switches to the cleared demo account
// themselves, then closes the window. The session is saved to STORAGE_STATE
// (git-ignored). No credentials are typed or stored by this script.
//
// It snapshots the session only while the browser is on the cleared account: a window
// left open past token expiry would otherwise overwrite a good session with a
// logged-out one (seen in practice: it also left the browser looping on new tabs).
import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'node:fs';
import { BASE_URL, HOME_PATH, STORAGE_STATE, onClearedAccount } from './config.ts';

mkdirSync('.auth', { recursive: true });
const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({
  viewport: { width: 1600, height: 950 },
  ...(existsSync(STORAGE_STATE) ? { storageState: STORAGE_STATE } : {}),
});
const page = await context.newPage();
await page.goto(`${BASE_URL}${HOME_PATH}`);
console.log('Log in, switch to the demo account, open the home page once, then close the window.');

let saves = 0;
const timer = setInterval(async () => {
  try {
    if (!(await onClearedAccount(page))) return;
    await context.storageState({ path: STORAGE_STATE });
    saves++;
  } catch {
    /* page closing */
  }
}, 2000);

await new Promise<void>((resolve) => page.on('close', () => resolve()));
clearInterval(timer);
await browser.close().catch(() => {});
console.log(saves ? `Saved session to ${STORAGE_STATE}.` : 'Nothing saved: the window never reached the cleared account.');
