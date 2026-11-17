// Renders the teaser with Revideo (MIT), one MP4 per end-card variant:
//   out/<NAME>-now-available.mp4  (badge NOW AVAILABLE)
//   out/<NAME>-coming-soon.mp4    (badge COMING SOON)
// 1. Revideo renders a ProRes 4444 master (out/master-<variant>.mov) so nothing is lost.
// 2. The bundled ffmpeg (@ffmpeg-installer, no system install) encodes the final
//    H.264 MP4: crf 14, yuv420p, faststart, and NO audio track.
//   npm run render                    both variants
//   VARIANTS=soon npm run render      one variant (available | soon)
//   npm run stills                    also writes review PNGs into stills/<variant>/
//   STILL_TIMES=2,8.5 npm run stills  pick your own still times (seconds)
process.env.DISABLE_TELEMETRY = 'true';
import { renderVideo } from '@revideo/renderer';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import ffmpeg from '@ffmpeg-installer/ffmpeg';

const OUT_DIR = 'out';
const NAME = 'product-teaser'; // TODO: deliverable file name stem (external product name, not an internal codename)
const VARIANT_FILES: Record<string, string> = { available: 'now-available', soon: 'coming-soon' };
const variants = (process.env.VARIANTS ?? 'available,soon').split(',').map((v) => v.trim());
for (const v of variants) if (!VARIANT_FILES[v]) throw new Error(`Unknown variant "${v}" (use available or soon).`);
mkdirSync(OUT_DIR, { recursive: true });

for (const variant of variants) {
  const name = VARIANT_FILES[variant];
  const final = `${OUT_DIR}/${NAME}-${name}.mp4`;
  const master = await renderVideo({
    projectFile: './src/project.ts',
    variables: { variant },
    settings: {
      outFile: `master-${name}.mov`,
      outDir: OUT_DIR,
      logProgress: true,
      workers: 1,
      // Must repeat the project's exporter here: the renderer reads the format from these
      // settings when it collects the worker output, and defaults to mp4 otherwise.
      projectSettings: { exporter: { name: '@revideo/core/ffmpeg', options: { format: 'proRes' } } },
    },
  });

  execFileSync(ffmpeg.path, [
    '-v', 'error', '-y', '-i', master,
    '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p',
    '-profile:v', 'high', '-r', '30', '-movflags', '+faststart', final,
  ]);
  console.log('final', final);

  if (process.argv.includes('--stills')) {
    const times = (process.env.STILL_TIMES ?? '1.5,5,9,12.5,15.5,18.5,21.5,25,28.5,32,36,38.5').split(',');
    const dir = `stills/${name}`;
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    for (const t of times) {
      const outPng = `${dir}/${String(Number(t).toFixed(1)).padStart(4, '0')}s.png`;
      execFileSync(ffmpeg.path, ['-v', 'error', '-y', '-ss', t, '-i', final, '-frames:v', '1', outPng]);
      console.log('still', outPng);
    }
  }
}
