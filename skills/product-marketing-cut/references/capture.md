# Capture technique and traps

## Frame-exact capture (why it works)

A screen recording drops frames whenever the machine stalls, and headless Chromium
cannot record smoothly at 4K anyway. Instead:

1. `page.clock.install()` **before** `goto`. Libraries such as Leaflet and chart
   tweens grab `requestAnimationFrame` and `Date` at load. Install later and they
   keep the real clock.
2. Navigate and settle in natural time: network idle, no skeletons or spinners,
   then a 1.5 s beat. Use the shot's `setup()` for navigation and opening views.
3. `page.clock.pauseAt(now + 200)`. pauseAt cannot move backwards, so aim a beat
   ahead.
4. For each frame: `clock.runFor(1000 / FPS)`, wait for visible images to finish
   loading, then screenshot.
5. Encode with the bundled ffmpeg: x264 crf 12 4K as the edit source, plus a 1080p
   preview.

Notes:

- **Resolution.** Use `deviceScaleFactor: 2` on a 1920x1080 viewport for 3840x2160
  frames. The edit can then punch in 2x (camera `w: 960`) and stay sharp.
- **CSS transitions run on real time**, not the page clock. A dialog fade still works,
  because it finishes within a frame or two of real time. Don't build a beat around a
  slow CSS animation.
- **Scrolling.** Apps often scroll an inner container, not the window. Find it (first
  element with `overflow-y: auto|scroll` and real overflow) and set `scrollTop` per
  frame with an ease. To center a target below a sticky header, measure the sticky
  elements inside the scroller.
- **Pointer.** Call `page.mouse.move(0, 0)` after every click so hover states and
  tooltips don't freeze on screen. Headless shows no cursor, so motion has to come
  from the UI itself or from the edit's camera.
- **Tooltips.** Chart tooltips usually need the pointer exactly on a point. A sweep
  rarely lands one, so push in with the camera instead.
- **Network assets.** Map tiles and lazy images arrive in real time. Hold each frame
  until visible `<img>` elements are complete, with a 4 s timeout so a dead tile
  can't hang the run.
- **Map fly-to shots.** Click the "show on map" control on the frozen clock, then hold.
  The animation plays at true speed in the output.
- **Slack.** Record about 1 s extra at both ends of every beat.

## Safety in practice

- **Guard first.** Install the route guard on the context before the page exists.
  - Log every BLOCK and ALLOW line to `raw/record/guard.log`, and read it after each run.
  - Analytics POSTs are blocked harmlessly.
  - A widget that shows "Couldn't load" in a screenshot usually means the guard
    blocked a read POST. Check the log, read the server code, and if it only reads,
    add it to `READ_ONLY_POSTS` with a comment naming the service you read.
- **Save-on-click controls.**
  - Range tabs on charts, "Done" in customize modes, pin buttons and drag-to-reorder
    can all persist.
  - Before clicking anything new, read the frontend handler. Entering an edit mode is
    often pure client state, while leaving it saves.
  - Assert in the recorder that the guard blocked no persist endpoint during the shot,
    and throw if it did.
- **Clean up.** Close the context while still in edit mode. Never click Done, Cancel
  or Reset to "clean up".
- **On-screen audit.** After each shot, scan `document.body.innerText` with the
  sensitive patterns. The `CLEARED` allow-list holds approved identifiers, and
  anything else fails the run. The audit sees text, not pixels, so also look at the
  contact sheets for names inside images or PDFs.
- **Staged state.** To show something the demo data lacks (an aircraft in flight, a
  live status), intercept the GET with `route.fulfill` and rewrite the JSON in the
  browser only. Keep an env switch to turn it off, and disclose it in SCRIPT.md.
- **Session expiry.** The symptom is that the account check throws, or the user state
  in localStorage is null. Ask the owner to run `npm run login` again; never script
  the login.
- **Database checks.** Before risky interactions, snapshot the relevant rows
  read-only (a layout table, for example) and compare afterwards. If the DB tool is
  down, the guard log is the fallback evidence.

## Marketing screenshots

- Use the same `openHome()`, session, guard and audit.
- Take device sizes at 2x.
- Take one screenshot per screenful, scrolling the inner container by its client height.
- For widget crops, use a tall viewport (1440x2400) so most widgets fit. Scroll each
  frame into view and clip its bounding box with about 16 px of margin for the shadow.
- Name files `<view>-<device>-<n>.png` and `widgets/<widget-slug>.png`.
