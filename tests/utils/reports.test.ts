import { describe, it, expect, beforeEach, afterEach } from "vitest";
import ExcelJS from "exceljs";
import fs from "fs";
import os from "os";
import path from "path";
import {
  CANONICAL_HEADERS,
  COLUMNS_TO_DROP,
  buildDelta,
  cleanseInMemory,
  validateUploadedWorkbook,
} from "../../server/utils/reports.js";

type RowData = Partial<Record<(typeof CANONICAL_HEADERS)[number], string>>;

function buildFixture(rows: RowData[]): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Sheet1");
  sheet.addRow([...CANONICAL_HEADERS]);
  for (const r of rows) {
    sheet.addRow(CANONICAL_HEADERS.map((h) => r[h] ?? ""));
  }
  return wb;
}

function readSheetRows(wb: ExcelJS.Workbook): { headers: string[]; rows: string[][] } {
  const sheet = wb.worksheets[0]!;
  const headerRow = sheet.getRow(1);
  const headerVals = headerRow.values as unknown[];
  const headers: string[] = [];
  for (let i = 1; i < headerVals.length; i++) {
    headers.push(String(headerVals[i] ?? ""));
  }
  const rows: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const vals = row.values as unknown[];
    const out: string[] = [];
    for (let i = 1; i <= headers.length; i++) {
      out.push(String(vals[i] ?? ""));
    }
    rows.push(out);
  });
  return { headers, rows };
}

const baseRow = (overrides: RowData = {}): RowData => ({
  Country: "AU",
  IMSKU: "1000000",
  MPN: "MPN-A",
  Language: "EN",
  "ERP Description": "desc",
  "Category Name": "cat",
  "SubCategory Name": "subcat",
  Vendor_Code: "VC",
  "Vendor Name": "vendor",
  Images: "ok",
  "Rich Media": "-",
  Specification: "ok",
  "Marketing Text": "-",
  "Similar Products": "-",
  Accessories: "-",
  Warranty: "-",
  "Compatibility Data": "-",
  WebVisible: "Y",
  ...overrides,
});

describe("cleanseInMemory", () => {
  it("drops the junk columns, keeps the rest in canonical order, and appends an Action column", () => {
    const wb = buildFixture([baseRow({ IMSKU: "1" })]);
    const out = cleanseInMemory(wb);
    const { headers, rows } = readSheetRows(out);
    for (const dropped of COLUMNS_TO_DROP) {
      expect(headers).not.toContain(dropped);
    }
    const expected = [
      ...CANONICAL_HEADERS.filter((h) => !COLUMNS_TO_DROP.has(h)),
      "Action",
    ];
    expect(headers).toEqual(expected);
    expect(headers[headers.length - 1]).toBe("Action");
    expect(headers.indexOf("Action")).toBe(headers.indexOf("Specification") + 1);
    expect(rows[0]![headers.indexOf("Action")]).toBe("");
  });

  it("filters out rows where Images === '-' AND Specification === '-'", () => {
    const wb = buildFixture([
      baseRow({ IMSKU: "1", Images: "-", Specification: "-" }), // dropped
      baseRow({ IMSKU: "2", Images: "ok", Specification: "-" }), // kept (only Images differs)
      baseRow({ IMSKU: "3", Images: "-", Specification: "ok" }), // kept (only Spec differs)
      baseRow({ IMSKU: "4", Images: "ok", Specification: "ok" }), // kept
    ]);
    const out = cleanseInMemory(wb);
    const { headers, rows } = readSheetRows(out);
    const imskuIdx = headers.indexOf("IMSKU");
    const ids = rows.map((r) => r[imskuIdx]);
    expect(ids).toEqual(["2", "3", "4"]);
  });

  it("sorts surviving rows by IMSKU as a string (lexicographic)", () => {
    const wb = buildFixture([
      baseRow({ IMSKU: "200" }),
      baseRow({ IMSKU: "1" }),
      baseRow({ IMSKU: "30" }),
      baseRow({ IMSKU: "1000" }),
    ]);
    const out = cleanseInMemory(wb);
    const { headers, rows } = readSheetRows(out);
    const imskuIdx = headers.indexOf("IMSKU");
    expect(rows.map((r) => r[imskuIdx])).toEqual(["1", "1000", "200", "30"]);
  });
});

describe("buildDelta", () => {
  let tmpDir: string;
  let curPath: string;
  let prevPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "reports-delta-"));
    curPath = path.join(tmpDir, "current.xlsx");
    prevPath = path.join(tmpDir, "previous.xlsx");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("emits only rows whose IMSKU is not present in previous", async () => {
    const prevWb = buildFixture([
      baseRow({ IMSKU: "100" }),
      baseRow({ IMSKU: "200" }),
    ]);
    const curWb = buildFixture([
      baseRow({ IMSKU: "100" }), // already known → excluded
      baseRow({ IMSKU: "200" }), // already known → excluded
      baseRow({ IMSKU: "300" }), // new
      baseRow({ IMSKU: "400" }), // new
    ]);
    await prevWb.xlsx.writeFile(prevPath);
    await curWb.xlsx.writeFile(curPath);

    const deltaWb = await buildDelta(curPath, prevPath);
    const { headers, rows } = readSheetRows(deltaWb);
    expect(headers).toEqual([...CANONICAL_HEADERS]); // delta keeps original schema
    const imskuIdx = headers.indexOf("IMSKU");
    expect(rows.map((r) => r[imskuIdx])).toEqual(["300", "400"]);
  });

  it("returns an empty body when current is a subset of previous", async () => {
    const prevWb = buildFixture([
      baseRow({ IMSKU: "100" }),
      baseRow({ IMSKU: "200" }),
    ]);
    const curWb = buildFixture([baseRow({ IMSKU: "100" })]);
    await prevWb.xlsx.writeFile(prevPath);
    await curWb.xlsx.writeFile(curPath);

    const deltaWb = await buildDelta(curPath, prevPath);
    const { rows } = readSheetRows(deltaWb);
    expect(rows).toHaveLength(0);
  });
});

describe("validateUploadedWorkbook", () => {
  it("accepts a workbook with the canonical headers and matching country", () => {
    const wb = buildFixture([baseRow({ Country: "AU" })]);
    const result = validateUploadedWorkbook(wb, "AU");
    expect(result.ok).toBe(true);
    expect(result.rowCount).toBe(1);
  });

  it("rejects a workbook whose first column is renamed", () => {
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet("Sheet1");
    const headers = [...CANONICAL_HEADERS] as string[];
    headers[0] = "Region"; // renamed Country
    sheet.addRow(headers);
    const result = validateUploadedWorkbook(wb, "AU");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Country/);
  });

  it("rejects a workbook with extra columns", () => {
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet("Sheet1");
    sheet.addRow([...CANONICAL_HEADERS, "ExtraCol"]);
    const result = validateUploadedWorkbook(wb, "AU");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/columns/);
  });

  it("rejects a workbook whose Country column does not match the selected country", () => {
    const wb = buildFixture([
      baseRow({ Country: "AU" }),
      baseRow({ Country: "NZ" }), // mismatch
    ]);
    const result = validateUploadedWorkbook(wb, "AU");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Country/);
  });
});
