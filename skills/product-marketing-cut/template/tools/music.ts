// Optional music bed for render.ts: trims a licensed track to the cut, fades it, and
// normalizes it to a social loudness target with two-pass loudnorm. Output is a 48 kHz
// stereo WAV that the final encode muxes as AAC.
import { execFileSync, spawnSync } from 'node:child_process';
import ffmpeg from '@ffmpeg-installer/ffmpeg';

export interface MusicBed {
  file: string; // the track; record its source page and license in the project README
  start?: number; // seconds into the track where the cut starts (default 0)
  fadeIn?: number; // seconds (default 0: most tracks start clean)
  fadeOut?: number; // seconds of fade at the end of the cut (default 3)
  lufs?: number; // integrated loudness target (default -14, social platforms)
  truePeak?: number; // true-peak ceiling for the bed in dBTP (default -2.5). AAC encoding
  //                     raises peaks: measured +1.1 dB at 256 kbps and +1.5 dB at 192 kbps
  //                     on a dense, hot track. The delivered limit is -1.
}

/** Duration in seconds, from ffmpeg's input summary. */
export function durationOf(file: string): number {
  const err = spawnSync(ffmpeg.path, ['-hide_banner', '-i', file], { encoding: 'utf8' }).stderr;
  const m = /Duration: (\d+):(\d+):([\d.]+)/.exec(err);
  if (!m) throw new Error(`${file}: could not read duration`);
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

/** Integrated loudness (LUFS) and true peak (dBTP) of a file's audio. */
export function measureLoudness(file: string): { lufs: number; truePeak: number } {
  const err = spawnSync(ffmpeg.path, ['-hide_banner', '-nostats', '-i', file, '-vn', '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
  const summary = err.slice(err.lastIndexOf('Summary:'));
  return {
    lufs: Number(/I:\s+(-?[\d.]+) LUFS/.exec(summary)?.[1]),
    truePeak: Number(/Peak:\s+(-?[\d.]+) dBFS/.exec(summary)?.[1]),
  };
}

/** Fails unless the file's audio is within 1 LU of the target and peaks at or below -1 dBTP. */
export function checkLoudness(file: string, lufsTarget = -14): void {
  const { lufs, truePeak } = measureLoudness(file);
  console.log(`loudness: ${lufs} LUFS integrated, true peak ${truePeak} dBTP (${file})`);
  if (!(Math.abs(lufs - lufsTarget) <= 1)) throw new Error(`${file}: loudness ${lufs} LUFS is not within 1 LU of ${lufsTarget}`);
  if (!(truePeak <= -1)) throw new Error(`${file}: true peak ${truePeak} dBTP is above -1`);
}

/** Writes the normalized bed to outFile and returns it. Fails if the result misses the target. */
export function buildMusicBed(music: MusicBed, duration: number, outFile: string): string {
  const { start = 0, fadeIn = 0, fadeOut = 3, lufs = -14, truePeak = -2.5 } = music;
  const available = durationOf(music.file) - start;
  if (available < duration) throw new Error(`${music.file}: only ${available.toFixed(1)} s after start=${start}, the cut needs ${duration.toFixed(1)} s`);
  const shape = [
    `atrim=start=${start}:duration=${duration}`,
    'asetpts=PTS-STARTPTS',
    'aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo',
    ...(fadeIn > 0 ? [`afade=t=in:st=0:d=${fadeIn}`] : []),
    ...(fadeOut > 0 ? [`afade=t=out:st=${duration - fadeOut}:d=${fadeOut}`] : []),
  ].join(',');
  const target = `I=${lufs}:TP=${truePeak}:LRA=11`;

  // Pass 1: measure the shaped audio.
  const p1 = spawnSync(ffmpeg.path, ['-hide_banner', '-nostats', '-i', music.file, '-af', `${shape},loudnorm=${target}:print_format=json`, '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
  const json = p1.slice(p1.lastIndexOf('{'), p1.lastIndexOf('}') + 1);
  const m = JSON.parse(json) as Record<string, string>;
  // Pass 2: apply the measured values. loudnorm stays linear (plain gain) when the peak
  // allows it and otherwise falls back to its dynamic mode; both are checked below.
  const measured = `measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}`;
  execFileSync(ffmpeg.path, [
    '-v', 'error', '-y', '-i', music.file,
    '-af', `${shape},loudnorm=${target}:${measured}:linear=true,aresample=48000,aformat=channel_layouts=stereo`, // ffmpeg 4.4 loses the layout after aresample
    '-map_metadata', '-1', '-c:a', 'pcm_s24le', outFile,
  ]);

  checkLoudness(outFile, lufs);
  return outFile;
}
