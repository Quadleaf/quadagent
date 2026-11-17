// Prints the SCRIPT.md shot table and VO cues from src/timeline.ts, with real start
// times (the intro length and TRANSITION overlap match src/scenes/teaser.tsx).
//   npx tsx tools/script.ts
import { INTRO, OUTRO, SHOTS } from '../src/timeline.ts';

const TRANSITION = 0.32;
const INTRO_LEN = 0.45 + 0.5 + 0.35 + INTRO.hold + 0.28 + 0.3; // logoOpen() steps in teaser.tsx
const END_CARD_IN = 1.25; // endCard() entrance, before OUTRO.hold
const WPS = 2.6; // comfortable read; 2.9 is brisk, above 3 is rushed

let t = INTRO_LEN;
const rows: string[] = ['| Starts (s) | Shot | Caption | On screen |', '|---|---|---|---|', `| 0.0 | intro | - | Logo build |`];
const cues: string[] = [];
for (const s of SHOTS) {
  rows.push(`| ${t.toFixed(1)} | ${s.id} | ${s.caption?.replace(/\*/g, '') ?? '-'} | ${s.note} |`);
  const words = s.vo.split(/\s+/).length;
  const room = s.dur - TRANSITION;
  cues.push(`- **${t.toFixed(1)} s:** ${s.vo}${words / WPS > room + 0.6 ? `  <!-- ${words} words in ${room.toFixed(1)} s: too long -->` : ''}`);
  t += s.dur - TRANSITION;
}
rows.push(`| ${t.toFixed(1)} | end card | ${OUTRO.headline} | Logo, "${OUTRO.tagline}", badge |`);
const total = t + END_CARD_IN + OUTRO.hold;
const words = SHOTS.reduce((n, s) => n + s.vo.split(/\s+/).length, 0);
console.log(`Total about ${total.toFixed(1)} s (check with ffprobe after render).\n`);
console.log(rows.join('\n'));
console.log(`\n## Voiceover (${words} words)\n`);
console.log(cues.join('\n'));
