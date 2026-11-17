/** @jsxImportSource @revideo/2d/lib */
import { Img, Layout, Node, Rect, Txt, Video, blur, makeScene2D } from '@revideo/2d';
import {
  all,
  createRef,
  createSignal,
  delay,
  easeInCubic,
  easeInOutCubic,
  easeOutBack,
  easeOutCubic,
  linear,
  sequence,
  useScene,
  waitFor,
  type ThreadGenerator,
} from '@revideo/core';
import { ACCENT, FONT, H, LOGO_BLUE, LOGO_ICON, LOGO_LIGHT, NAVY, SLASH_GRAY, W, WHITE } from '../brand';
import { INTRO, OUTRO, SHOTS } from '../timeline';
import type { Cam, Shot } from '../types';

// Revideo's shared-asset folder is public/ (served at /).
const logoLight = LOGO_LIGHT;
const iconSrc = LOGO_ICON;

const TRANSITION = 0.32; // seconds of overlap between shots

/** Keeps a framing inside the page, so no edge of the capture ever shows. */
function clampCam(c: Cam): Cam {
  const w = Math.min(c.w, W);
  const h = (w * H) / W;
  return {
    w,
    x: Math.min(Math.max(c.x, w / 2), W - w / 2),
    y: Math.min(Math.max(c.y, h / 2), H - h / 2),
  };
}

/** Position/scale of the page layer so that `cam` fills the 1920x1080 frame. */
function camScale(cam: Cam) {
  return W / clampCam(cam).w;
}
function camPos(cam: Cam) {
  const c = clampCam(cam);
  const s = camScale(c);
  return { x: -(c.x - W / 2) * s, y: -(c.y - H / 2) * s };
}

/** Splits "Every *page* at once" into words, marking the starred one. A multi-word accent stars each word: "in *real* *time*". */
function words(caption: string) {
  return caption.split(/\s+/).map((w) => ({ text: w.replace(/\*/g, ''), accent: /^\*.*\*$/.test(w) }));
}

function* captionIn(root: Layout, pos: 'top' | 'bottom', dur: number, caption: string): ThreadGenerator {
  const ws = words(caption);
  const pill = createRef<Rect>();
  const bar = createRef<Rect>();
  const wordRefs = ws.map(() => createRef<Txt>());
  const y = pos === 'top' ? -H / 2 + 120 : H / 2 - 130;
  root.add(
    <Rect ref={pill} y={y} layout direction={'column'} alignItems={'center'} gap={14} opacity={0}>
      <Rect
        layout
        gap={22}
        paddingLeft={44}
        paddingRight={44}
        paddingTop={22}
        paddingBottom={26}
        radius={18}
        fill={NAVY}
        shadowColor={'rgba(0,0,44,0.35)'}
        shadowBlur={40}
        shadowOffsetY={10}
      >
        {ws.map((w, i) => (
          <Txt
            ref={wordRefs[i]}
            text={w.text}
            fontFamily={FONT}
            fontWeight={800}
            fontSize={68}
            letterSpacing={-1}
            fill={w.accent ? ACCENT : WHITE}
            opacity={0}
            scale={0.6}
          />
        ))}
      </Rect>
      <Rect ref={bar} width={0} height={8} radius={4} fill={ACCENT} />
    </Rect>,
  );
  pill().opacity(1);
  yield* all(
    sequence(0.07, ...wordRefs.map((r) => all(r().opacity(1, 0.18), r().scale(1, 0.32, easeOutBack)))),
    delay(0.15, bar().width(160, 0.35, easeOutCubic)),
  );
  const hold = Math.max(0.2, dur - 0.07 * ws.length - 0.32 - 0.35);
  yield* waitFor(hold);
  yield* all(pill().opacity(0, 0.2), pill().y(y + (pos === 'top' ? -30 : 30), 0.2, easeInCubic));
  pill().remove();
}

