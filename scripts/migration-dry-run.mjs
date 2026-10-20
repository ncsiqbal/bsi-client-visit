
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { parse } from "csv-parse/sync";

const input = process.argv[2];

if (!input || !fs.existsSync(path.resolve(input))) {
  console.error(
    'Usage: node scripts/migration-dry-run.mjs "data/import/file.csv"',
  );
  process.exit(1);
}

const rows = parse(fs.readFileSync(path.resolve(input), "utf8"), {
  bom: true,
  columns: true,
  skip_empty_lines: true,
  trim: true,
});

const clean = (value) => String(value ?? "").trim();
const filled = (value) => clean(value) !== "";

const columns = {
  timestamp: "Timestamp",
  visitDate: "SILAHKAN ISI TANGGAL (VISIT)",
  visitTime: "SILAHKAN ISI WAKTU (VISIT)",
  position: "PILIH POSISI ANDA",
  destination: "TIPE TUJUAN",
  activityType: "TIPE KEGIATAN",
};

const customerFields = {
  PROSPECTING: {
    name: "NAMA LENGKAP | P-F",
    phone: "NO HANDPHONE | P-F",
    address: "ALAMAT LENGKAP | P-F",
    company: null,
  },
  "FOLLOW UP": {
    name: "NAMA LENGKAP | P-F",
    phone: "NO HANDPHONE | P-F",
    address: "ALAMAT LENGKAP | P-F",
    company: null,
  },
  DEMPLOT: {
    name: "NAMA LENGKAP | D",
    phone: "NO HANDPHONE | D",
    address: "ALAMAT LENGKAP | D",
    company: "NAMA PERUSAHAAN | D",
  },
  CLOSING: {
    name: "NAMA LENGKAP | C",
    phone: "NO HANDPHONE | C",
    address: "ALAMAT LENGKAP | C",
    company: "NAMA PERUSAHAAN | C (PLANTATION)",
  },
};

const evidenceColumns = [
  "Pastikan FOTO / VIDEO yang di upload bersifat SELFIE dan (sudah tercatat TIMESTAMP TIMEMARK Location)",
  "Pastikan FOTO / VIDEO yang di upload bersifat HD/2K/4K (tanpa TIMEMARK)",
  "Pastikan FOTO yang di upload bersifat NOTA TOKO tanpa ANGKA dan (sudah tercatat TIMESTAMP TIMEMARK Location)",
  "Pastikan FOTO yang di upload bersifat NOTA BSI tanpa ANGKA dan (sudah tercatat TIMESTAMP TIMEMARK Location)",
];

const knownDestinations = new Set([
  "PETANI",
  "R1R2",
  "PLANTATION",
  "DISTRIBUTOR",
  "ASOSIASI",
]);

const knownActivityTypes = new Set([
  "PROSPECTING",
  "FOLLOW UP",
  "DEMPLOT",
  "CLOSING",
]);

