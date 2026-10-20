import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { parse } from "csv-parse/sync";

const file = process.argv[2];

if (!file || !fs.existsSync(path.resolve(file))) {
  console.error("File CSV tidak ditemukan.");
  process.exit(1);
}

const rows = parse(fs.readFileSync(path.resolve(file), "utf8"), {
  bom: true,
  columns: true,
  skip_empty_lines: true,
  trim: true,
});

const clean = (value) => String(value ?? "").trim();

const safeColumns = [
  "PILIH POSISI ANDA",
  "SILAHKAN ISI TANGGAL (VISIT)",
  "SILAHKAN ISI WAKTU (VISIT)",
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

const groups = new Map();

for (const row of rows) {
  const timestamp = clean(row["Timestamp"]);
  if (!timestamp) continue;

  if (!groups.has(timestamp)) groups.set(timestamp, []);
  groups.get(timestamp).push(row);
}

const duplicates = [];

for (const [timestamp, group] of groups) {
  if (group.length < 2) continue;

  duplicates.push({
    timestamp,
    rowCount: group.length,
    rows: group.map((row) =>
      Object.fromEntries(
        safeColumns.map((column) => [column, clean(row[column])]),
      ),
    ),
  });
}

console.log(JSON.stringify({
  duplicateTimestampGroups: duplicates.length,
  duplicateGroups: duplicates,
}, null, 2));
