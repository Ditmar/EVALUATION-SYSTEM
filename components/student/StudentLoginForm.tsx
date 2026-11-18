"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { StudentSetNewPasswordForm } from "@/components/student/StudentSetNewPasswordForm";

export function StudentLoginForm({ onSuccess }: { onSuccess: () => void }) {
  const [ci, setCi] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/student/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ci, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "No se pudo iniciar sesión.");
        return;
      }
      if (data.mustChangePassword) {
        setMustChangePassword(true);
        return;
      }
      onSuccess();
    } finally {
      setLoading(false);
    }
  }

  if (mustChangePassword) {
    return (
      <StudentSetNewPasswordForm
        ci={ci}
        temporaryPassword={password}
        onSuccess={onSuccess}
        onCancel={() => {
          setMustChangePassword(false);
          setPassword("");
        }}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label" htmlFor="login-ci">
          Carnet de identidad
        </label>
        <Input id="login-ci" required value={ci} onChange={(e) => setCi(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="login-password">
          Contraseña
        </label>
        <Input
          id="login-password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Ingresando..." : "Ingresar"}
      </Button>
      <p className="text-center text-xs text-slate-500">
        ¿Olvidaste tu contraseña? Pide a tu docente una contraseña temporal e ingrésala aquí.
      </p>
    </form>
  );
}
