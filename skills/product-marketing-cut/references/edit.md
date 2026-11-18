# Edit, render and review

## Revideo 0.11 gotchas (all hit in practice)

- **Video decoder.** Use `<Video decoder={'web'} ...>`. The `ffmpeg` decoder can't
  resolve `/footage/...` paths from `public/` at render time ("No such file").
  `playbackRate` works with the web decoder.
- **Exporter.** Repeat the project exporter in `renderVideo({ settings: {
  projectSettings: { exporter } } })`. Otherwise the renderer collects the worker
  output as mp4 while the project wrote ProRes, and the master is missing.
- **Variants.** Pass `renderVideo({ variables: { variant } })` and read it in the scene
  with `useScene().variables.get('variant', 'available')()`. One project gives
  N outputs.
- **Assets.** `public/` is served at `/`. Fonts must be registered with `FontFace` in
  `project.ts` before the first frame, or the first frames render in a fallback font.
- **Color.** The ProRes master is untagged, but its RGB to YUV step uses the BT.601
  matrix. Measured: brand colors decode exactly with BT.601 and drift with BT.709
  (#008fff showed as #0088ff). Players assume BT.709 for untagged HD. `render.ts`
  converts the matrix and tags BT.709. If you change the exporter or the Revideo
  version, re-measure. Decode a flat brand-colored pixel with each matrix:
  `-vf "crop=2:2:X:Y,scale=1:1:in_color_matrix=bt709:in_range=tv:out_range=pc:flags=neighbor,format=rgb24" -f rawvideo - | xxd -p`
- **Tooling.** Keep `tsx` for capture and render scripts. Throwaway scripts must live
  inside the project, because `/tmp` can't resolve `node_modules`, and must be ES
  modules (top-level await).

## Camera

- **Framing.** Each shot has a `from` and a `to` camera `{ x, y, w }` in page
  pixels on the 1920x1080 frame, eased in-out over the shot. `w = 1920` is the full
  page and `w = 960` is a 2x punch-in.
- **Clamping.** `clampCam()` keeps every framing inside the page. Without it,
  punch-ins near the right column show the page edge.
- **Finding coordinates.** Read them off a still. Display pixels times
  (1920 / displayed width) gives page pixels. For a widget, center on its box and
  set `w` to about the widget width plus 15%.
- **When data changes,** content shifts. Diff old and new stills, then move the
  framings by the delta.
- **Pacing.** Use slow push-ins, about 10-15% scale change per shot. Whip entrances
  separate topics; zoom entrances open sections.

## Captions

- Use 2-6 words, with one accent idea in color. Star each word of a multi-word accent:
  `in *real* *time*`.
- Default to the bottom. Move a caption to the top only when the bottom covers the
  subject, and check the top doesn't cover the page title bar or header.
- The caption sits about 130 px from the edge, at 68 px bold. Five words fit easily;
  check anything over 35 characters on a still.
- Captions fade out 0.45 s before the shot ends. A mid-fade frame in a still is not
  a bug.

## Timing math

- Each shot overlaps the next by `TRANSITION` (0.32 s).
- Total = intro (about 2.4 s) + sum(dur) - (n - 1) x TRANSITION + end card entrance
  (about 1.25 s) + `OUTRO.hold`.
- `tools/script.ts` computes the start times. Verify the result with ffprobe.
- To add beats under a cap, trim every shot a little rather than cutting one. Holds
  under 3 s feel rushed for anything with text to read.

## Review loop (never skip)

1. Run `npm run stills`, which writes PNGs at chosen times to `stills/<variant>/`.
2. Build a contact sheet and look at it:
   ```bash
   FF=node_modules/@ffmpeg-installer/darwin-arm64/ffmpeg   # platform package
   $FF -v error -y -pattern_type glob -i 'stills/now-available/*.png' \
     -vf "scale=640:-1,tile=3x4" -frames:v 1 sheet.png
   ```
   For a single clip, sample every N frames:
   `-vf "select='not(mod(n\,21))',scale=640:-1,tile=4x2"`.
3. Check:
   - captions over the subject or over each other;
   - page edges or cropped titles at the end of a push;
   - blank or loading widgets;
   - names or IDs in images;
   - the end card in every variant.
4. Confirm length and format: `ffmpeg -i out/x.mp4` shows Duration, 1920x1080,
   30 fps, `bt709`, and either no audio stream or the music bed's AAC stream. Its
   metadata lists only the `metadata.ts` tags (no `encoder`).

## Music bed

`MUSIC` in `render.ts` (`tools/music.ts`) trims the track from `start` to the cut's
length and fades out over the last `fadeOut` seconds (default 3, the end card). It
normalizes to -14 LUFS with two-pass loudnorm, and the AAC goes into the same encode
as the picture. The render fails unless the final MP4 measures within 1 LU of the target
with true peak at or below -1 dBTP.

- **AAC raises peaks.** On a hot, dense track: +1.5 dB at 192 kbps and +1.1 dB at
  256 kbps. Hence the bed's -2.5 dBTP default and 256 kbps AAC. If the final check
  fails, lower `truePeak`; don't skip the check.
- **ffmpeg's AAC encoder** writes its "Lavc" version into the stream unless
  `-flags:a +bitexact` is set. `verifyDelivery()` catches it.
- **ffmpeg 4.4** (the bundled build) loses the channel layout after `aresample`
  ("Cannot select channel layout"). Restate it with `aformat=channel_layouts=stereo`.
- Stock tracks are often mastered above 0 dBFS. Measure before choosing `start`; the
  loudness check covers the result.

## SCRIPT.md shape

- Header: length, format, versions, data source and approvals, and anything staged.
- Shot table: start, shot, caption, on screen.
- Voiceover: total words; one line per cue with its start time; the alternate line
  for each version.
- Footer: "The source of truth is `src/timeline.ts`."
