"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

/**
 * Se muestra tras ingresar con una contraseña temporal (reseteada por el
 * docente). Consume la temporal y deja al estudiante con sesión iniciada.
 */
export function StudentSetNewPasswordForm({
  ci,
  temporaryPassword,
  onSuccess,
  onCancel,
}: {
  ci: string;
  temporaryPassword: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/student/auth/complete-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ci, temporaryPassword, newPassword: password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "No se pudo guardar la nueva contraseña.");
        return;
      }
      onSuccess();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
        Ingresaste con una contraseña temporal. Crea una contraseña nueva para continuar; la temporal dejará de
        funcionar.
      </div>
      <div>
        <label className="label" htmlFor="reset-password">
          Nueva contraseña
        </label>
        <Input
          id="reset-password"
          type="password"
          required
          minLength={8}
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div>
        <label className="label" htmlFor="reset-confirm">
          Confirmar contraseña
        </label>
        <Input
          id="reset-confirm"
          type="password"
          required
          minLength={8}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Guardando..." : "Guardar y entrar"}
      </Button>
      <button type="button" onClick={onCancel} className="w-full text-center text-sm text-slate-500 hover:underline">
        Volver
      </button>
    </form>
  );
}
