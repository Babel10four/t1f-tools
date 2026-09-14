import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const SUPPORTED_STATES = new Set([
  "CA",
  "WA",
  "TX",
  "FL",
  "CO",
  "SC",
  "IN",
  "MD",
  "NC",
  "IL",
  "VA",
  "GA",
  "OH",
  "TN",
  "MI",
  "MO",
  "PA",
]);

const REQUIRED_HEADERS = [
  "STATE",
  "LAST UPDATED",
  "PERIOD END",
  "REGION ID",
  "REGION TYPE",
  "REGION NAME",
  "MONTHS OF SUPPLY",
];

function parseCsv(source) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows;
}

function isoDate(value, fieldName, rowNumber) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    throw new Error(`Invalid ${fieldName} on CSV row ${rowNumber}: ${value}`);
  }
  return date.toISOString().slice(0, 10);
}

function requiredIndex(headers, name) {
  const index = headers.indexOf(name);
  if (index === -1) throw new Error(`Missing required CSV header: ${name}`);
  return index;
}

const inputArg = process.argv[2];
if (!inputArg) {
  throw new Error(
    "Usage: npm run data:months-of-supply -- /absolute/path/to/city-market-data.csv",
  );
}

const inputPath = resolve(inputArg);
const outputPath = resolve(
  process.argv[3] ?? "src/data/months-of-supply-current.json",
);
const rows = parseCsv(await readFile(inputPath, "utf8"));
if (rows.length < 2) throw new Error("The market-data CSV contains no data rows.");

const headers = rows[0].map((value) => value.replace(/^\uFEFF/, "").trim());
for (const header of REQUIRED_HEADERS) requiredIndex(headers, header);

const indexes = Object.fromEntries(
  REQUIRED_HEADERS.map((header) => [header, requiredIndex(headers, header)]),
);
const latestByCity = new Map();
let rejectedRows = 0;

for (let index = 1; index < rows.length; index += 1) {
  const row = rows[index];
  const state = row[indexes.STATE]?.trim().toUpperCase();
  const regionType = row[indexes["REGION TYPE"]]?.trim();
  if (!SUPPORTED_STATES.has(state) || regionType !== "City") continue;

  const city = row[indexes["REGION NAME"]]?.trim();
  const regionId = Number(row[indexes["REGION ID"]]);
  if (!city || !Number.isFinite(regionId)) {
    rejectedRows += 1;
    continue;
  }

  const rowNumber = index + 1;
  let periodEnd;
  let lastUpdated;
  try {
    periodEnd = isoDate(row[indexes["PERIOD END"]], "PERIOD END", rowNumber);
    lastUpdated = isoDate(
      row[indexes["LAST UPDATED"]],
      "LAST UPDATED",
      rowNumber,
    );
  } catch {
    rejectedRows += 1;
    continue;
  }

  const parsedMonthsOfSupply = Number(row[indexes["MONTHS OF SUPPLY"]]);
  const monthsOfSupply = Number.isFinite(parsedMonthsOfSupply)
    ? parsedMonthsOfSupply
    : 0;
  const key = String(regionId);
  const existing = latestByCity.get(key);
  if (!existing || periodEnd > existing.periodEnd) {
    latestByCity.set(key, {
      state: existing?.state ?? state,
      regionId: existing?.regionId ?? regionId,
      city: existing?.city ?? city,
      periodEnd,
      monthsOfSupply,
      lastUpdated,
    });
  } else if (periodEnd === existing.periodEnd) {
    existing.monthsOfSupply += monthsOfSupply;
    if (lastUpdated > existing.lastUpdated) existing.lastUpdated = lastUpdated;
  }
}

const entries = [...latestByCity.values()].sort(
  (a, b) => a.state.localeCompare(b.state) || a.city.localeCompare(b.city),
);
if (entries.length === 0) {
  throw new Error("No supported city records were found.");
}

const snapshot = {
  schemaVersion: 1,
  lastUpdated: entries.reduce(
    (latest, entry) => (entry.lastUpdated > latest ? entry.lastUpdated : latest),
    entries[0].lastUpdated,
  ),
  dataThrough: entries.reduce(
    (latest, entry) => (entry.periodEnd > latest ? entry.periodEnd : latest),
    entries[0].periodEnd,
  ),
  supportedStates: [...SUPPORTED_STATES],
  entries: entries.map((entry) => ({
    state: entry.state,
    regionId: entry.regionId,
    city: entry.city,
    periodEnd: entry.periodEnd,
    monthsOfSupply: entry.monthsOfSupply,
  })),
};

await writeFile(outputPath, `${JSON.stringify(snapshot)}\n`, "utf8");
process.stdout.write(
  `Wrote ${entries.length} cities to ${outputPath}; ${rejectedRows} supported-state rows with invalid identity or date fields were skipped.\n`,
);
