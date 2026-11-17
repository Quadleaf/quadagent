import { makeProject } from '@revideo/core';
import teaser from './scenes/teaser';
import { FONT } from './brand';

// Register the brand typeface before the first frame. Inter is OFL-1.1; put the
// variable woff2 (or the brand's own licensed font) in public/brand/.
const font = new FontFace(FONT, 'url(/brand/font.woff2)', { weight: '100 900' });
document.fonts.add(font);
void font.load();

export default makeProject({
  name: 'product-teaser',
  scenes: [teaser],
  settings: {
    shared: { size: { x: 1920, y: 1080 }, background: '#00002c' },
    rendering: { fps: 30, exporter: { name: '@revideo/core/ffmpeg', options: { format: 'proRes' } } },
    preview: { fps: 30 },
  },
});
