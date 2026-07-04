"use client";

import { useEffect, useState } from "react";
import { PublishToggle } from "@/components/admin/PublishToggle";
import { PublicUrlBox } from "@/components/admin/PublicUrlBox";
import { CsvExportButton } from "@/components/admin/CsvExportButton";
import { ExamMonitoringSection } from "@/components/admin/ExamMonitoringSection";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";

interface ExamDetail {
  id: string;
  title: string;
  subject: string;
  career: string;
  academicTerm: string;
  examDate: string;
  durationMinutes: number;
  isPublished: boolean;
  publicToken: string;
  questions: { id: string }[];
}

export default function ExamDetailPage({ params }: { params: { examId: string } }) {
  const [exam, setExam] = useState<ExamDetail | null>(null);

  useEffect(() => {
    fetch(`/api/admin/exams/${params.examId}`)
      .then((res) => res.json())
      .then((data) => setExam(data.exam));
  }, [params.examId]);

  if (!exam) {
    return (
      <div className="flex items-center gap-2 text-slate-500">
        <Spinner /> Cargando examen...
      </div>
    );
  }

  const publicUrl =
    typeof window !== "undefined" ? `${window.location.origin}/exam/${exam.publicToken}` : `/exam/${exam.publicToken}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{exam.title}</h1>
          <p className="text-sm text-slate-500">
            {exam.subject} · {exam.career} · {exam.academicTerm} · {exam.durationMinutes} minutos ·{" "}
            {exam.questions.length} preguntas
          </p>
        </div>
        <div className="flex items-center gap-3">
          <CsvExportButton examId={exam.id} />
          <PublishToggle examId={exam.id} initialPublished={exam.isPublished} />
        </div>
      </div>

      <Card>
        <h3 className="mb-2 font-medium text-slate-900">URL pública para estudiantes</h3>
        <PublicUrlBox url={publicUrl} />
        {!exam.isPublished && (
          <p className="mt-2 text-xs text-amber-600">
            El examen aún no está publicado; los estudiantes no podrán acceder hasta que lo publiques.
          </p>
        )}
      </Card>

      <ExamMonitoringSection examId={exam.id} />
    </div>
  );
}
