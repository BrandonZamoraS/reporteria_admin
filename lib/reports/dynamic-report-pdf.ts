import PDFDocument from "pdfkit";
import sharp from "sharp";
import { MAX_DYNAMIC_REPORT_PHOTOS } from "@/lib/reports/dynamic-report-types";
import {
  fitFontSizeToHeight,
  resolveDynamicReportName,
} from "@/lib/reports/dynamic-report-layout";

/* ── Brand colors (matching export/route.ts) ─────────────── */
const BRAND = {
  primary: "#0d3233",
  muted: "#5A7984",
  headerBg: "#0d3233",
  headerText: "#ffffff",
  accent: "#DDE2DD",
  text: "#1F2933",
  border: "#b3b5b3",
} as const;

/* ── Types ────────────────────────────────────────────────── */
export type DynamicReportSectionInput = {
  establishmentId: number;
  establishmentName: string;
  description: string;
  /** JPEG photo buffers (already compressed client-side) */
  photoBuffers: Buffer[];
};

export type DynamicReportPdfOptions = {
  title: string;
  companyName: string;
  description: string;
  generatedAt: string;
  sections: DynamicReportSectionInput[];
};

/* ── PDF buffer collection ────────────────────────────────── */
function collectPdf(doc: PDFKit.PDFDocument): Promise<Buffer> {
  const chunks: Buffer[] = [];
  return new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk) => chunks.push(chunk as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}

