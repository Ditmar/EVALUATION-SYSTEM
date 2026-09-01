"use client";

import { useRouter } from "next/navigation";
import { LogoutIcon } from "@/components/ui/icons";

export function LogoutButton({ className = "btn-secondary" }: { className?: string }) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <button type="button" onClick={handleLogout} className={className}>
      <LogoutIcon className="h-4 w-4" />
      Cerrar sesión
    </button>
  );
}
