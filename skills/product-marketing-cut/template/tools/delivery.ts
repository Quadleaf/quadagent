// Shared delivery helpers for render.ts and tools/finalize.ts: the ffmpeg arguments that
// replace all metadata with metadata.ts, and a post-write check of the finished file.
import { readFileSync } from 'node:fs';
import { homedir, userInfo } from 'node:os';
import { metadataFor } from '../metadata.ts';

// Removes every SEI NAL unit. x264 writes its version and full settings into one
// ("x264 - core ... options: ..."); other encoders add their own.
export const STRIP_SEI = ['-bsf:v', 'filter_units=remove_types=6'];

// Rec. 709 tags for HD. Only correct when the pixels really are BT.709-encoded; see
// BT709_FROM_MASTER in render.ts.
export const BT709_TAGS = ['-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv'];

/** Output args: drop all source metadata and chapters, then write only metadata.ts. */
export function metadataArgs(variant: string | undefined, opts: { audio: boolean }): string[] {
  const m = metadataFor(variant);
  for (const [key, value] of Object.entries(m)) {
    if (typeof value === 'string' && value.includes('TODO')) {
      throw new Error(`metadata.ts: fill in "${key}" before making deliverables (it still says "${value}").`);
    }
  }
  // +bitexact stops the muxer writing its own "encoder=Lavf..." tag.
  const args = ['-map_metadata', '-1', '-map_chapters', '-1', '-fflags', '+bitexact'];
  const tag = (key: string, value?: string) => {
    if (value) args.push('-metadata', `${key}=${value}`);
  };
  tag('title', m.title);
  tag('artist', m.artist);
  tag('album_artist', m.artist);
  tag('copyright', m.copyright);
  tag('description', m.description);
  tag('comment', m.comment);
  tag('creation_time', new Date().toISOString());
  if (m.language) {
    args.push('-metadata:s:v', `language=${m.language}`);
    if (opts.audio) args.push('-metadata:s:a', `language=${m.language}`);
  }
  return args;
}

/**
 * Fails if the finished file still names a tool, encoder or local path, or if its index
 * (moov) is not in front of the media data (needed to start playing before download ends).
 */
export function verifyDelivery(file: string): void {
  const buf = readFileSync(file);
  const needles = ['x264 - core', 'Lavf', 'Lavc', 'HandBrake', 'Revideo', 'CapCut', 'iMovie', 'Playwright', 'HeadlessChrome', homedir()];
  const user = userInfo().username;
  if (user.length >= 6) needles.push(user); // shorter names collide with random media bytes
  const found = needles.filter((n) => buf.includes(n));
  const moov = buf.indexOf('moov');
  const mdat = buf.indexOf('mdat');
  const problems = [
    ...found.map((n) => `contains "${n}"`),
    ...(moov < 0 || mdat < 0 || moov > mdat ? ['moov atom is not before mdat (no faststart)'] : []),
  ];
  if (problems.length) throw new Error(`${file}: ${problems.join('; ')}`);
  console.log('verified', file);
}