function* playShot(stage: Node, shot: Shot, isFirst: boolean): ThreadGenerator {
  const holder = createRef<Rect>();
  const page = createRef<Node>();
  const fx = createRef<Layout>();
  const blurAmt = createSignal(0);
  const start = camPos(shot.from);
  const isClip = shot.src.endsWith('.mp4');
  const media = isClip ? (
    <Video src={`/footage/${shot.src}`} width={W} height={H} time={shot.clipStart ?? 0} playbackRate={shot.rate ?? 1} play decoder={'web'} />
  ) : (
    <Img src={`/footage/${shot.src}`} width={W} height={H} smoothing />
  );
  stage.add(
    <Rect ref={holder} width={W} height={H} clip fill={'#f5f8fc'} filters={[blur(blurAmt)]}>
      <Node ref={page} scale={camScale(shot.from)} position={[start.x, start.y]}>
        {media}
        {shot.ring && (
          <Rect
            x={shot.ring.x + shot.ring.w / 2 - W / 2}
            y={shot.ring.y + shot.ring.h / 2 - H / 2}
            width={shot.ring.w}
            height={shot.ring.h}
            radius={14}
            lineWidth={6}
            stroke={ACCENT}
            opacity={0}
            scale={1.15}
            shadowColor={ACCENT}
            shadowBlur={24}
          />
        )}
      </Node>
      <Layout ref={fx} width={W} height={H} />
    </Rect>,
  );

  // Entrance.
  const enter = isFirst ? 'zoom' : (shot.enter ?? 'zoom');
  if (enter === 'zoom') {
    holder().opacity(0).scale(1.06);
    blurAmt(10);
  } else if (enter === 'whip') {
    holder().x(W * 0.9);
    blurAmt(24);
  }

  const end = camPos(shot.to);
  const ring = page().children().find((n) => n instanceof Rect) as Rect | undefined;
  yield* all(
    // camera move over the whole shot
    page().scale(camScale(shot.to), shot.dur, easeInOutCubic),
    page().position([end.x, end.y], shot.dur, easeInOutCubic),
    // entrance
    enter === 'zoom'
      ? all(holder().opacity(1, TRANSITION, easeOutCubic), holder().scale(1, TRANSITION + 0.1, easeOutCubic), blurAmt(0, TRANSITION))
      : enter === 'whip'
        ? all(holder().x(0, TRANSITION, easeOutCubic), blurAmt(0, TRANSITION + 0.05, easeOutCubic))
        : waitFor(0),
    // caption
    shot.caption ? delay(0.2, captionIn(fx(), shot.captionPos ?? 'bottom', shot.dur - 0.45, shot.caption)) : waitFor(0),
    // highlight ring
    ring && shot.ring
      ? delay(shot.ring.at, all(ring.opacity(1, 0.25), ring.scale(1, 0.4, easeOutBack)))
      : waitFor(0),
  );
  // stay visible underneath while the next shot enters, then free it
  yield* waitFor(TRANSITION + 0.05);
  holder().remove();
}

function* logoOpen(stage: Node): ThreadGenerator {
  const bg = createRef<Rect>();
  const icon = createRef<Img>();
  const mark = createRef<Img>();
  const sub = createRef<Txt>();
  const wipe = createRef<Rect>();
  stage.add(
    <Rect ref={bg} width={W} height={H} fill={NAVY}>
      <Img ref={icon} src={iconSrc} height={230} x={0} opacity={0} rotation={-12} scale={0.4} />
      <Img ref={mark} src={logoLight} width={820} x={70} opacity={0} />
      <Txt
        ref={sub}
        text={INTRO.subtitle}
        fontFamily={FONT}
        fontWeight={700}
        fontSize={46}
        letterSpacing={6}
        fill={ACCENT}
        y={150}
        opacity={0}
      />
      <Rect ref={wipe} width={W * 1.5} height={H * 1.6} fill={LOGO_BLUE} rotation={-45} x={-W * 1.6} />
    </Rect>,
  );
  yield* all(icon().opacity(1, 0.25), icon().scale(1, 0.45, easeOutBack), icon().rotation(0, 0.45, easeOutCubic));
  yield* all(
    icon().x(-470, 0.45, easeInOutCubic),
    icon().opacity(0, 0.45),
    mark().opacity(1, 0.4),
    mark().x(0, 0.5, easeOutCubic),
  );
  yield* all(sub().opacity(1, 0.3), sub().y(130, 0.35, easeOutCubic));
  yield* waitFor(INTRO.hold);
  // diagonal brand wipe into the first shot
  yield* wipe().x(0, 0.28, easeInCubic);
  bg().fill(LOGO_BLUE);
  icon().remove();
  mark().remove();
  sub().remove();
  yield* all(bg().opacity(0, 0.25), wipe().x(W * 1.6, 0.3, easeOutCubic));
  bg().remove();
}

