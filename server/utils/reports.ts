import ExcelJS from "exceljs";

export const CANONICAL_HEADERS = [
  "Country",
  "IMSKU",
  "MPN",
  "Language",
  "ERP Description",
  "Category Name",
  "SubCategory Name",
  "Vendor_Code",
  "Vendor Name",
  "Images",
  "Rich Media",
  "Specification",
  "Marketing Text",
  "Similar Products",
  "Accessories",
  "Warranty",
  "Compatibility Data",
  "WebVisible",
] as const;

export const COLUMNS_TO_DROP = new Set<string>([
  "Language",
  "Vendor_Code",
  "Rich Media",
  "Marketing Text",
  "Similar Products",
  "Accessories",
  "Warranty",
  "Compatibility Data",
  "WebVisible",
]);

export function cellToString(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "object") {
    const obj = v as Record<string, unknown>;
    if ("result" in obj) return cellToString(obj.result);
    if ("text" in obj) return cellToString(obj.text);
    if ("richText" in obj && Array.isArray(obj.richText)) {
      return (obj.richText as Array<{ text?: string }>)
        .map((r) => r.text ?? "")
        .join("");
    }
  }
  return String(v);
}

export async function loadWorkbook(filePath: string): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  return wb;
}

function getFirstSheet(wb: ExcelJS.Workbook): ExcelJS.Worksheet {
  const sheet = wb.worksheets[0];
  if (!sheet) throw new Error("Workbook has no sheets");
  return sheet;
}

function readHeaders(sheet: ExcelJS.Worksheet): string[] {
  const headerRow = sheet.getRow(1);
  const values = headerRow.values as unknown[];
  const headers: string[] = [];
  for (let i = 1; i < values.length; i++) {
    headers.push(cellToString(values[i]));
  }
  return headers;
}

export function validateHeaders(headers: string[]): string | null {
  if (headers.length !== CANONICAL_HEADERS.length) {
    return `Expected ${CANONICAL_HEADERS.length} columns but got ${headers.length}. Headers seen: ${headers.join(", ") || "(none)"}`;
  }
  for (let i = 0; i < CANONICAL_HEADERS.length; i++) {
    if (headers[i] !== CANONICAL_HEADERS[i]) {
      return `Column ${i + 1} should be "${CANONICAL_HEADERS[i]}" but is "${headers[i] ?? ""}".`;
    }
  }
  return null;
}

export interface UploadValidation {
  ok: boolean;
  error?: string;
  rowCount: number;
}

export function validateUploadedWorkbook(
  wb: ExcelJS.Workbook,
  expectedCountry: string,
): UploadValidation {
  let sheet: ExcelJS.Worksheet;
  try {
    sheet = getFirstSheet(wb);
  } catch (e: unknown) {
    return { ok: false, error: (e as Error).message, rowCount: 0 };
  }

  const headers = readHeaders(sheet);
  const headerError = validateHeaders(headers);
  if (headerError) return { ok: false, error: headerError, rowCount: 0 };

  const countryCol = CANONICAL_HEADERS.indexOf("Country") + 1; // 1-indexed
  let rowCount = 0;
  let firstMismatch: { row: number; got: string } | null = null;
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const country = cellToString(row.getCell(countryCol).value);
    if (country !== expectedCountry && !firstMismatch) {
      firstMismatch = { row: rowNumber, got: country };
    }
    rowCount++;
  });

  if (firstMismatch) {
    const m = firstMismatch as { row: number; got: string };
    return {
      ok: false,
      error: `Row ${m.row} has Country "${m.got}" but expected "${expectedCountry}".`,
      rowCount,
    };
  }
  return { ok: true, rowCount };
}

export function cleanseInMemory(wb: ExcelJS.Workbook): ExcelJS.Workbook {
  const srcSheet = getFirstSheet(wb);
  const headers = readHeaders(srcSheet);

  const keepIdx: number[] = [];
  const keptHeaders: string[] = [];
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i]!;
    if (!COLUMNS_TO_DROP.has(h)) {
      keepIdx.push(i);
      keptHeaders.push(h);
    }
  }

  const imskuIdx = headers.indexOf("IMSKU");
  const imagesIdx = headers.indexOf("Images");
  const specIdx = headers.indexOf("Specification");

  type Record = { values: unknown[]; imsku: string };
  const records: Record[] = [];
  srcSheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const rowVals = row.values as unknown[]; // 1-indexed; [0] is null
    const images = cellToString(rowVals[imagesIdx + 1]);
    const spec = cellToString(rowVals[specIdx + 1]);
    if (images === "-" && spec === "-") return;
    const imsku = cellToString(rowVals[imskuIdx + 1]);
    const kept = keepIdx.map((i) => rowVals[i + 1]);
    records.push({ values: kept, imsku });
  });

  records.sort((a, b) => (a.imsku < b.imsku ? -1 : a.imsku > b.imsku ? 1 : 0));

  const out = new ExcelJS.Workbook();
  const outSheet = out.addWorksheet(srcSheet.name || "Sheet1");
  outSheet.addRow(keptHeaders);
  for (const rec of records) outSheet.addRow(rec.values);
  return out;
}

export async function cleanseFile(srcPath: string, destPath: string): Promise<void> {
  const wb = await loadWorkbook(srcPath);
  const out = cleanseInMemory(wb);
  await out.xlsx.writeFile(destPath);
}

export async function buildDelta(
  currentPath: string,
  previousPath: string,
): Promise<ExcelJS.Workbook> {
  const cur = await loadWorkbook(currentPath);
  const prev = await loadWorkbook(previousPath);
  const curSheet = getFirstSheet(cur);
  const prevSheet = getFirstSheet(prev);

  const curHeaders = readHeaders(curSheet);
  const prevHeaders = readHeaders(prevSheet);

  const curImskuIdx = curHeaders.indexOf("IMSKU");
  const prevImskuIdx = prevHeaders.indexOf("IMSKU");
  if (curImskuIdx === -1) throw new Error("IMSKU column missing from current report");
  if (prevImskuIdx === -1) throw new Error("IMSKU column missing from previous report");

  const prevSet = new Set<string>();
  prevSheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const vals = row.values as unknown[];
    prevSet.add(cellToString(vals[prevImskuIdx + 1]));
  });

  const out = new ExcelJS.Workbook();
  const outSheet = out.addWorksheet(curSheet.name || "Sheet1");
  outSheet.addRow(curHeaders);
  curSheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const vals = row.values as unknown[];
    const imsku = cellToString(vals[curImskuIdx + 1]);
    if (prevSet.has(imsku)) return;
    outSheet.addRow(vals.slice(1));
  });

  return out;
}