function normalize(value) {
  return clean(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizePhone(value) {
  const digits = clean(value).replace(/\D/g, "");
  return digits || "";
}


function classifyEvidence(value) {
  const text = String(value ?? "").trim();

  if (!text) return "empty";

  // Periksa Google Drive sebelum URL umum.
  try {
    const url = new URL(text);

    if (
      ["drive.google.com", "docs.google.com"].includes(
        url.hostname.toLowerCase()
      )
    ) {
      return "google_drive_url";
    }

    if (["http:", "https:"].includes(url.protocol)) {
      return "url";
    }

    return "other_reference";
  } catch {
    // Bukan URL valid; cek apakah bentuknya menyerupai file ID.
    if (/^[a-zA-Z0-9_-]{20,}$/.test(text)) {
      return "possible_file_id";
    }

    return "other_reference";
  }
}


function newCounter() {
  return { total: 0, filled: 0, empty: 0 };
}

function addCount(counter, isFilled) {
  counter.total++;
  if (isFilled) counter.filled++;
  else counter.empty++;
}

function summarizeCounter(counter) {
  return {
    ...counter,
    percentFilled: counter.total
      ? Number(((counter.filled / counter.total) * 100).toFixed(1))
      : 0,
  };
}

const activities = rows
  .map((row, index) => ({ row, sourceRow: index + 2 }))
  .filter(({ row }) => filled(row[columns.activityType]));

const roleCounts = {};
const activityTypeCounts = {};
const destinationCounts = {};
const rowFlags = [];
const evidenceStats = Object.fromEntries(
  evidenceColumns.map((column) => [
    column,
    {
      filled: 0,
      empty: 0,
      referenceTypes: {
        url: 0,
        google_drive_url: 0,
        possible_file_id: 0,
        other_reference: 0,
      },
    },
  ]),
);

const customerStats = {};
const customerKeys = new Map();
let candidateCustomerOccurrences = 0;
let rowsWithCustomerIdentity = 0;
let rowsMissingCustomerName = 0;
let rowsMissingSalesPosition = 0;
let rowsWithUnknownActivityType = 0;
let rowsWithUnknownDestination = 0;
let rowsMissingVisitTime = 0;
let rowsMissingTimestamp = 0;
let rowsMissingVisitDate = 0;

for (const { row, sourceRow } of activities) {
  const type = clean(row[columns.activityType]).toUpperCase();
  const destination = clean(row[columns.destination]).toUpperCase();
  const role = clean(row[columns.position]) || "(kosong)";

  roleCounts[role] = (roleCounts[role] ?? 0) + 1;
  activityTypeCounts[type] = (activityTypeCounts[type] ?? 0) + 1;
  destinationCounts[destination || "(kosong)"] =
    (destinationCounts[destination || "(kosong)"] ?? 0) + 1;

  if (!knownActivityTypes.has(type)) rowsWithUnknownActivityType++;
  if (!knownDestinations.has(destination)) rowsWithUnknownDestination++;
  if (!filled(row[columns.timestamp])) rowsMissingTimestamp++;
  if (!filled(row[columns.visitDate])) rowsMissingVisitDate++;
  if (!filled(row[columns.visitTime])) rowsMissingVisitTime++;
  if (!filled(row[columns.position]) || role === "28") {
    rowsMissingSalesPosition++;
  }

  const mapping = customerFields[type];
  let customerName = "";
  let customerPhone = "";
  let customerAddress = "";
  let customerCompany = "";

  if (mapping) {
    customerName = clean(row[mapping.name]);
    customerPhone = clean(row[mapping.phone]);
    customerAddress = clean(row[mapping.address]);
    customerCompany = mapping.company
      ? clean(row[mapping.company])
      : "";
  }

  if (!customerName) {
    rowsMissingCustomerName++;
  } else {
    rowsWithCustomerIdentity++;

    // Hanya menghitung kandidat duplikasi; tidak menampilkan data pribadi.
    const phoneKey = normalizePhone(customerPhone);
    const nameKey = normalize(customerName);
    const companyKey = normalize(customerCompany);

    const identityKey = phoneKey
      ? `phone:${phoneKey}`
      : companyKey
        ? `name-company:${nameKey}|${companyKey}`
        : `name-address:${nameKey}|${normalize(customerAddress)}`;

    if (!customerKeys.has(identityKey)) {
      customerKeys.set(identityKey, {
        occurrences: 0,
        nameVariants: new Set(),
      });
    }

    const candidate = customerKeys.get(identityKey);
    candidate.occurrences++;
    candidate.nameVariants.add(nameKey);

    if (candidate.occurrences > 1) {
      candidateCustomerOccurrences++;
    }
  }

  if (!customerStats[type]) {
    customerStats[type] = {
      rows: 0,
      customerNameFilled: 0,
      customerPhoneFilled: 0,
      customerAddressFilled: 0,
      companyFilled: 0,
      missingCustomerName: 0,
    };
  }

  const stats = customerStats[type];
  stats.rows++;
  if (customerName) stats.customerNameFilled++;
  if (customerPhone) stats.customerPhoneFilled++;
  if (customerAddress) stats.customerAddressFilled++;
  if (customerCompany) stats.companyFilled++;
  if (!customerName) stats.missingCustomerName++;

  const missingEvidence = [];

  for (const column of evidenceColumns) {
    const value = clean(row[column]);
    const stat = evidenceStats[column];

    if (!value) {
      stat.empty++;
      continue;
    }

    stat.filled++;
    const referenceType = classifyEvidence(value);

    if (stat.referenceTypes[referenceType] !== undefined) {
      stat.referenceTypes[referenceType]++;
    }
  }

  const applicableEvidence = {
    PROSPECTING: [
      evidenceColumns[0],
    ],
    "FOLLOW UP": [
      evidenceColumns[0],
    ],
    DEMPLOT: [
      evidenceColumns[1],
    ],
    CLOSING: [
      evidenceColumns[2],
      evidenceColumns[3],
    ],
  }[type] ?? [];

  for (const column of applicableEvidence) {
    if (!filled(row[column])) missingEvidence.push(column);
  }

  const flags = [];

  if (!knownActivityTypes.has(type)) flags.push("UNKNOWN_ACTIVITY_TYPE");
  if (!knownDestinations.has(destination)) flags.push("UNKNOWN_DESTINATION");
  if (!customerName) flags.push("MISSING_CUSTOMER_NAME");
  if (!filled(row[columns.position]) || role === "28") {
    flags.push("SALES_ACCOUNT_MAPPING_REQUIRED");
  }
  if (!filled(row[columns.timestamp])) flags.push("MISSING_TIMESTAMP");
  if (!filled(row[columns.visitDate])) flags.push("MISSING_VISIT_DATE");
  if (!filled(row[columns.visitTime])) flags.push("MISSING_VISIT_TIME");
  if (missingEvidence.length) flags.push("REVIEW_EVIDENCE");

  if (flags.length) {
    rowFlags.push({
      sourceRow,
      activityType: type,
      flags,
    });
  }
}

const possibleDuplicates = [...customerKeys.values()].filter(
  (item) => item.occurrences > 1,
);

const output = {
  reportType: "READ_ONLY_MIGRATION_DRY_RUN",
  sourceFile: path.basename(path.resolve(input)),
  totalCsvRows: rows.length,
  activityRows: activities.length,
  mappingReadiness: {
    knownActivityTypeRows: activities.length - rowsMissingUnknownType(),
    unknownActivityTypeRows: rowsMissingUnknownType(),
    knownDestinationRows: activities.length - rowsMissingUnknownDestination(),
    unknownDestinationRows: rowsMissingUnknownDestination(),
    missingTimestamp: rowsMissingTimestamp,
    missingVisitDate: rowsMissingVisitDate,
    missingVisitTime: rowsMissingVisitTime,
    rowsRequiringSalesAccountMapping: rowsMissingSalesPosition,
    rowsMissingCustomerName: rowsMissingCustomerName,
    rowsWithCustomerName: rowsWithCustomerIdentity,
  },
  activityTypeCounts,
  destinationCounts,
  roleCounts,
  customerFieldSummaryByActivityType: customerStats,
  customerMatching: {
    distinctCandidateKeys: customerKeys.size,
    candidateKeysWithMultipleOccurrences: possibleDuplicates.length,
    repeatedOccurrencesBeyondFirst: candidateCustomerOccurrences,
    note: "Candidates only; not safe to merge automatically.",
  },
  evidenceSummary: Object.fromEntries(
    Object.entries(evidenceStats).map(([column, stat]) => [
      column,
      {
        ...stat,
        percentFilled: activities.length
          ? Number(((stat.filled / activities.length) * 100).toFixed(1))
          : 0,
      },
    ]),
  ),
  exceptionSummary: {
    rowsFlagged: rowFlags.length,
    flagCounts: rowFlags.reduce((counts, item) => {
      for (const flag of item.flags) {
        counts[flag] = (counts[flag] ?? 0) + 1;
      }
      return counts;
    }, {}),
    sampleRowsWithoutPersonalData: rowFlags.slice(0, 30),
  },
  migrationDecision: {
    databaseWritesPerformed: false,
    readyToAutoApprove: false,
    readyForProductionImport: false,
    reason: [
      "Sales account mapping has not been verified.",
      "Evidence references need source accessibility validation.",
      "Customer matches are candidates, not confirmed identities.",
      "Historical approval status has not been established.",
    ],
  },
};

function rowsMissingUnknownType() {
  return activities.filter(
    ({ row }) => !knownActivityTypes.has(
      clean(row[columns.activityType]).toUpperCase(),
    ),
  ).length;
}

function rowsMissingUnknownDestination() {
  return activities.filter(
    ({ row }) => !knownDestinations.has(
      clean(row[columns.destination]).toUpperCase(),
    ),
  ).length;
}

console.log(JSON.stringify(output, null, 2));
