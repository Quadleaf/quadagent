// Delivery metadata: the ONLY tags a final MP4 carries. render.ts and tools/finalize.ts
// strip everything else (encoder and tool strings, x264 settings, editor titles and
// thumbnails, source tags) and write these instead.
// TODO: fill in every field with public-facing text. Rendering refuses while a TODO is left.

export interface VideoMetadata {
  title: string; // external product or feature name, never an internal codename
  artist: string; // the company's legal name as it should appear publicly, e.g. "Example, Inc."
  copyright: string; // e.g. "(c) 2026 Example, Inc."
  description?: string; // one-line tagline
  comment?: string; // public URL
  language?: string; // ISO 639-2 code for the tracks, e.g. "eng"
}

export const METADATA: VideoMetadata = {
  title: 'TODO product name',
  artist: 'TODO company legal name',
  copyright: 'TODO (c) <year> <company legal name>',
  description: 'TODO one-line tagline',
  comment: 'TODO https://public-site.example',
  language: 'eng',
};

// Per-version overrides, keyed by render variant (see VARIANT_FILES in render.ts).
// Leave empty when every version shares the same tags.
export const VARIANT_METADATA: Record<string, Partial<VideoMetadata>> = {};

export function metadataFor(variant?: string): VideoMetadata {
  return { ...METADATA, ...(variant ? VARIANT_METADATA[variant] : undefined) };
}
