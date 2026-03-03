import PDFDocument from "pdfkit";
import * as exifr from "exifr";
import sharp from "sharp";
import {
  resolveGeoSummary,
  type CompleteReportEvidence,
  type CompleteReportRow,
} from "@/lib/reports/complete-report-utils";
import { formatDateTime } from "@/lib/reports/export-core";

type PreparedEvidence = {
  imageBuffer: Buffer | null;
  imageWidth: number;
  imageHeight: number;
  geoSummary: string;
  source: "geo_info" | "exif" | "none";
  url: string;
};

type BuildCompleteReportPdfOptions = {
  title: string;
  generatedAtIso: string;
};

function toDisplayText(value: string | number | null | undefined) {
  if (value == null) return "-";
  const text = String(value).trim();
  return text.length > 0 ? text : "-";
}

function toInventoryText(value: number | null) {
  return value == null ? "-" : String(value);
}

async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength === 0) return null;
    return Buffer.from(arrayBuffer);
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function prepareEvidence(evidence: CompleteReportEvidence, targetWidth: number): Promise<PreparedEvidence> {
  const original = await fetchImageBuffer(evidence.rawUrl);
  if (!original) {
    const geo = resolveGeoSummary({ geoInfo: evidence.geoInfo, exif: null });
    return {
      imageBuffer: null,
      imageWidth: 0,
      imageHeight: 0,
      geoSummary: geo.value,
      source: geo.source,
      url: evidence.rawUrl,
    };
  }

  let exifCoords: { latitude: number; longitude: number } | null = null;
  if (!evidence.geoInfo) {
    try {
      const gps = await exifr.gps(original);
      if (
        gps &&
        typeof gps.latitude === "number" &&
        Number.isFinite(gps.latitude) &&
        typeof gps.longitude === "number" &&
        Number.isFinite(gps.longitude)
      ) {
        exifCoords = {
          latitude: gps.latitude,
          longitude: gps.longitude,
        };
      }
    } catch {
      exifCoords = null;
    }
  }

  const geo = resolveGeoSummary({ geoInfo: evidence.geoInfo, exif: exifCoords });

  try {
    const processed = await sharp(original)
      .rotate()
      .resize({ width: 1280, withoutEnlargement: true })
      .jpeg({ quality: 84, mozjpeg: true })
      .toBuffer();
    const metadata = await sharp(processed).metadata();
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;
    const ratio = width > 0 ? height / width : 1;
    const imageHeight = Math.min(260, Math.max(120, Math.round(targetWidth * ratio)));

    return {
      imageBuffer: processed,
      imageWidth: width,
      imageHeight,
      geoSummary: geo.value,
      source: geo.source,
      url: evidence.rawUrl,
    };
  } catch {
    return {
      imageBuffer: null,
      imageWidth: 0,
      imageHeight: 0,
      geoSummary: geo.value,
      source: geo.source,
      url: evidence.rawUrl,
    };
  }
}

function estimateBlockHeight(row: CompleteReportRow, evidences: PreparedEvidence[]): number {
  const base = 210;
  if (evidences.length === 0) return base + 40;

  const evidenceHeight = evidences.reduce((total, item) => {
    if (item.imageBuffer) {
      return total + item.imageHeight + 30;
    }
    return total + 46;
  }, 0);

  return base + evidenceHeight;
}

function drawField(
  doc: PDFKit.PDFDocument,
  params: {
    x: number;
    y: number;
    width: number;
    label: string;
    value: string;
  }
) {
  doc.font("Helvetica-Bold").fontSize(8).fillColor("#5A7984").text(params.label, params.x, params.y, {
    width: params.width,
  });
  doc.font("Helvetica").fontSize(9).fillColor("#1F2933").text(params.value, params.x, params.y + 10, {
    width: params.width,
  });
}

