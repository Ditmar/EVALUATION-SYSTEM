"use client";

import { Fragment, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/ToastProvider";
import { SubjectStudentsPanel } from "@/components/admin/SubjectStudentsPanel";

interface Subject {
  id: string;
  name: string;
  examCount: number;
  studentCount: number;
}

export function SubjectManager() {
  const { showToast } = useToast();
  const [subjects, setSubjects] = useState<Subject[] | null>(null);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/admin/subjects");
    const data = await res.json();
    setSubjects(data.subjects ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/admin/subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error ?? "No se pudo crear la materia.", "error");
        return;
      }
      setName("");
      await load();
      showToast("Materia creada.", "success");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/subjects/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error ?? "No se pudo eliminar la materia.", "error");
        return;
      }
      await load();
      showToast("Materia eliminada.", "success");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="mb-3 font-medium text-slate-900">Nueva materia</h2>
        <form onSubmit={handleCreate} className="flex gap-3">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Programación II"
            className="flex-1"
          />
          <Button type="submit" disabled={creating || !name.trim()}>
            {creating ? "Creando..." : "Crear"}
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="mb-3 font-medium text-slate-900">Materias</h2>
        {subjects === null ? (
          <div className="flex items-center gap-2 text-slate-500">
            <Spinner /> Cargando...
          </div>
        ) : subjects.length === 0 ? (
          <p className="text-sm text-slate-500">Aún no has creado ninguna materia.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="py-2 pr-4">Nombre</th>
                <th className="py-2 pr-4">Exámenes</th>
                <th className="py-2 pr-4">Estudiantes</th>
                <th className="py-2 pr-4"></th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((s) => (
                <Fragment key={s.id}>
                  <tr className="border-t border-slate-100">
                    <td className="py-2 pr-4">{s.name}</td>
                    <td className="py-2 pr-4">{s.examCount}</td>
                    <td className="py-2 pr-4">{s.studentCount}</td>
                    <td className="py-2 pr-4 text-right">
                      <div className="flex items-center justify-end gap-4">
                        <button
                          type="button"
                          onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                          className="text-sm text-brand-600 hover:underline"
                        >
                          {expandedId === s.id ? "Ocultar estudiantes" : "Agregar estudiantes"}
                        </button>
                        <button
                          type="button"
                          disabled={s.examCount > 0 || deletingId === s.id}
                          title={s.examCount > 0 ? "No se puede eliminar: tiene exámenes asociados" : undefined}
                          onClick={() => handleDelete(s.id)}
                          className="text-sm text-red-600 hover:underline disabled:cursor-not-allowed disabled:text-slate-300 disabled:no-underline"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedId === s.id && (
                    <tr>
                      <td colSpan={4} className="p-0">
                        <SubjectStudentsPanel subjectId={s.id} subjectName={s.name} onChanged={load} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
