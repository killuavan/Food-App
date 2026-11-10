import { jsPDF } from 'jspdf';
import type { DateRange } from '../utils/analyticsReports';

export type ExportValue = string | number | boolean | null | undefined;
export type ExportRow = Record<string, ExportValue>;

export interface ReportFileData {
  title: string;
  range: DateRange;
  columns: string[];
  rows: ExportRow[];
  summary: string[];
  generatedAt?: Date;
}

function protectSpreadsheetFormula(value: string): string {
  return /^\s*[=+\-@]/u.test(value) ? `'${value}` : value;
}

export function escapeCsvValue(value: ExportValue): string {
  const text = protectSpreadsheetFormula(value === null || value === undefined ? '' : String(value));
  return `"${text.replaceAll('"', '""')}"`;
}

export function createCsvReport(report: ReportFileData): string {
  const generatedAt = report.generatedAt ?? new Date();
  const headers = report.columns;
  const lines = [
    [report.title],
    [`Date range: ${report.range.startDate} to ${report.range.endDate}`],
    [`Generated: ${generatedAt.toISOString()}`],
    ...report.summary.map((line) => [line]),
    [],
    headers,
    ...report.rows.map((row) => headers.map((header) => row[header] ?? '')),
  ];
  return `\uFEFF${lines.map((line) => line.map(escapeCsvValue).join(',')).join('\r\n')}`;
}

export function createPdfReport(report: ReportFileData): Blob {
  const document = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = document.internal.pageSize.getWidth();
  const pageHeight = document.internal.pageSize.getHeight();
  const left = 42;
  const right = pageWidth - 42;
  let y = 48;

  document.setFont('helvetica', 'bold');
  document.setFontSize(18);
  document.text('Pantry & Plate', left, y);
  y += 28;
  document.setFontSize(14);
  document.text(report.title, left, y);
  y += 18;
  document.setFont('helvetica', 'normal');
  document.setFontSize(9);
  document.text(`Date range: ${report.range.startDate} to ${report.range.endDate}`, left, y);
  y += 14;
  document.text(`Generated: ${(report.generatedAt ?? new Date()).toLocaleString()}`, left, y);
  y += 24;

  const writeLine = (text: string, bold = false): void => {
    const wrapped = document.splitTextToSize(text, right - left);
    if (y + wrapped.length * 12 > pageHeight - 42) {
      document.addPage();
      y = 48;
    }
    document.setFont('helvetica', bold ? 'bold' : 'normal');
    document.setFontSize(9);
    document.text(wrapped, left, y);
    y += wrapped.length * 12 + 3;
  };

  writeLine('Summary', true);
  for (const summary of report.summary) writeLine(summary);
  y += 6;
  writeLine('Data', true);
  if (!report.rows.length) writeLine('No records are available for this report.');
  else {
    writeLine(report.columns.join(' | '), true);
    for (const row of report.rows) {
      writeLine(report.columns.map((column) => `${column}: ${row[column] ?? 'Not available'}`).join(' | '));
    }
  }
  return new Blob([document.output('arraybuffer')], { type: 'application/pdf' });
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportReportFile(
  blob: Blob,
  filename: string,
  title: string,
): Promise<'shared' | 'downloaded'> {
  const file = new File([blob], filename, { type: blob.type });
  if (typeof navigator.share === 'function' && typeof navigator.canShare === 'function'
    && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file], title });
    return 'shared';
  }
  downloadBlob(blob, filename);
  return 'downloaded';
}
