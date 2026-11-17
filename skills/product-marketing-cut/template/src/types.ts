// A camera framing on the 1920x1080 page: the visible region is centered on
// (x, y) and is `w` page-pixels wide (height follows 16:9). w = 1920 is the full
// page; w = 960 is a 2x punch-in. Stills and clips are both captured at 2x device
// pixels (3840x2160), so they stay sharp up to w = 960.
export interface Cam {
  x: number;
  y: number;
  w: number;
}

export interface Shot {
  id: string;
  /** Seconds on screen, including the incoming transition. */
  dur: number;
  /** File under public/footage/ (png = still, mp4 = clip). */
  src: string;
  /** For clips: seconds into the clip where this shot starts. */
  clipStart?: number;
  /** For clips: playback speed (1 = real time). */
  rate?: number;
  /** Camera at the start and end of the shot (eased in-out). */
  from: Cam;
  to: Cam;
  /** Kinetic caption, 2-5 words. Wrap one word in *stars* to color it blue. */
  caption?: string;
  captionPos?: 'top' | 'bottom';
  /** How this shot enters. */
  enter?: 'zoom' | 'whip' | 'cut';
  /** Optional highlight ring on a page region (page px). */
  ring?: { x: number; y: number; w: number; h: number; at: number };
  /** Suggested voiceover for SCRIPT.md (not rendered). */
  vo: string;
  /** What is on screen, for SCRIPT.md. */
  note: string;
}
