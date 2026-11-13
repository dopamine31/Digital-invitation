import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";

export interface ReportColumn { key: string; label: string }
export interface ReportSheet { name: string; columns: ReportColumn[]; rows: Record<string, unknown>[] }

function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function toCsv(sheet: ReportSheet): string {
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const header = sheet.columns.map((column) => escape(column.label)).join(",");
  const lines = sheet.rows.map((row) => sheet.columns.map((column) => escape(cell(row[column.key]))).join(","));
  return `\uFEFF${[header, ...lines].join("\r\n")}\r\n`;
}

export async function toXlsx(sheets: ReportSheet[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Rasa Undangan";
  workbook.created = new Date();
  for (const sheet of sheets) {
    const worksheet = workbook.addWorksheet(sheet.name.slice(0, 30) || "Laporan");
    worksheet.columns = sheet.columns.map((column) => ({ header: column.label, key: column.key, width: Math.max(14, Math.min(40, column.label.length + 8)) }));
    worksheet.getRow(1).font = { bold: true };
    for (const row of sheet.rows) {
      worksheet.addRow(Object.fromEntries(sheet.columns.map((column) => [column.key, cell(row[column.key])])));
    }
    worksheet.views = [{ state: "frozen", ySplit: 1 }];
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer as ArrayBuffer);
}

export async function toPdf(title: string, sheet: ReportSheet): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 40, layout: "landscape" });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  doc.fontSize(18).text(title, { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(9).text(`Dibuat: ${new Date().toLocaleString("id-ID")} · ${sheet.rows.length} baris`, { align: "center" });
  doc.moveDown(1);
  const usable = doc.page.width - 80;
  const columnWidth = usable / Math.max(1, sheet.columns.length);
  const drawHeader = () => {
    doc.fontSize(9).fillColor("#222");
    let x = 40;
    for (const column of sheet.columns) {
      doc.text(column.label, x, doc.y, { width: columnWidth - 6, continued: true, lineBreak: false });
      x += columnWidth;
    }
    doc.text("", { continued: false });
    doc.moveTo(40, doc.y + 4).lineTo(doc.page.width - 40, doc.y + 4).strokeColor("#999").stroke();
    doc.moveDown(0.4);
  };
  drawHeader();
  for (const row of sheet.rows) {
    if (doc.y > doc.page.height - 60) { doc.addPage(); drawHeader(); }
    let x = 40;
    const y = doc.y;
    doc.fontSize(8);
    for (const column of sheet.columns) {
      doc.text(cell(row[column.key]).slice(0, 120), x, y, { width: columnWidth - 6, height: 22, ellipsis: true, lineBreak: false });
      x += columnWidth;
    }
    doc.y = y + 24;
  }
  doc.end();
  return done;
}

export function csvResponse(body: string, filename: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export function binaryResponse(body: Buffer, filename: string, mime: string): Response {
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": mime,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
