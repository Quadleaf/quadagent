// Stamps the metadata.ts tags onto a finished MP4 that was NOT made by render.ts, typically
// the owner's voiceover export from iMovie, CapCut, Premiere or similar. Those editors write
// their own title, thumbnail, encoder and tool tags; this replaces all of them.
//   npm run finalize -- <input.mp4> <output.mp4> [variant]
// - Stream copy: no re-encode, so picture and sound are untouched.
// - Never overwrites: the output must be a new path.
// - Reports color tags and audio loudness (social target about -14 LUFS integrated, true
//   peak at or below -1 dBTP) but does not change them; fix those in the editor.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import ffmpeg from '@ffmpeg-installer/ffmpeg';
import { metadataArgs, STRIP_SEI, verifyDelivery } from './delivery.ts';
import { measureLoudness } from './music.ts';

const [input, output, variant] = process.argv.slice(2);
if (!input || !output) {
  console.error('usage: npm run finalize -- <input.mp4> <output.mp4> [variant]');
  process.exit(1);
}
if (!existsSync(input)) throw new Error(`${input} not found`);
if (resolve(input) === resolve(output)) throw new Error('output must differ from input (originals are never overwritten)');
if (existsSync(output)) throw new Error(`${output} already exists; pick a new name or delete it yourself`);

// ffmpeg -i with no output prints the stream summary to stderr (and exits 1).
const probe = spawnSync(ffmpeg.path, ['-hide_banner', '-i', input], { encoding: 'utf8' }).stderr;
const videoLine = probe.split('\n').find((l) => /Stream #.*Video:/.test(l)) ?? '';
if (!videoLine) throw new Error(`${input}: no video stream`);
if (!/h264/.test(videoLine)) console.warn(`warning: video is not H.264: ${videoLine.trim()}`);
const hasAudio = /Stream #.*Audio:/.test(probe);
if (!/bt709|smpte170m|bt470bg/.test(videoLine)) {
  console.warn('warning: no color tags on the video. Re-export from the editor with Rec. 709 color rather than guessing tags here.');
}

execFileSync(ffmpeg.path, [
  '-v', 'error', '-n', '-i', input,
  '-map', '0:v:0', '-map', '0:a?', '-c', 'copy', ...STRIP_SEI,
  ...metadataArgs(variant, { audio: hasAudio }),
  '-movflags', '+faststart', output,
]);
verifyDelivery(output);

if (hasAudio) {
  const { lufs, truePeak: peak } = measureLoudness(output);
  console.log(`loudness: ${lufs} LUFS integrated, true peak ${peak} dBTP`);
  if (!(lufs >= -15 && lufs <= -13)) console.warn('warning: integrated loudness is outside -14 +/- 1 LUFS (social target)');
  if (!(peak <= -1)) console.warn('warning: true peak is above -1 dBTP');
} else {
  console.log('no audio track');
}
console.log('final', output);
