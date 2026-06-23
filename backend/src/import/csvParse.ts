function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function detectDelimiter(headerLine: string): string {
  const semicolons = (headerLine.match(/;/g) ?? []).length;
  const commas = (headerLine.match(/,/g) ?? []).length;
  return semicolons >= commas ? ";" : ",";
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (!inQuotes && ch === delimiter) {
      fields.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  fields.push(current.trim());
  return fields;
}

export type CsvTable = {
  delimiter: string;
  headers: string[];
  rows: string[][];
  headerRow: number;
};

export function parseCsvTable(text: string): CsvTable {
  const normalized = stripBom(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);

  let headerRow = -1;
  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].toLowerCase();
    if (
      lower.includes("symbol") &&
      (lower.includes("volume") || lower.includes("amount") || lower.startsWith("id"))
    ) {
      headerRow = i;
      break;
    }
  }
  if (headerRow < 0) {
    throw new Error("Could not find CSV header row (expected Symbol column)");
  }

  const delimiter = detectDelimiter(lines[headerRow]);
  const headers = parseCsvLine(lines[headerRow], delimiter).map((h) => h.trim());
  const rows: string[][] = [];
  for (let i = headerRow + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^total\b/i.test(line)) continue;
    const fields = parseCsvLine(line, delimiter);
    if (fields.every((f) => f === "")) continue;
    rows.push(fields);
  }

  return { delimiter, headers, rows, headerRow: headerRow + 1 };
}

export function rowToRecord(headers: string[], fields: string[]): Record<string, string> {
  const record: Record<string, string> = {};
  for (let i = 0; i < headers.length; i++) {
    const key = headers[i];
    if (!key) continue;
    record[key.toLowerCase()] = fields[i] ?? "";
  }
  return record;
}

export function parseNumeric(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/\s/g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}
