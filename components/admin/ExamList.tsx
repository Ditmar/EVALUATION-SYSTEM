"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";

interface ExamSummary {
  id: string;
  title: string;
  subject: string;
  academicTerm: string;
  examDate: string;
  isPublished: boolean;
  questionCount: number;
  attemptCount: number;
  finishedAttemptCount: number;
  pendingReview: boolean;
}

export function ExamList() {
  const [exams, setExams] = useState<ExamSummary[] | null>(null);

  useEffect(() => {
    fetch("/api/admin/exams")
      .then((res) => res.json())
      .then((data) => setExams(data.exams ?? []));
  }, []);

  if (exams === null) {
    return (
      <div className="flex items-center gap-2 text-slate-500">
        <Spinner /> Cargando exámenes...
      </div>
    );
  }

  if (exams.length === 0) {
    return (
      <Card className="text-center text-slate-500">
        Aún no has creado ningún examen. Usa el botón &quot;Nuevo examen&quot; para importar uno desde JSON.
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {exams.map((exam) => (
        <Link key={exam.id} href={`/admin/exams/${exam.id}`} className="block">
          <Card className="flex items-center justify-between transition hover:border-brand-300">
            <div>
              <h3 className="font-medium text-slate-900">{exam.title}</h3>
              <p className="text-sm text-slate-500">
                {exam.subject} · {exam.academicTerm} ·{" "}
                {new Date(exam.examDate).toLocaleDateString("es-BO", { timeZone: "UTC" })}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {exam.questionCount} preguntas · {exam.attemptCount} intentos
              </p>
            </div>
            <div className="flex items-center gap-2">
              {exam.finishedAttemptCount > 0 && (
                <Badge tone={exam.pendingReview ? "yellow" : "green"}>
                  {exam.pendingReview ? "Pendiente de calificación" : "Calificado"}
                </Badge>
              )}
              <Badge tone={exam.isPublished ? "green" : "gray"}>
                {exam.isPublished ? "Publicado" : "Borrador"}
              </Badge>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
