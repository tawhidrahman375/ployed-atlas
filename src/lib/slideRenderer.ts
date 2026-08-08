import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONTS_DIR = path.join(__dirname, '..', '..', 'assets', 'fonts');

const WIDTH = 1080;
const HEIGHT = 1920;

const fonts = [
  {
    name: 'Inter',
    data: readFileSync(path.join(FONTS_DIR, 'Inter-Regular.woff')),
    weight: 400 as const,
    style: 'normal' as const,
  },
  {
    name: 'Inter',
    data: readFileSync(path.join(FONTS_DIR, 'Inter-Bold.woff')),
    weight: 700 as const,
    style: 'normal' as const,
  },
];

export type SlideLayout = 'statement' | 'tool';

export interface SlideText {
  title: string;
  caption?: string;
}

// Matches the reference slideshow style: Inter, white text only, bold
// left-aligned titles, smaller regular-weight captions (max ~3 lines).
// 'statement' = hook/CTA slides — big title only, upper third, no caption.
// 'tool' = numbered tool / pain-point slides — title + caption, lower-middle.
function buildTree(layout: SlideLayout, text: SlideText) {
  const titleNode = {
    type: 'div',
    props: {
      style: {
        fontFamily: 'Inter',
        fontWeight: 700,
        color: 'white',
        fontSize: layout === 'statement' ? 76 : 64,
        lineHeight: 1.15,
        whiteSpace: 'pre-wrap',
      },
      children: text.title,
    },
  };

  const children: unknown[] = [titleNode];
  if (text.caption) {
    children.push({
      type: 'div',
      props: {
        style: {
          fontFamily: 'Inter',
          fontWeight: 400,
          color: 'white',
          fontSize: 42,
          lineHeight: 1.35,
          marginTop: 28,
          whiteSpace: 'pre-wrap',
        },
        children: text.caption,
      },
    });
  }

  return {
    type: 'div',
    props: {
      style: {
        width: WIDTH,
        height: HEIGHT,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: layout === 'statement' ? 'flex-start' : 'flex-end',
        paddingLeft: 72,
        paddingRight: 156,
        paddingTop: layout === 'statement' ? 220 : 0,
        paddingBottom: layout === 'statement' ? 0 : 620,
      },
      children,
    },
  };
}

function svgToPng(svg: string): Buffer {
  const resvg = new Resvg(svg, { background: 'rgba(0,0,0,0)' });
  return Buffer.from(resvg.render().asPng());
}

// Directional dark scrim so white text stays legible even over a brighter
// stock photo — heavier near the top for 'statement' slides (text sits high),
// heavier near the bottom for 'tool' slides (text sits low).
function scrim(layout: SlideLayout): Buffer {
  const stops =
    layout === 'statement'
      ? '<stop offset="0%" stop-color="black" stop-opacity="0.55"/><stop offset="42%" stop-color="black" stop-opacity="0"/>'
      : '<stop offset="38%" stop-color="black" stop-opacity="0"/><stop offset="100%" stop-color="black" stop-opacity="0.62"/>';
  const svg = `<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">${stops}</linearGradient></defs>
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#g)"/>
  </svg>`;
  return svgToPng(svg);
}

// Cover-crops the background to 1080x1920 (TikTok 9:16), layers a dark scrim
// for legibility, then composites the satori/resvg text layer on top.
export async function renderSlide(background: Buffer, layout: SlideLayout, text: SlideText): Promise<Buffer> {
  const base = await sharp(background)
    .resize(WIDTH, HEIGHT, { fit: 'cover', position: 'centre' })
    .png()
    .toBuffer();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svg = await satori(buildTree(layout, text) as any, { width: WIDTH, height: HEIGHT, fonts });
  const textLayer = svgToPng(svg);

  return sharp(base)
    .composite([{ input: scrim(layout) }, { input: textLayer }])
    .png()
    .toBuffer();
}
