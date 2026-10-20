import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { parse } from "csv-parse/sync";

const file = process.argv[2];

if (!file || !fs.existsSync(path.resolve(file))) {
  console.error('Gunakan: node scripts/check-data-quality.mjs "data/import/file.csv"');
  process.exit(1);
}

const rows = parse(fs.readFileSync(path.resolve(file), "utf8"), {
  bom: true,
  columns: true,
  skip_empty_lines: true,
  trim: true,
});

const clean = (v) => String(v ?? "").trim();
const filled = (v) => clean(v) !== "";

function distribution(column) {
  const counts = new Map();

  for (const row of rows) {
    const value = clean(row[column]);
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([value, count]) => ({ value, count }));
}

function dateStats(column) {
  const values = rows.map((r) => clean(r[column])).filter(Boolean);
  const parsed = values.map((value) => ({
    value,
    date: new Date(value),
  }));

  const valid = parsed.filter((x) => !Number.isNaN(x.date.getTime()));
  const sorted = valid.map((x) => x.date.getTime()).sort((a, b) => a - b);

  return {
    filled: values.length,
    validAsJavaScriptDate: valid.length,
    invalidOrUnparsed: values.length - valid.length,
    earliestParsed: sorted.length ? new Date(sorted[0]).toISOString() : null,
    latestParsed: sorted.length
      ? new Date(sorted[sorted.length - 1]).toISOString()
      : null,
    examples: [...new Set(values)].slice(0, 8),
  };
}

function duplicateStats(column) {
  const counts = new Map();

  for (const row of rows) {
    const value = clean(row[column]);
    if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  const duplicated = [...counts.entries()].filter(([, n]) => n > 1);

  return {
    distinctValues: counts.size,
    valuesRepeated: duplicated.length,
    rowsBelongingToRepeatedValues: duplicated.reduce(
      (sum, [, n]) => sum + n,
      0,
    ),
    mostRepeatedCounts: duplicated
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([value, count]) => ({ value, count })),
  };
}

const kmColumns = [
  "KM | 09:00",
  "KM | 11:00",
  "KM : 14:00",
  "KM : 18:00",
];

const output = {
  totalRows: rows.length,
  visitDate: dateStats("SILAHKAN ISI TANGGAL (VISIT)"),
  submissionTimestamp: dateStats("Timestamp"),
  duplicateSubmissionTimestamp: duplicateStats("Timestamp"),
  positionDistribution: distribution("PILIH POSISI ANDA"),
  kmValues: Object.fromEntries(
    kmColumns.map((column) => [
      column,
      {
        filled: rows.filter((r) => filled(r[column])).length,
        topValues: distribution(column),
      },
    ]),
  ),
};

console.log(JSON.stringify(output, null, 2));