async function drawRecordBlock(params: {
  doc: PDFKit.PDFDocument;
  row: CompleteReportRow;
  x: number;
  y: number;
  width: number;
}) {
  const { doc, row, x, y, width } = params;
  const padding = 8;
  const contentWidth = width - padding * 2;
  const halfWidth = Math.floor((contentWidth - 8) / 2);

  const evidences = await Promise.all(
    row.evidences.map((evidence) => prepareEvidence(evidence, contentWidth))
  );

  const blockHeight = estimateBlockHeight(row, evidences);
  doc.roundedRect(x, y, width, blockHeight, 6).lineWidth(0.8).strokeColor("#CFD8D2").stroke();

  let cursorY = y + padding;
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#111827").text(`Registro #${row.recordId}`, x + padding, cursorY, {
    width: contentWidth,
  });
  cursorY += 16;

  drawField(doc, {
    x: x + padding,
    y: cursorY,
    width: halfWidth,
    label: "Marca temporal",
    value: formatDateTime(row.timeDate),
  });
  drawField(doc, {
    x: x + padding + halfWidth + 8,
    y: cursorY,
    width: halfWidth,
    label: "Establecimiento",
    value: toDisplayText(row.establishmentName),
  });
  cursorY += 32;

  drawField(doc, {
    x: x + padding,
    y: cursorY,
    width: halfWidth,
    label: "Inventario fisico",
    value: toInventoryText(row.realInventory),
  });
  drawField(doc, {
    x: x + padding + halfWidth + 8,
    y: cursorY,
    width: halfWidth,
    label: "Inventario sistema",
    value: toInventoryText(row.systemInventory),
  });
  cursorY += 32;

  drawField(doc, {
    x: x + padding,
    y: cursorY,
    width: halfWidth,
    label: "Se hizo ajuste",
    value: row.didAdjust ? "Si" : "No",
  });
  drawField(doc, {
    x: x + padding + halfWidth + 8,
    y: cursorY,
    width: halfWidth,
    label: "Proxima llegada",
    value: row.nextArrival,
  });
  cursorY += 32;

  drawField(doc, {
    x: x + padding,
    y: cursorY,
    width: contentWidth,
    label: "Comentarios",
    value: toDisplayText(row.comments),
  });
  cursorY += 34;

  doc.font("Helvetica-Bold").fontSize(8).fillColor("#5A7984").text("Fotografias", x + padding, cursorY, {
    width: contentWidth,
  });
  cursorY += 12;

  if (evidences.length === 0) {
    doc.font("Helvetica").fontSize(8).fillColor("#6B7280").text("Sin evidencias cargadas", x + padding, cursorY, {
      width: contentWidth,
    });
    return blockHeight;
  }

  for (const [index, evidence] of evidences.entries()) {
    doc.font("Helvetica-Bold").fontSize(8).fillColor("#111827").text(`Foto ${index + 1}`, x + padding, cursorY, {
      width: contentWidth,
    });
    cursorY += 10;

    if (evidence.imageBuffer) {
      doc.image(evidence.imageBuffer, x + padding, cursorY, {
        fit: [contentWidth, evidence.imageHeight],
        align: "center",
        valign: "center",
      });
      cursorY += evidence.imageHeight + 4;
    } else {
      doc.font("Helvetica").fontSize(8).fillColor("#6B7280").text("No se pudo cargar esta imagen", x + padding, cursorY, {
        width: contentWidth,
      });
      cursorY += 14;
    }

    doc.font("Helvetica").fontSize(7).fillColor("#334155").text(
      `Geo (${evidence.source}): ${toDisplayText(evidence.geoSummary)}`,
      x + padding,
      cursorY,
      { width: contentWidth }
    );
    cursorY += 10;
  }

  return blockHeight;
}

export async function buildCompleteReportPdf(
  rows: CompleteReportRow[],
  options: BuildCompleteReportPdfOptions
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 34, right: 28, bottom: 34, left: 28 },
    compress: true,
    info: { Title: options.title },
  });

  const chunks: Buffer[] = [];
  const bufferPromise = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk) => chunks.push(chunk as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  doc.font("Helvetica-Bold").fontSize(16).fillColor("#0F172A").text(options.title, { align: "left" });
  doc.moveDown(0.3);
  doc.font("Helvetica").fontSize(9).fillColor("#475569").text(
    `Generado: ${formatDateTime(options.generatedAtIso)} | Total de registros: ${rows.length}`
  );
  doc.moveDown(0.6);

  const columnGap = 12;
  const pageTop = doc.y;
  const pageBottom = doc.page.height - doc.page.margins.bottom;
  const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const columnWidth = (usableWidth - columnGap) / 2;
  let yByColumn = [pageTop, pageTop];

  for (const row of rows) {
    let col = yByColumn[0] <= yByColumn[1] ? 0 : 1;
    let x = doc.page.margins.left + col * (columnWidth + columnGap);
    let y = yByColumn[col];

    const estimative = estimateBlockHeight(row, []);
    if (y + estimative > pageBottom) {
      doc.addPage();
      yByColumn = [doc.page.margins.top, doc.page.margins.top];
      col = 0;
      x = doc.page.margins.left;
      y = yByColumn[col];
    }

    const usedHeight = await drawRecordBlock({ doc, row, x, y, width: columnWidth });
    yByColumn[col] = y + usedHeight + 10;
  }

  doc.end();
  return bufferPromise;
}
