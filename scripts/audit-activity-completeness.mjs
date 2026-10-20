import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { parse } from "csv-parse/sync";

const file = process.argv[2];

if (!file || !fs.existsSync(path.resolve(file))) {
  console.error('Gunakan: node scripts/audit-activity-completeness.mjs "data/import/file.csv"');
  process.exit(1);
}

const rows = parse(fs.readFileSync(path.resolve(file), "utf8"), {
  bom: true,
  columns: true,
  skip_empty_lines: true,
  trim: true,
});

const clean = (value) => String(value ?? "").trim();
const filled = (value) => clean(value) !== "";
const activityRows = rows.filter((r) => filled(r["TIPE KEGIATAN"]));

function summarize(items, columns) {
  const result = {};

  for (const column of columns) {
    const count = items.filter((row) => filled(row[column])).length;

    result[column] = {
      filled: count,
      empty: items.length - count,
      percentFilled: items.length
        ? Number(((count / items.length) * 100).toFixed(1))
        : 0,
    };
  }

  return result;
}

function groupByActivityType(items) {
  const types = [...new Set(items.map((r) => clean(r["TIPE KEGIATAN"])).filter(Boolean))];

  return Object.fromEntries(
    types.sort().map((type) => {
      const group = items.filter((r) => clean(r["TIPE KEGIATAN"]) === type);

      return [
        type,
        {
          rows: group.length,
          completeness: summarize(group, [
            "PILIH POSISI ANDA",
            "SILAHKAN ISI TANGGAL (VISIT)",
            "SILAHKAN ISI WAKTU (VISIT)",
            "TIPE TUJUAN",
            "TOPIK PEMBAHASAN | P-F",
            "HASIL PEMBAHASAN | P-F",
            "HASIL PENGAMATAN DEMPLOT",
            "NAMA LENGKAP | P-F",
            "NAMA LENGKAP | D",
            "NAMA LENGKAP | C",
            "Pastikan FOTO / VIDEO yang di upload bersifat SELFIE dan (sudah tercatat TIMESTAMP TIMEMARK Location)",
            "Pastikan FOTO / VIDEO yang di upload bersifat HD/2K/4K (tanpa TIMEMARK)",
            "Pastikan FOTO yang di upload bersifat NOTA TOKO tanpa ANGKA dan (sudah tercatat TIMESTAMP TIMEMARK Location)",
            "Pastikan FOTO yang di upload bersifat NOTA BSI tanpa ANGKA dan (sudah tercatat TIMESTAMP TIMEMARK Location)",
          ]),
        },
      ];
    }),
  );
}

const evidenceColumns = [
  "Pastikan FOTO / VIDEO yang di upload bersifat SELFIE dan (sudah tercatat TIMESTAMP TIMEMARK Location)",
  "Pastikan FOTO / VIDEO yang di upload bersifat HD/2K/4K (tanpa TIMEMARK)",
  "Pastikan FOTO yang di upload bersifat NOTA TOKO tanpa ANGKA dan (sudah tercatat TIMESTAMP TIMEMARK Location)",
  "Pastikan FOTO yang di upload bersifat NOTA BSI tanpa ANGKA dan (sudah tercatat TIMESTAMP TIMEMARK Location)",
];

const customerColumns = [
  "NAMA LENGKAP | P-F",
  "ALAMAT LENGKAP | P-F",
  "NO HANDPHONE | P-F",
  "NAMA LENGKAP | D",
  "NAMA PERUSAHAAN | D",
  "ALAMAT LENGKAP | D",
  "NO HANDPHONE | D",
  "NAMA LENGKAP | C",
  "ALAMAT LENGKAP | C",
  "NAMA PERUSAHAAN | C (PLANTATION)",
  "NO HANDPHONE | C",
];

const resultColumns = [
  "TOPIK PEMBAHASAN | P-F",
  "HASIL PEMBAHASAN | P-F",
  "TOPIK PEMBAHASAN | C",
  "HASIL PEMBAHASAN | C",
  "HASIL PENGAMATAN DEMPLOT",
  "APAKAH BIODATA SUDAH BENAR ?",
  "APAKAH KEGIATAN INI SUDAH SELESAI ?",
];

const validHeaders = Object.keys(activityRows[0] ?? {});

function onlyExisting(columns) {
  return columns.filter((column) => validHeaders.includes(column));
}

const roleCounts = {};
for (const row of activityRows) {
  const role = clean(row["PILIH POSISI ANDA"]) || "(kosong)";
  roleCounts[role] = (roleCounts[role] ?? 0) + 1;
}

const output = {
  totalCsvRows: rows.length,
  rowsWithActivityType: activityRows.length,
  overallCompleteness: summarize(activityRows, onlyExisting([
    "Timestamp",
    "PILIH POSISI ANDA",
    "SILAHKAN ISI TANGGAL (VISIT)",
    "SILAHKAN ISI WAKTU (VISIT)",
    "TIPE TUJUAN",
    "TIPE KEGIATAN",
  ])),
  roleDistribution: roleCounts,
  customerFieldCompleteness: summarize(activityRows, onlyExisting(customerColumns)),
  resultFieldCompleteness: summarize(activityRows, onlyExisting(resultColumns)),
  evidenceFieldCompleteness: summarize(activityRows, onlyExisting(evidenceColumns)),
  completenessByActivityType: groupByActivityType(activityRows),
};

console.log(JSON.stringify(output, null, 2));
