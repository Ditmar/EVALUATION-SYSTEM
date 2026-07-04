"use client";

import { Button } from "@/components/ui/Button";

export function CsvExportButton({ examId }: { examId: string }) {
  return (
    <a href={`/api/admin/exams/${examId}/export`} download>
      <Button variant="secondary">Exportar CSV</Button>
    </a>
  );
}
