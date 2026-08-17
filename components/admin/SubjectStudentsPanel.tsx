"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/ToastProvider";

interface StudentRow {
  id: string;
  ci: string;
  nombres: string;
  apellidos: string;
  correo: string | null;
  activated: boolean;
}

/**
 * Adding a student here reuses POST /api/admin/students/import with a
 * single-entry array — same idempotent upsert-by-ci logic as the bulk JSON
 * importer, just with `materia` pre-filled to this subject's name so the
 * teacher doesn't have to type it (or risk a name mismatch, see the
 * "materia" strict-match caveat).
 */
export function SubjectStudentsPanel({
  subjectId,
  subjectName,
  onChanged,
}: {
  subjectId: string;
  subjectName: string;
  onChanged?: () => void;
}) {
  const { showToast } = useToast();
  const [students, setStudents] = useState<StudentRow[] | null>(null);
  const [ci, setCi] = useState("");
  const [nombres, setNombres] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [correo, setCorreo] = useState("");
  const [adding, setAdding] = useState(false);

  async function load() {
    const res = await fetch(`/api/admin/students?subjectId=${subjectId}`);
    const data = await res.json().catch(() => ({}));
    setStudents(data.students ?? []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectId]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!ci.trim() || !nombres.trim() || !apellidos.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/admin/students/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entries: [
            {
              ci: ci.trim(),
              nombres: nombres.trim(),
              apellidos: apellidos.trim(),
              ...(correo.trim() ? { correo: correo.trim() } : {}),
              materia: subjectName,
            },
          ],
        }),
      });
      const data = await res.json().catch(() => ({}));
      const row = data.results?.[0];

      if (!res.ok || !row || row.status === "error") {
        showToast(row?.error ?? data.error ?? "No se pudo agregar el estudiante.", "error");
        return;
      }

      setCi("");
      setNombres("");
      setApellidos("");
      setCorreo("");
      await load();
      onChanged?.();
      showToast(row.status === "created" ? "Estudiante agregado." : "Estudiante ya existía, matriculado en esta materia.", "success");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="space-y-3 border-t border-slate-100 bg-slate-50 p-4">
      <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-2">
        <div>
          <label className="label text-xs">CI</label>
          <Input value={ci} onChange={(e) => setCi(e.target.value)} className="w-32" />
        </div>
        <div className="min-w-[140px] flex-1">
          <label className="label text-xs">Nombres</label>
          <Input value={nombres} onChange={(e) => setNombres(e.target.value)} />
        </div>
        <div className="min-w-[140px] flex-1">
          <label className="label text-xs">Apellidos</label>
          <Input value={apellidos} onChange={(e) => setApellidos(e.target.value)} />
        </div>
        <div className="min-w-[160px] flex-1">
          <label className="label text-xs">Correo (opcional)</label>
          <Input type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} />
        </div>
        <Button type="submit" disabled={adding || !ci.trim() || !nombres.trim() || !apellidos.trim()}>
          {adding ? "Agregando..." : "Agregar"}
        </Button>
      </form>

      {students === null ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Cargando...
        </div>
      ) : students.length === 0 ? (
        <p className="text-sm text-slate-500">Todavía no hay estudiantes matriculados en esta materia.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="text-slate-500">
            <tr>
              <th className="py-1 pr-3">CI</th>
              <th className="py-1 pr-3">Nombres</th>
              <th className="py-1 pr-3">Apellidos</th>
              <th className="py-1 pr-3">Correo</th>
              <th className="py-1 pr-3">Cuenta</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id} className="border-t border-slate-200">
                <td className="py-1 pr-3">{s.ci}</td>
                <td className="py-1 pr-3">{s.nombres}</td>
                <td className="py-1 pr-3">{s.apellidos}</td>
                <td className="py-1 pr-3 text-slate-500">{s.correo ?? "—"}</td>
                <td className="py-1 pr-3">
                  <Badge tone={s.activated ? "green" : "gray"}>{s.activated ? "Activada" : "Sin activar"}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
