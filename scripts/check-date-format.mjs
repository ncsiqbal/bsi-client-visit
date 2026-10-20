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

function parseIndonesianDate(value, includeTime = false) {
  const text = String(value ?? "").trim();
  const match = text.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
  );

  if (!match) return null;

  const [, dd, mm, yyyy, hh = "0", min = "0", ss = "0"] = match;
  const day = Number(dd);
  const month = Number(mm);
  const year = Number(yyyy);
  const hour = Number(hh);
  const minute = Number(min);
  const second = Number(ss);

  if (
    month < 1 || month > 12 ||
    day < 1 || day > 31 ||
    hour > 23 || minute > 59 || second > 59
  ) return null;

  const date = new Date(Date.UTC(
    year, month - 1, day, hour, minute, second
  ));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) return null;

  return date;
}

function inspect(column, includeTime = false) {
  const values = rows
    .map((row) => String(row[column] ?? "").trim())
    .filter(Boolean);

  const parsed = values
    .map((value) => ({
      value,
      date: parseIndonesianDate(value, includeTime),
    }));

  const valid = parsed.filter((item) => item.date);
  const sorted = [...valid].sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  );

  const counts = new Map();
  for (const item of valid) {
    const key = item.date.toISOString();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const duplicates = [...counts.entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([value, count]) => ({ value, count }));

  return {
    filled: values.length,
    valid: valid.length,
    invalid: values.length - valid.length,
    earliest: sorted[0]?.value ?? null,
    latest: sorted.at(-1)?.value ?? null,
    invalidExamples: parsed
      .filter((item) => !item.date)
      .slice(0, 10)
      .map((item) => item.value),
    duplicateParsedValues: duplicates,
  };
}

console.log(JSON.stringify({
  totalRows: rows.length,
  visitDate: inspect("SILAHKAN ISI TANGGAL (VISIT)"),
  submissionTimestamp: inspect("Timestamp", true),
}, null, 2));
