// Capture settings for this cut. Fill in every TODO before the first capture.
//
// Footage must come from an account that holds ONLY data cleared for public display
// (a demo/sandbox account with synthetic or customer-approved data). Never film a
// copy of real customer data, even on a test environment.
import type { Page } from 'playwright';

export const BASE_URL = 'https://app.example.com'; // TODO: environment to film
export const STORAGE_STATE = '.auth/session.json'; // saved by `npm run login`, git-ignored
export const VIEWPORT = { width: 1920, height: 1080 };
export const SCALE = 2; // device pixels: 4K frames give the edit 2x of punch-in headroom
export const FPS = 30;
export const HOME_PATH = '/home'; // TODO: the page most shots start from

/**
 * Hard stop: true only when the browser is signed in to the cleared demo account.
 * Every capture script calls this before recording a single frame.
 * TODO: read the active account the way the app exposes it (localStorage, a /me call,
 * a header element) and compare it to the cleared account id.
 */
export async function onClearedAccount(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    // Example: return JSON.parse(localStorage.getItem('user') ?? '{}').accountId === 12345;
    return false;
  });
}

/**
 * On-screen text audit. After every shot the page text is scanned with these
 * patterns; any match that is not in CLEARED is a leak and fails the run.
 * TODO: patterns for identifiers that must never appear (customer names, IDs,
 * registrations, emails...) and the values that are cleared for this cut.
 */
export const SENSITIVE: RegExp[] = [/\b[\w.+-]+@[\w-]+\.[\w.]+\b/g];
export const CLEARED: string[] = [];

/** Requests that must be aborted even if they look harmless (saves on click etc.). */
export const ALWAYS_BLOCK: RegExp[] = [/\/settings/i, /\/layout/i, /upload/i, /\/share/i];

/**
 * Non-GET requests that only read (host + path). Add one ONLY after reading the
 * server code behind it and confirming it writes nothing.
 */
export const READ_ONLY_POSTS: RegExp[] = [];
