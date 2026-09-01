"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function StudentLogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/student/auth/logout", { method: "POST" });
    router.push("/student/login");
    router.refresh();
  }

  return (
    <Button variant="secondary" onClick={handleLogout}>
      Cerrar sesión
    </Button>
  );
}
