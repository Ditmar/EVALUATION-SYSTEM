export type AutosaveState = "idle" | "saving" | "saved" | "error";

export function AutosaveIndicator({ state }: { state: AutosaveState }) {
  if (state === "idle") return null;

  const label = state === "saving" ? "Guardando..." : state === "saved" ? "Guardado" : "Error al guardar";
  const tone = state === "error" ? "text-red-600" : "text-slate-400";

  return <span className={`text-xs ${tone}`}>{label}</span>;
}
