
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { parse } from "csv-parse/sync";

const inputFile = process.argv[2];

if (!inputFile) {
  console.error(
    'Usage: node scripts/profile-spreadsheet.mjs "data/import/file.csv"',
  );
  process.exit(1);
}

const filePath = path.resolve(inputFile);

if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

const rows = parse(fs.readFileSync(filePath, "utf8"), {
  bom: true,
  columns: true,
  skip_empty_lines: true,
  trim: true,
});

const headers = rows.length ? Object.keys(rows[0]) : [];
const nonEmpty = (value) =>
  value !== undefined && String(value).trim() !== "";

const countFilled = (column) =>
  rows.filter((row) => nonEmpty(row[column])).length;

const categoricalColumns = [
  "PILIH POSISI ANDA",
  "TIPE TUJUAN",
  "TIPE KEGIATAN",
  "TIPE-A (PROSPECTING)",
  "TIPE-B (PROSPECTING)",
  "TIPE-A1 (FOLLOW UP)",
  "TIPE-B1 (FOLLOW UP)",
  "TIPE-A1 (DEMPLOT)",
  "TIPE-B1 (DEMPLOT)",
  "TIPE-A1 (CLOSING)",
  "TIPE-B1 (CLOSING)",
];

const categoricalDistributions = {};

for (const column of categoricalColumns) {
  if (!headers.includes(column)) continue;

  const counts = new Map();

  for (const row of rows) {
    const value = String(row[column] ?? "").trim();
    if (!value) continue;

    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  categoricalDistributions[column] = Object.fromEntries(
    [...counts.entries()].sort((a, b) => b[1] - a[1]),
  );
}

const timestamp = "Timestamp";
const visitDate = "SILAHKAN ISI TANGGAL (VISIT)";
const visitTime = "SILAHKAN ISI WAKTU (VISIT)";
const activityType = "TIPE KEGIATAN";

const rowsWithTimestampDateAndType = rows.filter(
  (row) =>
    nonEmpty(row[timestamp]) &&
    nonEmpty(row[visitDate]) &&
    nonEmpty(row[activityType]),
);

const rowsWithAnyCoreData = rows.filter(
  (row) =>
    nonEmpty(row[timestamp]) ||
    nonEmpty(row[visitDate]) ||
    nonEmpty(row[visitTime]) ||
    nonEmpty(row[activityType]),
);

const importantColumns = [
  timestamp,
  visitDate,
  visitTime,
  "TIPE TUJUAN",
  activityType,
  "APAKAH KEGIATAN INI SUDAH SELESAI ?",
  "KM | 09:00",
  "KM | 11:00",
  "KM : 14:00",
  "KM : 18:00",
];

console.log(
  JSON.stringify(
    {
      file: path.basename(filePath),
      totalRows: rows.length,
      totalColumns: headers.length,
      rowCounts: {
        rowsWithTimestamp: countFilled(timestamp),
        rowsWithVisitDate: countFilled(visitDate),
        rowsWithVisitTime: countFilled(visitTime),
        rowsWithActivityType: countFilled(activityType),
        rowsWithTimestampDateAndActivityType:
          rowsWithTimestampDateAndType.length,
        rowsWithAnyCoreData: rowsWithAnyCoreData.length,
      },
      categoricalDistributions,
      filledCountsForImportantColumns: Object.fromEntries(
        importantColumns
          .filter((column) => headers.includes(column))
          .map((column) => [column, countFilled(column)]),
      ),
    },
    null,
    2,
  ),
);
