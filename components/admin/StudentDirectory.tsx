"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/ToastProvider";

interface EnrollmentRow {
  id: string;
  ci: string;
  nombres: string;
  apellidos: string;
  correo: string | null;
  activated: boolean;
  mustChangePassword: boolean;
  subjectId: string;
  subjectName: string;
}

interface StudentEntry extends Omit<EnrollmentRow, "subjectId" | "subjectName"> {
  subjects: string[];
}

/** La API devuelve una fila por matrícula; aquí se agrupa por estudiante. */
function groupByStudent(rows: EnrollmentRow[]): StudentEntry[] {
  const byId = new Map<string, StudentEntry>();
  for (const { subjectId: _subjectId, subjectName, ...student } of rows) {
    const existing = byId.get(student.id);
    if (existing) existing.subjects.push(subjectName);
    else byId.set(student.id, { ...student, subjects: [subjectName] });
  }
  return [...byId.values()];
}

function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function StudentDirectory() {
  const { showToast } = useToast();
  const [students, setStudents] = useState<StudentEntry[] | null>(null);
  const [subjectFilter, setSubjectFilter] = useState("");
  const [query, setQuery] = useState("");
  const [confirming, setConfirming] = useState<StudentEntry | null>(null);
  const [resetting, setResetting] = useState(false);
  const [result, setResult] = useState<{ student: StudentEntry; password: string } | null>(null);

  async function load() {
    const res = await fetch("/api/admin/students");
    const data = await res.json().catch(() => ({}));
    setStudents(groupByStudent(data.students ?? []));
  }

  useEffect(() => {
    load();
  }, []);

  const subjects = useMemo(
    () => [...new Set((students ?? []).flatMap((s) => s.subjects))].sort((a, b) => a.localeCompare(b)),
    [students]
  );

  const filtered = useMemo(() => {
    if (!students) return [];
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    return students.filter((s) => {
      if (subjectFilter && !s.subjects.includes(subjectFilter)) return false;
      const haystack = normalize(`${s.ci} ${s.nombres} ${s.apellidos} ${s.correo ?? ""}`);
      return terms.every((t) => haystack.includes(t));
    });
  }, [students, query, subjectFilter]);

  async function handleReset() {
    if (!confirming) return;
    setResetting(true);
    try {
      const res = await fetch(`/api/admin/students/${confirming.id}/reset-password`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.temporaryPassword) {
        showToast(data.error ?? "No se pudo resetear la contraseña.", "error");
        return;
      }
      setResult({ student: confirming, password: data.temporaryPassword });
      setConfirming(null);
      await load();
    } finally {
      setResetting(false);
    }
  }

  async function handleCopy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      showToast("Copiado al portapapeles.", "success");
    } catch {
      showToast("No se pudo copiar; cópialo manualmente.", "error");
    }
  }

  return (
    <Card>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <Input
          type="search"
          placeholder="Buscar por CI, nombre, apellido o correo..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1"
        />
        <select className="input sm:w-56" value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}>
          <option value="">Todas las materias</option>
          {subjects.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      {students === null ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Cargando...
        </div>
      ) : students.length === 0 ? (
        <p className="text-sm text-slate-500">Todavía no hay estudiantes. Impórtalos desde la pestaña “Importar JSON”.</p>
      ) : (
        <>
          <p className="mb-2 text-xs text-slate-500">
            {filtered.length} de {students.length} estudiantes
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-slate-500">
                <tr>
                  <th className="py-2 pr-3">CI</th>
                  <th className="py-2 pr-3">Estudiante</th>
                  <th className="py-2 pr-3">Correo</th>
                  <th className="py-2 pr-3">Materias</th>
                  <th className="py-2 pr-3">Cuenta</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="border-t border-slate-100 align-top">
                    <td className="py-2 pr-3 font-mono text-xs">{s.ci}</td>
                    <td className="py-2 pr-3">
                      {s.apellidos}, {s.nombres}
                    </td>
                    <td className="py-2 pr-3 text-slate-500">{s.correo ?? "—"}</td>
                    <td className="py-2 pr-3 text-slate-600">{s.subjects.join(", ")}</td>
                    <td className="py-2 pr-3">
                      {s.mustChangePassword ? (
                        <Badge tone="yellow">Contraseña temporal</Badge>
                      ) : (
                        <Badge tone={s.activated ? "green" : "gray"}>{s.activated ? "Activada" : "Sin activar"}</Badge>
                      )}
                    </td>
                    <td className="py-2 text-right">
                      <Button variant="secondary" className="whitespace-nowrap" onClick={() => setConfirming(s)}>
                        Resetear contraseña
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Modal
        open={confirming !== null}
        title="Resetear contraseña"
        onClose={() => !resetting && setConfirming(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(null)} disabled={resetting}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={handleReset} disabled={resetting}>
              {resetting ? "Generando..." : "Generar contraseña temporal"}
            </Button>
          </>
        }
      >
        {confirming && (
          <p>
            Se generará una contraseña temporal para{" "}
            <strong>
              {confirming.nombres} {confirming.apellidos}
            </strong>{" "}
            (CI {confirming.ci}). Su contraseña actual dejará de funcionar y se cerrarán sus sesiones abiertas.
          </p>
        )}
      </Modal>

      <Modal
        open={result !== null}
        title="Contraseña temporal generada"
        onClose={() => setResult(null)}
        footer={<Button onClick={() => setResult(null)}>Listo</Button>}
      >
        {result && (
          <div className="space-y-3">
            <p>
              Entrega esta contraseña a{" "}
              <strong>
                {result.student.nombres} {result.student.apellidos}
              </strong>{" "}
              (CI {result.student.ci}):
            </p>
            <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-100 px-4 py-3">
              <span className="font-mono text-2xl font-semibold tracking-widest text-slate-900">{result.password}</span>
              <Button variant="secondary" onClick={() => handleCopy(result.password)}>
                Copiar
              </Button>
            </div>
            <p className="text-xs text-slate-500">
              Es de un solo uso: al ingresar con su CI y esta contraseña, el sistema le pedirá crear una nueva. No se
              volverá a mostrar; si se pierde, genera otra.
            </p>
          </div>
        )}
      </Modal>
    </Card>
  );
}
