# Product teaser (from the product-marketing-cut skill)

1. `npm install && npx playwright install chromium`
2. Fill in every TODO in `capture/config.ts`, `src/brand.ts`, `src/timeline.ts` and
   `render.ts`. Put the logo PNGs and the font (`font.woff2`) in `public/brand/`.
3. `npm run login`: the owner logs in to the cleared demo account and closes the window.
4. `npm run capture` (`SHOTS=a,b` for some): 4K clips into `public/footage/`. The run
   fails, and deletes the shot's footage, if the on-screen audit finds anything not
   cleared. Read `raw/record/guard.log` after every run.
5. `npm run stills`: renders `out/<name>-now-available.mp4` and `-coming-soon.mp4`
   (`VARIANTS=soon` for one) plus review stills in `stills/<variant>/`.
6. `npm run script`: shot table and VO cues for `SCRIPT.md`.

`npm run editor` opens the Revideo editor for live tweaking.
