import PDFDocument from "pdfkit";
import sharp from "sharp";
import { MAX_DYNAMIC_REPORT_PHOTOS } from "@/lib/reports/dynamic-report-types";

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
  });
  doc.restore();
}

/* ── Cover page ───────────────────────────────────────────── */
function drawCover(doc: PDFKit.PDFDocument, options: DynamicReportPdfOptions) {
  const left = doc.page.margins.left;
  const top = doc.page.margins.top;
  const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const usableHeight = doc.page.height - doc.page.margins.top - doc.page.margins.bottom;

  // Background
  doc.roundedRect(left, top, usableWidth, usableHeight, 22).fill("#F4F7F4");

  // Header banner
  doc.roundedRect(left + 24, top + 24, usableWidth - 48, 120, 20).fill(BRAND.headerBg);

  drawText(doc, options.title, left + 48, top + 52, {
    font: "Helvetica-Bold",
    size: 28,
    color: BRAND.headerText,
    width: usableWidth - 96,
  });
  drawText(doc, "Reporte dinamico personalizado", left + 48, top + 92, {
    size: 13,
    color: BRAND.accent,
    width: usableWidth - 96,
  });

  // Stats cards
  const statY = top + 190;
  const statWidth = (usableWidth - 120) / 3;
  const totalPhotos = options.sections.reduce(
    (sum, section) => sum + section.photoBuffers.length,
    0
  );

  const stats = [
    { label: "Empresa", value: options.companyName || "Sin empresa" },
    { label: "Establecimientos", value: String(options.sections.length) },
    { label: "Fotos", value: String(totalPhotos) },
    { label: "Generado", value: options.generatedAt },
    { label: "Descripcion", value: options.description || "Sin descripcion" },
    { label: "", value: "" },
  ];

  stats.forEach((stat, index) => {
    if (!stat.label) return;
    const column = index % 3;
    const row = Math.floor(index / 3);
    const x = left + 24 + column * (statWidth + 36);
    const y = statY + row * 108;

    doc.roundedRect(x, y, statWidth, 88, 16).fill("#FFFFFF");
    drawText(doc, stat.label, x + 18, y + 16, {
      font: "Helvetica-Bold",
      size: 10,
      color: BRAND.muted,
      width: statWidth - 36,
    });
    drawText(doc, stat.value, x + 18, y + 38, {
      font: "Helvetica-Bold",
      size: stat.label === "Descripcion" ? 10 : 16,
      color: BRAND.text,
      width: statWidth - 36,
    });
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
    const descHeight = Math.min(40, remainingHeight * 0.1);
    doc.roundedRect(left, cursorY, usableWidth, descHeight, 8).fill("#E8EFEA");
    drawText(doc, section.description, left + 12, cursorY + 8, {
      font: "Helvetica",
      size: 9,
      color: BRAND.text,
      width: usableWidth - 24,
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
    drawText(
      doc,
      `${reportName}  -  Pagina ${i + 1} de ${totalPages}  -  Reporteria`,
      doc.page.margins.left,
      bottom,
      {
        font: "Helvetica",
        size: 7,
        color: BRAND.muted,
        width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
        align: "center",
      }
    );
  }
}

/* ── Main entry point ─────────────────────────────────────── */
export async function buildDynamicReportPdf(
  options: DynamicReportPdfOptions
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "A4",
    layout: "landscape",
    margins: { top: 26, right: 30, bottom: 30, left: 30 },
    compress: true,
    bufferPages: true,
    info: { Title: options.title, Creator: "Reporteria" },
  });

  const bufferPromise = collectPdf(doc);

  // Cover page
  drawCover(doc, options);

  // Store pages
  const storePages = options.sections;
  for (let i = 0; i < storePages.length; i++) {
    doc.addPage();
    await drawStorePage(doc, storePages[i], i + 1, storePages.length, options.title);
  }

  // Footer
  drawFooter(doc, options.title);

  doc.end();
  return bufferPromise;
}