function* endCard(stage: Node, badgeText: string): ThreadGenerator {
  const bg = createRef<Rect>();
  const mark = createRef<Img>();
  const line1 = createRef<Txt>();
  const line2 = createRef<Txt>();
  const badge = createRef<Rect>();
  const slashA = createRef<Rect>();
  const slashB = createRef<Rect>();
  stage.add(
    <Rect ref={bg} width={W} height={H} fill={NAVY} opacity={0}>
      <Rect ref={slashA} width={1400} height={70} radius={35} fill={SLASH_GRAY} opacity={0.12} rotation={-45} x={-1400} y={-120} />
      <Rect ref={slashB} width={900} height={70} radius={35} fill={LOGO_BLUE} opacity={0.22} rotation={-45} x={1400} y={160} />
      <Txt ref={line1} text={OUTRO.headline} fontFamily={FONT} fontWeight={800} fontSize={96} letterSpacing={-2} fill={WHITE} y={-120} opacity={0} />
      <Img ref={mark} src={logoLight} width={640} y={70} opacity={0} scale={0.9} />
      <Txt ref={line2} text={OUTRO.tagline} fontFamily={FONT} fontWeight={600} fontSize={40} fill={ACCENT} y={230} opacity={0} />
      <Rect ref={badge} layout y={330} paddingLeft={34} paddingRight={34} paddingTop={14} paddingBottom={14} radius={40} fill={ACCENT} opacity={0} scale={0.8}>
        <Txt text={badgeText} fontFamily={FONT} fontWeight={800} fontSize={34} letterSpacing={5} fill={WHITE} />
      </Rect>
    </Rect>,
  );
  yield* all(
    bg().opacity(1, 0.3),
    slashA().x(-500, 0.8, easeOutCubic),
    slashB().x(560, 0.8, easeOutCubic),
    delay(0.15, all(line1().opacity(1, 0.3), line1().y(-150, 0.4, easeOutCubic))),
    delay(0.35, all(mark().opacity(1, 0.3), mark().scale(1, 0.45, easeOutBack))),
    delay(0.6, all(line2().opacity(1, 0.3), line2().y(220, 0.35, easeOutCubic))),
    delay(0.85, all(badge().opacity(1, 0.25), badge().scale(1, 0.4, easeOutBack))),
  );
  yield* all(slashA().x(-430, OUTRO.hold, linear), slashB().x(500, OUTRO.hold, linear));
}

export default makeScene2D('teaser', function* (view) {
  view.fill(NAVY);
  // End card variant, set by render.ts (VARIANTS=available|soon).
  const variant = useScene().variables.get('variant', 'available')();
  const badgeText = variant === 'soon' ? OUTRO.badge.soon : OUTRO.badge.available;
  const stage = createRef<Node>();
  view.add(<Node ref={stage} />);

  yield* logoOpen(stage());

  // Shots overlap by TRANSITION so each one enters over the tail of the last.
  const threads: ThreadGenerator[] = [];
  let offset = 0;
  SHOTS.forEach((shot, i) => {
    threads.push(delay(offset, playShot(stage(), shot, i === 0)));
    offset += shot.dur - TRANSITION;
  });
  // end card starts as the last shot is finishing
  threads.push(delay(offset, endCard(stage(), badgeText)));
  yield* all(...threads);
});
