import path from 'node:path';
import sharp from 'sharp';
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  PageBreak,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx';
import { config } from '../config.js';

/** One picture in a section — `path` is relative to PHOTOS_DIR. */
export interface DocumentPhoto {
  path: string;
  caption: string;
}

export interface DocumentSection {
  heading: string;
  text: string;
  /** Pictures per row: 1 = large, one under another. */
  columns: 1 | 2 | 3;
  photos: DocumentPhoto[];
}

export interface DocumentContent {
  /** Optional big picture right under the title, on its own cover page. */
  cover?: DocumentPhoto | null;
  sections: DocumentSection[];
}

// Letter paper with 1" margins leaves 6.5" x 9" of content; docx sizes images in pixels at 96/inch.
const CONTENT_WIDTH_PX = 624;
const MAX_IMAGE_HEIGHT_PX = 560; // leaves room on the page for a caption and the section text
const CELL_GAP_PX = 12;
// Plenty for print at these sizes, while keeping a document with dozens of photos a sane size.
const EMBED_MAX_PX = 1600;
const PREP_CONCURRENCY = 2;

interface PreparedImage {
  data: Buffer;
  width: number;
  height: number;
}

/** Reads a photo, turns it upright (EXIF orientation), and shrinks it for embedding. Null if it's
 *  gone or unreadable — it's simply left out of the document. Read-only against the original. */
async function prepareImage(relativePath: string): Promise<PreparedImage | null> {
  const absolute = path.resolve(config.photosDir, relativePath);
  if (!absolute.startsWith(path.resolve(config.photosDir) + path.sep)) return null;
  try {
    const { data, info } = await sharp(absolute)
      .rotate()
      .resize({ width: EMBED_MAX_PX, height: EMBED_MAX_PX, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height };
  } catch (err) {
    console.warn(`[documents] skipping unreadable photo "${relativePath}":`, (err as Error).message);
    return null;
  }
}

/** Fits an image into a box, keeping its shape. */
function fit(img: PreparedImage, maxWidth: number, maxHeight: number): { width: number; height: number } {
  const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
  return { width: Math.round(img.width * scale), height: Math.round(img.height * scale) };
}

/** Blank lines separate paragraphs; a single line break stays a line break. keepNext holds the
 *  text on the same page as what follows it (the section's pictures), rather than stranding it at
 *  the bottom of a page. */
function textParagraphs(text: string): Paragraph[] {
  return text
    .split(/\n\s*\n/)
    .map((block) => block.replace(/\s+$/, ''))
    .filter((block) => block.trim())
    .map(
      (block) =>
        new Paragraph({
          spacing: { after: 160 },
          keepNext: true,
          children: block.split('\n').map((line, i) => new TextRun({ text: line, break: i > 0 ? 1 : 0 })),
        })
    );
}

function pictureParagraphs(img: PreparedImage, caption: string, maxWidth: number, maxHeight: number): Paragraph[] {
  const size = fit(img, maxWidth, maxHeight);
  const out = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 80, after: caption ? 40 : 160 },
      children: [new ImageRun({ type: 'jpg', data: img.data, transformation: size })],
    }),
  ];
  if (caption.trim()) {
    out.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: caption
          .trim()
          .split('\n')
          .map((line, i) => new TextRun({ text: line, italics: true, size: 20, color: '555555', break: i > 0 ? 1 : 0 })),
      })
    );
  }
  return out;
}

const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const NO_BORDERS = { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER };

/** 2 or 3 pictures per row, as a borderless table so they line up. */
function pictureGrid(items: Array<{ img: PreparedImage; caption: string }>, columns: 2 | 3): Table {
  const cellWidth = Math.floor((CONTENT_WIDTH_PX - CELL_GAP_PX * (columns - 1)) / columns);
  const maxHeight = columns === 2 ? 340 : 230;
  const rows: TableRow[] = [];
  for (let i = 0; i < items.length; i += columns) {
    const chunk = items.slice(i, i + columns);
    rows.push(
      new TableRow({
        cantSplit: true,
        children: Array.from({ length: columns }, (_, c) => {
          const item = chunk[c];
          return new TableCell({
            width: { size: Math.round(100 / columns), type: WidthType.PERCENTAGE },
            borders: NO_BORDERS,
            verticalAlign: VerticalAlign.TOP,
            children: item ? pictureParagraphs(item.img, item.caption, cellWidth - 8, maxHeight) : [new Paragraph('')],
          });
        }),
      })
    );
  }
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: { ...NO_BORDERS, insideHorizontal: NO_BORDER, insideVertical: NO_BORDER },
    rows,
  });
}

/**
 * Builds the .docx: the title (with who made it and when), then each section's heading, text, and
 * pictures with their captions. Photos are read fresh from PHOTOS_DIR each time (never modified);
 * any no longer there are skipped.
 */
export async function buildPhotoDocument(params: {
  title: string;
  byline: string | null;
  content: DocumentContent;
}): Promise<Buffer> {
  // Prepare every picture first (a couple at a time — full-size originals are big on a Pi).
  const cover = params.content.cover ?? null;
  const allPhotos = [...(cover ? [cover] : []), ...params.content.sections.flatMap((s) => s.photos)];
  const prepared = new Array<PreparedImage | null>(allPhotos.length);
  let next = 0;
  async function worker() {
    while (next < allPhotos.length) {
      const i = next++;
      prepared[i] = await prepareImage(allPhotos[i].path);
    }
  }
  await Promise.all(Array.from({ length: Math.min(PREP_CONCURRENCY, allPhotos.length) }, worker));

  const children: Array<Paragraph | Table> = [
    new Paragraph({ heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, children: [new TextRun(params.title)] }),
  ];
  if (params.byline) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
        children: [new TextRun({ text: params.byline, color: '666666' })],
      })
    );
  }

  let photoIndex = 0;
  if (cover) {
    const img = prepared[photoIndex++];
    if (img) {
      children.push(...pictureParagraphs(img, cover.caption, CONTENT_WIDTH_PX, 680));
      // The cover gets its own page; the sections start on the next one.
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }
  }
  for (const section of params.content.sections) {
    if (section.heading.trim()) {
      children.push(
        new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 360 }, keepNext: true, children: [new TextRun(section.heading.trim())] })
      );
    }
    children.push(...textParagraphs(section.text));
    const items: Array<{ img: PreparedImage; caption: string }> = [];
    for (const photo of section.photos) {
      const img = prepared[photoIndex++];
      if (img) items.push({ img, caption: photo.caption });
    }
    if (items.length === 0) continue;
    if (section.columns === 1) {
      for (const item of items) children.push(...pictureParagraphs(item.img, item.caption, CONTENT_WIDTH_PX, MAX_IMAGE_HEIGHT_PX));
    } else {
      children.push(pictureGrid(items, section.columns));
    }
  }

  const doc = new Document({
    title: params.title,
    creator: 'Family Home Center',
    sections: [
      {
        properties: {
          page: {
            size: { width: '8.5in', height: '11in' },
            margin: { top: '1in', bottom: '1in', left: '1in', right: '1in' },
          },
        },
        children,
      },
    ],
  });
  return Packer.toBuffer(doc);
}
