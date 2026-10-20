import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { parse } from "csv-parse/sync";

const inputFile = process.argv[2];

if (!inputFile) {
  console.error(
    "Usage: node scripts/inspect-spreadsheet.mjs data/import/source.csv",
  );
  process.exit(1);
}

const filePath = path.resolve(inputFile);

if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

const content = fs.readFileSync(filePath, "utf8");

const rows = parse(content, {
  bom: true,
  columns: true,
  skip_empty_lines: true,
  trim: true,
  relax_column_count: false,
});

const headers = rows.length ? Object.keys(rows[0]) : [];

const report = {
  file: path.basename(filePath),
  totalRows: rows.length,
  totalColumns: headers.length,
  headers,
  emptyValuesByColumn: Object.fromEntries(
    headers.map((header) => [
      header,
      rows.filter(
        (row) =>
          row[header] === undefined ||
          String(row[header]).trim() === "",
      ).length,
    ]),
  ),
};

console.log(JSON.stringify(report, null, 2));
