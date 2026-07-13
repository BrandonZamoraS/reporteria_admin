const DEFAULT_DYNAMIC_REPORT_NAME = "Reporte Dinámico";
const DEFAULT_DYNAMIC_REPORT_FILENAME = "reporte_dinamico";

function stripDiacritics(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

export function resolveDynamicReportName(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : DEFAULT_DYNAMIC_REPORT_NAME;
}

export function sanitizeDynamicReportFilenamePart(value: string): string {
  const sanitized = stripDiacritics(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  return sanitized || DEFAULT_DYNAMIC_REPORT_FILENAME;
}

export function createDynamicReportFilename(
  reportName: string,
  dateStamp: string = new Date().toISOString().slice(0, 10)
): string {
  return `${sanitizeDynamicReportFilenamePart(reportName)}_${dateStamp}.pdf`;
}

export function fitFontSizeToHeight(options: {
  text: string;
  baseFontSize: number;
  maxHeight: number;
  minFontSize?: number;
  step?: number;
  measureHeight: (fontSize: number) => number;
}): { fontSize: number; textHeight: number; fits: boolean } {
  const minFontSize = options.minFontSize ?? 8;
  const step = options.step ?? 0.5;
  let fontSize = options.baseFontSize;
  let textHeight = options.measureHeight(fontSize);

  while (textHeight > options.maxHeight && fontSize > minFontSize) {
    fontSize = Math.max(minFontSize, Number((fontSize - step).toFixed(2)));
    textHeight = options.measureHeight(fontSize);
    if (fontSize === minFontSize) break;
  }

  const fits = textHeight <= options.maxHeight;

  return {
    fontSize,
    textHeight: Math.min(textHeight, options.maxHeight),
    fits,
  };
}