/* ── PDF helpers ──────────────────────────────────────────── */
function drawText(
  doc: PDFKit.PDFDocument,
  str: string,
  x: number,
  y: number,
  opts: {
    font?: string;
    size?: number;
    color?: string;
    width?: number;
    align?: "left" | "center" | "right";
    lineBreak?: boolean;
    height?: number;
    ellipsis?: boolean;
  } = {}
) {
  doc.save();
  doc
    .font(opts.font ?? "Helvetica")
    .fontSize(opts.size ?? 9)
    .fillColor(opts.color ?? BRAND.text);
  doc.text(str, x, y, {
    width: opts.width,
    align: opts.align ?? "left",
    lineBreak: opts.lineBreak ?? true,
    height: opts.height,
    ellipsis: opts.ellipsis ?? false,
  });
  doc.restore();
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function measureTextHeight(
  doc: PDFKit.PDFDocument,
  text: string,
  font: string,
  fontSize: number,
  width: number
): number {
  doc.save();
  doc.font(font).fontSize(fontSize);
  const height = doc.heightOfString(text, { width, lineGap: 1.2 });
  doc.restore();
  return height;
}

function drawAdaptiveTextCard(
  doc: PDFKit.PDFDocument,
  options: {
    x: number;
    y: number;
    width: number;
    maxHeight: number;
    minHeight?: number;
    padding?: number;
    backgroundColor: string;
    textColor: string;
    text: string;
    font?: string;
    baseFontSize: number;
    minFontSize?: number;
  }
): number {
  const padding = options.padding ?? 16;
  const minHeight = options.minHeight ?? 48;
  const font = options.font ?? "Helvetica";
  const contentWidth = options.width - padding * 2;
  const maxTextHeight = Math.max(1, options.maxHeight - padding * 2);
  const fit = fitFontSizeToHeight({
    text: options.text,
    baseFontSize: options.baseFontSize,
    minFontSize: options.minFontSize,
    maxHeight: maxTextHeight,
    measureHeight: (fontSize) => measureTextHeight(doc, options.text, font, fontSize, contentWidth),
  });
  const contentHeight = clamp(fit.textHeight, 1, maxTextHeight);
  const boxHeight = clamp(contentHeight + padding * 2, minHeight, options.maxHeight);

  doc.roundedRect(options.x, options.y, options.width, boxHeight, 12).fill(options.backgroundColor);
  drawText(doc, options.text, options.x + padding, options.y + padding, {
    font,
    size: fit.fontSize,
    color: options.textColor,
    width: contentWidth,
    height: boxHeight - padding * 2,
    ellipsis: !fit.fits,
  });

  return boxHeight;
}

/* ── Cover page ───────────────────────────────────────────── */
function drawCover(doc: PDFKit.PDFDocument, options: DynamicReportPdfOptions) {
  const left = doc.page.margins.left;
  const top = doc.page.margins.top;
  const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const usableHeight = doc.page.height - doc.page.margins.top - doc.page.margins.bottom;
  const reportName = resolveDynamicReportName(options.title);

  // Background
  doc.roundedRect(left, top, usableWidth, usableHeight, 22).fill("#F4F7F4");

  // Header banner
  doc.roundedRect(left + 24, top + 24, usableWidth - 48, 104, 20).fill(BRAND.headerBg);

  const titleWidth = usableWidth - 96;
  const titleFit = fitFontSizeToHeight({
    text: reportName,
    baseFontSize: 28,
    minFontSize: 18,
    maxHeight: 58,
    measureHeight: (fontSize) => measureTextHeight(doc, reportName, "Helvetica-Bold", fontSize, titleWidth),
  });
  drawText(doc, reportName, left + 48, top + 44, {
    font: "Helvetica-Bold",
    size: titleFit.fontSize,
    color: BRAND.headerText,
    width: titleWidth,
    height: 58,
    ellipsis: !titleFit.fits,
  });

  // Stats cards
  const statY = top + 148;
  const statWidth = (usableWidth - 36) / 2;
  const totalPhotos = options.sections.reduce(
    (sum, section) => sum + section.photoBuffers.length,
    0
  );

  const stats = [
    { label: "Empresa", value: options.companyName || "Sin empresa" },
    { label: "Establecimientos", value: String(options.sections.length) },
    { label: "Fotos", value: String(totalPhotos) },
    { label: "Generado", value: options.generatedAt },
  ];

  stats.forEach((stat, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = left + 24 + column * (statWidth + 12);
    const y = statY + row * 108;

    doc.roundedRect(x, y, statWidth, 84, 16).fill("#FFFFFF");
    drawText(doc, stat.label, x + 18, y + 16, {
      font: "Helvetica-Bold",
      size: 10,
      color: BRAND.muted,
      width: statWidth - 36,
    });
    drawText(doc, stat.value, x + 18, y + 38, {
      font: "Helvetica-Bold",
      size: 16,
      color: BRAND.text,
      width: statWidth - 36,
    });
  });

  const descriptionText = options.description.trim() || "Sin descripción";
  const descriptionY = statY + 216;
  const descriptionMaxHeight = Math.max(84, usableHeight - (descriptionY - top) - 12);
  const descriptionWidth = usableWidth - 48;
  const descriptionBodyMaxHeight = Math.max(1, descriptionMaxHeight - 58);
  const descriptionBodyFit = fitFontSizeToHeight({
    text: descriptionText,
    baseFontSize: 10,
    minFontSize: 8,
    maxHeight: descriptionBodyMaxHeight,
    measureHeight: (fontSize) =>
      measureTextHeight(doc, descriptionText, "Helvetica", fontSize, descriptionWidth - 36),
  });
  const descriptionBoxHeight = clamp(descriptionBodyFit.textHeight + 58, 84, descriptionMaxHeight);

  doc.roundedRect(left + 24, descriptionY, descriptionWidth, descriptionBoxHeight, 16).fill("#FFFFFF");
  drawText(doc, "Descripción del reporte", left + 42, descriptionY + 16, {
    font: "Helvetica-Bold",
    size: 10,
    color: BRAND.muted,
    width: descriptionWidth - 36,
  });
  drawText(doc, descriptionText, left + 42, descriptionY + 36, {
    font: "Helvetica",
    size: descriptionBodyFit.fontSize,
    color: BRAND.text,
    width: descriptionWidth - 36,
    height: descriptionBoxHeight - 52,
    ellipsis: !descriptionBodyFit.fits,
  });
}

/* ── Photo grid resolution ────────────────────────────────── */
function resolveGrid(photoCount: number) {
  if (photoCount <= 1) return { columns: 1, rows: 1 };
  if (photoCount === 2) return { columns: 2, rows: 1 };
  if (photoCount <= 4) return { columns: 2, rows: 2 };
  return { columns: 3, rows: 2 };
}

/* ── Process photo buffer with sharp ──────────────────────── */
async function processPhotoBuffer(buffer: Buffer): Promise<Buffer | null> {
  try {
    return await sharp(buffer)
      .rotate()
      .resize({ width: 800, withoutEnlargement: true })
      .jpeg({ quality: 60, mozjpeg: true })
      .toBuffer();
  } catch {
    return null;
  }
}

/* ── Draw a single store page ─────────────────────────────── */
async function drawStorePage(
  doc: PDFKit.PDFDocument,
  section: DynamicReportSectionInput,
  pageIndex: number,
  totalPages: number,
  title: string
) {
  const left = doc.page.margins.left;
  const top = doc.page.margins.top;
  const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const usableHeight = doc.page.height - doc.page.margins.top - doc.page.margins.bottom;

  // Page header
  const headerHeight = 48;
  doc.roundedRect(left, top, usableWidth, headerHeight, 12).fill(BRAND.headerBg);
  drawText(doc, title, left + 16, top + 10, {
    font: "Helvetica-Bold",
    size: 16,
    color: BRAND.headerText,
    width: usableWidth - 140,
  });
  drawText(doc, section.establishmentName, left + 16, top + 30, {
    font: "Helvetica-Bold",
    size: 10,
    color: BRAND.accent,
    width: usableWidth - 140,
  });
  drawText(
    doc,
    `Establecimiento ${pageIndex} de ${totalPages}`,
    left + usableWidth - 120,
    top + 16,
    { font: "Helvetica-Bold", size: 9, color: BRAND.accent, align: "right", width: 108 }
  );

  const contentTop = top + headerHeight + 14;
  const remainingHeight = usableHeight - headerHeight - 14;

  // Description
  let cursorY = contentTop;
  if (section.description.trim()) {
    const descHeightMax = Math.min(132, Math.max(56, remainingHeight * 0.3));
    const descHeight = drawAdaptiveTextCard(doc, {
      x: left,
      y: cursorY,
      width: usableWidth,
      maxHeight: descHeightMax,
      minHeight: 56,
      padding: 12,
      backgroundColor: "#E8EFEA",
      textColor: BRAND.text,
      text: section.description.trim(),
      font: "Helvetica",
      baseFontSize: 9,
      minFontSize: 8,
    });
    cursorY += descHeight + 10;
  }

  // Photo grid
  const photoCount = Math.min(section.photoBuffers.length, MAX_DYNAMIC_REPORT_PHOTOS);
  if (photoCount === 0) {
    drawText(doc, "Sin fotos para este establecimiento.", left + 24, cursorY + 40, {
      font: "Helvetica-Bold",
      size: 14,
      color: BRAND.muted,
      align: "center",
      width: usableWidth - 48,
    });
    return;
  }

  const grid = resolveGrid(photoCount);
  const gridAreaTop = cursorY;
  const gridAreaHeight = remainingHeight - (cursorY - contentTop);
  const gap = 8;
  const slotWidth = (usableWidth - gap * (grid.columns - 1)) / grid.columns;
  const slotHeight = (gridAreaHeight - gap * (grid.rows - 1)) / grid.rows;

  // Process all photo buffers
  const processedBuffers = await Promise.all(
    section.photoBuffers.slice(0, MAX_DYNAMIC_REPORT_PHOTOS).map(processPhotoBuffer)
  );

  // Draw each photo in its grid cell
  for (let i = 0; i < photoCount; i++) {
    const column = i % grid.columns;
    const row = Math.floor(i / grid.columns);
    const x = left + column * (slotWidth + gap);
    const y = gridAreaTop + row * (slotHeight + gap);

    // Cell background
    doc.roundedRect(x, y, slotWidth, slotHeight, 8).fill("#EEF2EE");

    const buffer = processedBuffers[i];
    if (buffer) {
      doc.image(buffer, x, y, {
        fit: [slotWidth, slotHeight],
        align: "center",
        valign: "center",
      });
    } else {
      drawText(doc, "No se pudo procesar la imagen", x + 12, y + slotHeight / 2 - 8, {
        font: "Helvetica-Bold",
        size: 10,
        color: BRAND.muted,
        align: "center",
        width: slotWidth - 24,
      });
    }
  }
}

/* ── Footer ────────────────────────────────────────────────── */
function drawFooter(doc: PDFKit.PDFDocument, reportName: string) {
  const range = doc.bufferedPageRange();
  const totalPages = range.count;
  for (let i = 0; i < totalPages; i++) {
    doc.switchToPage(i);
    const bottom = doc.page.height - 20;
    const footerText = `${reportName}  -  Pagina ${i + 1} de ${totalPages}  -  Reporteria`;
    drawText(
      doc,
      footerText,
      doc.page.margins.left,
      bottom,
      {
        font: "Helvetica",
        size: 7,
        color: BRAND.muted,
        width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
        height: 8,
        align: "center",
        lineBreak: false,
        ellipsis: true,
      }
    );
  }
}

/* ── Main entry point ─────────────────────────────────────── */
export async function buildDynamicReportPdf(
  options: DynamicReportPdfOptions
): Promise<Buffer> {
  const reportName = resolveDynamicReportName(options.title);
  const doc = new PDFDocument({
    size: "A4",
    layout: "landscape",
    margins: { top: 26, right: 30, bottom: 30, left: 30 },
    compress: true,
    bufferPages: true,
    info: { Title: reportName, Creator: "Reporteria" },
  });

  const bufferPromise = collectPdf(doc);

  // Cover page
  drawCover(doc, options);

  // Store pages
  const storePages = options.sections;
  for (let i = 0; i < storePages.length; i++) {
    doc.addPage();
    await drawStorePage(doc, storePages[i], i + 1, storePages.length, reportName);
  }

  // Footer
  drawFooter(doc, reportName);

  doc.end();
  return bufferPromise;
}
