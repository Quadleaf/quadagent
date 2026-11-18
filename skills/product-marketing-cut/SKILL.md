---
name: product-marketing-cut
description: Make a short product marketing video ("cut", teaser, promo, sizzle) or marketing screenshots from a real web app - frame-exact Playwright capture of the live UI, edited in Revideo with camera moves, kinetic captions, a branded intro and end card, and a voiceover script. Use when asked to "make a promo video", "teaser for the new feature", "marketing cut", "product video", "capture footage of the app", "marketing screenshots", or to revise captions, shots, end cards or versions of an existing cut.
---

# Product marketing cut

Make a 20-60 s product video from the real app, plus stills and a voiceover script,
without ever putting non-public data on screen or changing anything in the app.

The approach, proven on a shipped teaser:

1. Capture the live UI **frame by frame** with Playwright on a frozen page clock.
   You get perfectly smooth 4K footage regardless of how slow screenshots are.
2. Edit in **Revideo** (MIT, code-defined). One `timeline.ts` holds every shot,
   camera move, caption and VO line, so marketing revisions are text edits.
3. Render a ProRes master, then an H.264 MP4 per version (silent or with a loudness-
   normalized music bed) that carries only the
   owner's delivery metadata (title, company, copyright), with tool strings stripped.

`template/` is a working project. Copy it, fill in the TODOs, then follow the steps
below. `references/capture.md` and `references/edit.md` have the technique details
and the traps already hit. Read them before writing capture or scene code.

## 0. Brief: settle these before any capture

Ask for anything the request does not answer. Each one changed real work last time.

- **Audience-facing names.** Internal codenames must not leak into captions, VO or
  file names. Ask what marketing calls the feature.
- **Length, size, fps, audio.** The default is 30-40 s, 1920x1080, 30 fps. Ask about
  audio. There are three options:
  - none: the owner lays a voiceover over the silent MP4 (then use `npm run finalize`);
  - a music bed: set `MUSIC` in `render.ts` (see references/edit.md);
  - both.
  Music must be licensed for commercial web use with no attribution, for example CC0
  (FreePD), Mixkit or the Pixabay license. Pixabay tracks can still draw YouTube
  Content ID claims. Record the source page and license in the project README.
- **Versions.** For example "Now Available" and "Coming Soon" end cards. Build
  variants in from the start (render variables), not as copies.
- **Footage source.** Use one account that holds only data cleared for public display.
  Get explicit approval for every identifier that will be visible: customer, tail or
  registration, person, partner, vendor. Record the approval in the project README.
- **What counts as a write** in this app: controls that save on click, things that
  create records, uploads and jobs. Ask which writes are acceptable, if any; for
  example, asking an AI assistant one question may be fine.
- **Tooling and licenses.** Revideo is MIT. Ask before using Remotion, which needs a
  company license above a size threshold. Pin exact versions. No system package
  installs: ffmpeg comes from `@ffmpeg-installer`, pulled in by `@revideo/ffmpeg`.
- **Where deliverables go.** A shared marketing folder, separate from the build project.
- **Delivery metadata.** Ask for the title, the company's legal name as it should
  appear publicly (for example "Example, Inc."), the copyright line, a one-line
  description and a public URL. These go in `metadata.ts`. Don't guess the legal
  name from the brand name.

## Hard rules

- **No non-public data on screen, ever.** If clean footage is impossible without it,
  stop and ask; don't blur and hope. Every capture run ends with an on-screen text
  audit (`SENSITIVE` / `CLEARED` in `capture/config.ts`), and a leak fails the run.
- **Read-only.**
  - `capture/guard.ts` aborts every non-GET request by default and logs each decision.
  - Add a POST to `READ_ONLY_POSTS` only after reading the server code behind it.
    Say so in the README.
  - Put known save-on-click endpoints in `ALWAYS_BLOCK`.
  - Never click a control that persists (Done, Save, range tabs that save, pin,
    share), even with the guard on: the UI can show a fake success.
- **Account hard stop.** Every script checks `onClearedAccount()` before frame one.
  An expired session lands on the login page, so fail loudly; never film it.
- **The owner logs in, not the agent.** `npm run login` opens a headed browser; the
  owner signs in and closes it. Never type or store credentials.
  - Close that login process when the owner closes the window.
  - A login window left running past token expiry overwrote a good session and
    looped on new tabs. The template only saves while on the cleared account.
