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
  accessMode: "OPEN" | "REGISTERED";
  materia: { id: string; name: string } | null;
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
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {exams.map((exam) => (
        <Link key={exam.id} href={`/admin/exams/${exam.id}`} className="block h-full">
          <Card className="card-interactive flex h-full flex-col">
            <div className="mb-3 flex items-start justify-between gap-2">
              <h3 className="font-medium leading-snug text-slate-900">{exam.title}</h3>
              <Badge tone={exam.isPublished ? "green" : "gray"} className="shrink-0">
                {exam.isPublished ? "Publicado" : "Borrador"}
              </Badge>
            </div>
            <p className="text-sm text-slate-500">
              {exam.subject} · {exam.academicTerm}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {new Date(exam.examDate).toLocaleDateString("es-BO", { timeZone: "UTC" })}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {exam.questionCount} preguntas · {exam.attemptCount} intentos
            </p>
            <div className="mt-4 flex flex-1 flex-wrap items-end gap-2">
              {exam.materia && <Badge tone="blue">{exam.materia.name}</Badge>}
              {exam.accessMode === "REGISTERED" && <Badge tone="gray">Registrado</Badge>}
              {exam.finishedAttemptCount > 0 && (
                <Badge tone={exam.pendingReview ? "yellow" : "green"}>
                  {exam.pendingReview ? "Pendiente de calificación" : "Calificado"}
                </Badge>
              )}
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
