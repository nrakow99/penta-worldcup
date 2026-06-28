/** Simple CSV parser — handles basic quoted fields */

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
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
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? "";
    });
    if (Object.values(row).some((v) => v)) rows.push(row);
  }

  return rows;
}

export function parseImportJson(text: string): unknown {
  return JSON.parse(text) as unknown;
}

export function detectFormat(filename: string, content: string): "csv" | "json" {
  if (filename.endsWith(".json")) return "json";
  if (filename.endsWith(".csv")) return "csv";
  const trimmed = content.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return "json";
  return "csv";
}

export function extractRows(
  content: string,
  format: "csv" | "json",
  importType: "teams" | "fixtures" | "results"
): Record<string, string>[] {
  if (format === "csv") {
    return parseCsv(content);
  }

  const parsed = parseImportJson(content) as Record<string, unknown>;

  let arr: unknown[] = [];
  if (Array.isArray(parsed)) {
    arr = parsed;
  } else if (importType === "teams" && Array.isArray(parsed.teams)) {
    arr = parsed.teams;
  } else if (importType === "fixtures" && Array.isArray(parsed.fixtures)) {
    arr = parsed.fixtures;
  } else if (importType === "results" && Array.isArray(parsed.results)) {
    arr = parsed.results;
  } else if (Array.isArray(parsed.data)) {
    arr = parsed.data;
  }

  return arr.map((item) => {
    const obj = item as Record<string, unknown>;
    const row: Record<string, string> = {};
    for (const [k, v] of Object.entries(obj)) {
      row[k.toLowerCase()] = v == null ? "" : String(v);
    }
    return row;
  });
}

export function normalizeGroupName(raw: string): string {
  const trimmed = raw.trim().toUpperCase();
  const match = trimmed.match(/GROUP\s*([A-H])/) ?? trimmed.match(/^([A-H])$/);
  return match ? match[1] : trimmed.charAt(0);
}
