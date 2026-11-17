import type { Shot } from './types';

// The cut: the single source of truth for shots, camera framings, captions and VO.
// tools/script.ts turns it into SCRIPT.md.
// Footage (public/footage/): clips from capture/record.ts, stills = frames of those clips
// (copy raw/frames/<shot>/00000.png etc.) so every image is 4K and pixel-consistent.
// Camera coordinates are page pixels on the 1920x1080 frame; w = 960 is a 2x punch-in.
export const INTRO = { subtitle: 'THE NEW PRODUCT', hold: 0.5 }; // TODO
export const OUTRO = {
  headline: 'Your headline. One line.', // TODO
  tagline: 'The new Product', // TODO
  // One MP4 per variant (render.ts VARIANTS).
  badge: { available: 'NOW AVAILABLE', soon: 'COMING SOON' },
  hold: 2.2,
};

export const SHOTS: Shot[] = [
  {
    id: 'board',
    dur: 4.8,
    src: 'board-scroll.mp4',
    rate: 1.8,
    from: { x: 960, y: 540, w: 1920 },
    to: { x: 1000, y: 560, w: 1720 },
    caption: 'Meet the New *Product*',
    vo: 'Meet the new Product. Everything you need, the moment you log in.',
    note: 'The whole page scrolls top to bottom.',
  },
  {
    id: 'feature',
    dur: 3.4,
    src: 'board-top.png',
    enter: 'whip',
    from: { x: 1500, y: 215, w: 1060 },
    to: { x: 1500, y: 215, w: 900 },
    caption: 'Know what is *current*',
    vo: 'See at a glance what needs attention.',
    note: 'Punch-in on one widget from a 4K still.',
  },
  {
    id: 'wide',
    dur: 2.6,
    src: 'board-top.png',
    from: { x: 1100, y: 470, w: 1200 },
    to: { x: 960, y: 540, w: 1920 },
    vo: 'One screen. The new Product, available now.',
    note: 'Pull back to the full page, into the end card.',
  },
];
