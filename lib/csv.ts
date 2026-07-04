function escapeCsvField(value: string | number | null | undefined): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export interface ResultsCsvRow {
  nombres: string;
  apellidos: string;
  ci: string;
  correo: string;
  status: string;
  observedIp: string | null;
  penaltyCount: number;
  totalAutoScore: number | null;
  totalManualScore: number | null;
  totalScore: number | null;
  startedAt: string;
  submittedAt: string | null;
}

const HEADERS = [
  "Nombres",
  "Apellidos",
  "CI",
  "Correo",
  "Estado",
  "IP observada",
  "Incidencias",
  "Puntaje automático",
  "Puntaje manual",
  "Puntaje total",
  "Inicio",
  "Envío",
];

export function buildResultsCsv(rows: ResultsCsvRow[]): string {
  const lines = [HEADERS.map(escapeCsvField).join(",")];

  for (const row of rows) {
    lines.push(
      [
        row.nombres,
        row.apellidos,
        row.ci,
        row.correo,
        row.status,
        row.observedIp,
        row.penaltyCount,
        row.totalAutoScore,
        row.totalManualScore,
        row.totalScore,
        row.startedAt,
        row.submittedAt,
      ]
        .map(escapeCsvField)
        .join(",")
    );
  }

  return lines.join("\r\n") + "\r\n";
}
