"use client";

import { SCREEN_CAPTURE_INTERVAL_MAX, SCREEN_CAPTURE_INTERVAL_MIN } from "@/lib/validation/exam-schema";

const PRESETS = [1, 2, 5] as const;

export interface ScreenCaptureSettingsValue {
  requireScreenCapture: boolean;
  screenCaptureIntervalMinutes: number;
}

/**
 * Casilla "Requerir captura de pantalla" + intervalo (1, 2, 5 minutos u
 * otro valor). Controlado: lo usan el formulario de creación del examen y
 * la sección de Supervisión del detalle.
 */
export function ScreenCaptureSettingsFields({
  value,
  onChange,
  disabled,
}: {
  value: ScreenCaptureSettingsValue;
  onChange: (value: ScreenCaptureSettingsValue) => void;
  disabled?: boolean;
}) {
  const isPreset = (PRESETS as readonly number[]).includes(value.screenCaptureIntervalMinutes);

  function setInterval(minutes: number) {
    onChange({ ...value, screenCaptureIntervalMinutes: minutes });
  }

  return (
    <div className="space-y-3">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          className="mt-1"
          checked={value.requireScreenCapture}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, requireScreenCapture: e.target.checked })}
        />
        <span>
          <span className="font-medium text-slate-900">Requerir captura de pantalla</span>
          <span className="block text-xs text-slate-500">
            El estudiante debe compartir su pantalla completa. Solo funciona en computadoras (Chrome, Edge o Firefox).
          </span>
        </span>
      </label>

      {value.requireScreenCapture && (
        <div className="ml-7">
          <p className="mb-2 text-sm text-slate-700">Tomar una captura cada:</p>
          <div className="flex flex-wrap items-center gap-2">
            {PRESETS.map((m) => (
              <button
                key={m}
                type="button"
                disabled={disabled}
                onClick={() => setInterval(m)}
                className={`rounded-lg border px-3 py-1.5 text-sm ${
                  value.screenCaptureIntervalMinutes === m
                    ? "border-brand-600 bg-brand-50 font-medium text-brand-700"
                    : "border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                {m} min
              </button>
            ))}
            <span
              className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-sm ${
                !isPreset ? "border-brand-600 bg-brand-50" : "border-slate-200"
              }`}
            >
              <span className="text-slate-600">Otro:</span>
              <input
                type="number"
                min={SCREEN_CAPTURE_INTERVAL_MIN}
                max={SCREEN_CAPTURE_INTERVAL_MAX}
                step={1}
                disabled={disabled}
                value={value.screenCaptureIntervalMinutes}
                onChange={(e) => {
                  const n = Math.round(Number(e.target.value));
                  if (Number.isFinite(n)) {
                    setInterval(Math.min(SCREEN_CAPTURE_INTERVAL_MAX, Math.max(SCREEN_CAPTURE_INTERVAL_MIN, n)));
                  }
                }}
                className="w-16 rounded border border-slate-200 px-1.5 py-0.5 text-sm"
              />
              <span className="text-slate-600">min</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
