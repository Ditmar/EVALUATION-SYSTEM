"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/ToastProvider";
import {
  ScreenCaptureSettingsFields,
  type ScreenCaptureSettingsValue,
} from "@/components/admin/ScreenCaptureSettingsFields";

/** Edita la captura de pantalla de un examen ya creado (sección Supervisión del detalle). */
export function ScreenCaptureToggle({ examId, initialValue }: { examId: string; initialValue: ScreenCaptureSettingsValue }) {
  const [saved, setSaved] = useState(initialValue);
  const [value, setValue] = useState(initialValue);
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  const dirty =
    value.requireScreenCapture !== saved.requireScreenCapture ||
    value.screenCaptureIntervalMinutes !== saved.screenCaptureIntervalMinutes;

  async function save() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/exams/${examId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(value),
      });
      if (!res.ok) {
        showToast("No se pudo guardar la configuración de captura.", "error");
        return;
      }
      setSaved(value);
      showToast("Configuración de captura guardada.", "success");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <ScreenCaptureSettingsFields value={value} onChange={setValue} disabled={loading} />
      <p className="text-xs text-slate-500">Los cambios aplican a quienes carguen el examen después de guardar.</p>
      {dirty && (
        <Button onClick={save} disabled={loading}>
          {loading ? "Guardando..." : "Guardar cambios"}
        </Button>
      )}
    </div>
  );
}
