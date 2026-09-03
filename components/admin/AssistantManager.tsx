"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/ToastProvider";

interface Subject {
  id: string;
  name: string;
}

interface Assistant {
  id: string;
  email: string;
  name: string | null;
  active: boolean;
  subjects: Subject[];
}

function toggleSelected(set: Set<string>, id: string): Set<string> {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export function AssistantManager() {
  const { showToast } = useToast();
  const [assistants, setAssistants] = useState<Assistant[] | null>(null);
  const [subjects, setSubjects] = useState<Subject[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSubjectIds, setEditSubjectIds] = useState<Set<string>>(new Set());
  const [savingId, setSavingId] = useState<string | null>(null);

  async function loadAssistants() {
    const res = await fetch("/api/admin/assistants");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setLoadError(data.error ?? "No se pudo cargar la lista de ayudantes.");
      return;
    }
    setAssistants(data.assistants ?? []);
  }

  useEffect(() => {
    loadAssistants();
    fetch("/api/admin/subjects")
      .then((res) => res.json())
      .then((data) => setSubjects(data.subjects ?? []));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim() || selectedSubjectIds.size === 0) return;
    setCreating(true);
    try {
      const res = await fetch("/api/admin/assistants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim() || undefined,
          password,
          subjectIds: Array.from(selectedSubjectIds),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error ?? "No se pudo crear el ayudante.", "error");
        return;
      }
      setEmail("");
      setName("");
      setPassword("");
      setSelectedSubjectIds(new Set());
      await loadAssistants();
      showToast("Ayudante creado.", "success");
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleActive(assistant: Assistant) {
    setSavingId(assistant.id);
    try {
      const res = await fetch(`/api/admin/assistants/${assistant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !assistant.active }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error ?? "No se pudo actualizar el ayudante.", "error");
        return;
      }
      await loadAssistants();
      showToast(assistant.active ? "Ayudante desactivado." : "Ayudante activado.", "success");
    } finally {
      setSavingId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta cuenta de ayudante? Esta acción no se puede deshacer.")) return;
    setSavingId(id);
    try {
      const res = await fetch(`/api/admin/assistants/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error ?? "No se pudo eliminar el ayudante.", "error");
        return;
      }
      await loadAssistants();
      showToast("Ayudante eliminado.", "success");
    } finally {
      setSavingId(null);
    }
  }

  function startEditing(assistant: Assistant) {
    setEditingId(assistant.id);
    setEditSubjectIds(new Set(assistant.subjects.map((s) => s.id)));
  }

  async function handleSaveSubjects(assistantId: string) {
    if (editSubjectIds.size === 0) {
      showToast("Selecciona al menos una materia.", "error");
      return;
    }
    setSavingId(assistantId);
    try {
      const res = await fetch(`/api/admin/assistants/${assistantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectIds: Array.from(editSubjectIds) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error ?? "No se pudo actualizar las materias.", "error");
        return;
      }
      setEditingId(null);
      await loadAssistants();
      showToast("Materias actualizadas.", "success");
    } finally {
      setSavingId(null);
    }
  }

  if (loadError) {
    return <Card className="text-sm text-red-600">{loadError}</Card>;
  }

  if (assistants === null || subjects === null) {
    return (
      <div className="flex items-center gap-2 text-slate-500">
        <Spinner /> Cargando...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="mb-3 font-medium text-slate-900">Nuevo ayudante</h2>
        {subjects.length === 0 ? (
          <p className="text-sm text-slate-500">Crea primero una materia para poder asignarle un ayudante.</p>
        ) : (
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Correo" required />
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre (opcional)" />
            </div>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña temporal (mín. 8 caracteres)"
              minLength={8}
              required
            />
            <div>
              <p className="label mb-1">Materias que puede revisar</p>
              <div className="flex flex-wrap gap-3">
                {subjects.map((s) => (
                  <label key={s.id} className="flex items-center gap-1.5 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={selectedSubjectIds.has(s.id)}
                      onChange={() => setSelectedSubjectIds((prev) => toggleSelected(prev, s.id))}
                    />
                    {s.name}
                  </label>
                ))}
              </div>
            </div>
            <Button type="submit" disabled={creating || !email.trim() || !password.trim() || selectedSubjectIds.size === 0}>
              {creating ? "Creando..." : "Crear ayudante"}
            </Button>
          </form>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 font-medium text-slate-900">Ayudantes</h2>
        {assistants.length === 0 ? (
          <p className="text-sm text-slate-500">Aún no has creado ningún ayudante.</p>
        ) : (
          <ul className="space-y-3">
            {assistants.map((a) => (
              <li key={a.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900">{a.name || a.email}</p>
                    <p className="text-sm text-slate-500">{a.email}</p>
                  </div>
                  <Badge tone={a.active ? "green" : "gray"}>{a.active ? "Activo" : "Inactivo"}</Badge>
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {a.subjects.map((s) => (
                    <Badge key={s.id} tone="blue">
                      {s.name}
                    </Badge>
                  ))}
                </div>

                {editingId === a.id ? (
                  <div className="mt-3 space-y-2 rounded-lg bg-slate-50 p-3">
                    <div className="flex flex-wrap gap-3">
                      {subjects.map((s) => (
                        <label key={s.id} className="flex items-center gap-1.5 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={editSubjectIds.has(s.id)}
                            onChange={() => setEditSubjectIds((prev) => toggleSelected(prev, s.id))}
                          />
                          {s.name}
                        </label>
                      ))}
                    </div>
                    <div className="flex gap-3">
                      <Button onClick={() => handleSaveSubjects(a.id)} disabled={savingId === a.id}>
                        Guardar
                      </Button>
                      <Button variant="secondary" onClick={() => setEditingId(null)} disabled={savingId === a.id}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex items-center gap-4 text-sm">
                    <button type="button" className="text-brand-600 hover:underline" onClick={() => startEditing(a)}>
                      Editar materias
                    </button>
                    <button
                      type="button"
                      className="text-brand-600 hover:underline disabled:text-slate-300"
                      disabled={savingId === a.id}
                      onClick={() => handleToggleActive(a)}
                    >
                      {a.active ? "Desactivar" : "Activar"}
                    </button>
                    <button
                      type="button"
                      className="text-red-600 hover:underline disabled:text-slate-300"
                      disabled={savingId === a.id}
                      onClick={() => handleDelete(a.id)}
                    >
                      Eliminar
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