- **Staged data stays in the browser.** For example, rewrite a GET response with
  `route.fulfill` to show a demo state. Disclose it in SCRIPT.md, and never write
  it to the app.
- **Writing style:** no em dashes in captions, VO or docs. Match the owner's spelling
  locale.

## Workflow

1. **Scaffold.** Copy `template/` to the project folder and run `npm install` and
   `npx playwright install chromium`.
   - Fill in `capture/config.ts`, `src/brand.ts` and `metadata.ts`.
   - Add the brand's logo PNGs and font to `public/brand/`. Sample colors from the
     official logo artwork.
2. **Session.** Run `npm run login` in the background and ask the owner to log in,
   switch to the demo account, then close the window.
3. **Explore before filming.** Write a throwaway `capture/explore-*.ts`:
   - Take screenshots and dump `innerText` of each view you plan to use.
   - Log every non-GET the guard sees while you click through it.
   - Look at the screenshots yourself. This is where you find empty widgets, error
     states ("Couldn't load"), odd data and controls that would save.
   - Report data-quality issues to the owner instead of filming around them silently.
4. **Shot list.** Pick 6-10 beats of 3-5 s each. Each beat gets:
   - a capture: a clip for motion (scroll, map fly-to, opening a picker), or a 4K
     still for a punch-in;
   - a 2-6 word caption;
   - a VO line.
   Pull stills from the clip frames (`raw/frames/<shot>/NNNNN.png`), not separate
   screenshots, so they match the clips exactly.
5. **Capture.** Run `npm run capture` (`SHOTS=a,b` for a subset). Record generous
   holds, because the edit can trim but not extend. Check each clip with a contact
   sheet (see references/edit.md).
6. **Edit.** Write `src/timeline.ts`, then render with `npm run stills` and review the
   contact sheets. Look for captions covering content, framings past the page edge,
   cropped titles, and caption length versus shot length.
7. **Script.** Run `npm run script` to print the shot table and VO cues with real start
   times, and paste them into `SCRIPT.md`.
   - Keep the VO at or under about 2.6 words per second of picture. The tool flags
     lines that won't fit.
   - Note the VO line that differs per version.
8. **Deliver.** Copy the MP4s, SCRIPT.md and 1080p previews of each clip to the
   deliverables folder. Confirm durations with ffprobe. Remove superseded renders you
   made, so nobody posts an old cut.
   - Every final MP4 carries only the tags in `metadata.ts`. The render strips the
     encoder tag and the x264 settings block, converts to BT.709 and tags it, writes the
     index first (faststart), and fails if `verifyDelivery()` finds a tool string or a
     local path. After changing `metadata.ts`, run `npm run encode` to re-encode from
     the existing masters; no re-render is needed.
   - **The owner's voiceover export is a new deliverable.** Editors (iMovie, CapCut,
     Premiere) write their own title, keywords, a thumbnail image and tool tags. Run
     `npm run finalize -- <export.mp4> <name>_final.mp4 [variant]`. It stream-copies
     with the same metadata, never overwrites, and reports loudness (target about
     -14 LUFS integrated, true peak at or below -1 dBTP; fix it in the editor).
   - Contact-sheet that export too (references/edit.md), not just your render. The
     owner's edit can pull in other footage. One edit carried a customer account and
     a desktop file picker this way, in its embedded thumbnail as well as on screen.
9. **Report.** List each change against what was asked, the new files, anything
   written to the app (it should be nothing) and every guard exception you added.
   Flag data that looks wrong on camera.

## Revisions (the common loop)

- **Caption, VO or end-card text:** edit `timeline.ts` only, re-render, then
  regenerate SCRIPT.md.
- **New beat:** if a still covers it, add a shot with a framing. Otherwise add a
  capture shot and record just that one with `SHOTS=name`. Rebalance durations to
  hold the length cap; trim shots, don't speed up the VO.
- **App data changed** (the owner pinned items, added searches): re-capture
  everything that shows it. Then re-check every punch-in framing. Content
  above it may have grown, which shifts page coordinates. Diff a still before and
  after.
- **New version:** add a render variable and a badge string. Don't fork the project.

## Marketing screenshots

Use the same session, guard and audit. For each device size (laptop 1440x900, iPad
landscape 1180x820, iPad portrait 820x1180 at 2x), take one screenshot per screenful.
Add element crops of the best widgets: scroll each into view, then clip its bounding
box plus a margin for the card shadow. Collapse side navigation on tablet sizes.
Screenshot dialogs (detail views, heat maps) only if opening them is read-only.
