"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AssistantIcon, ExamIcon, LabIcon, StudentsIcon, SubjectIcon } from "@/components/ui/icons";
import { LogoutButton } from "@/components/admin/LogoutButton";

type Role = "TEACHER" | "ASSISTANT";

const TEACHER_NAV_ITEMS = [
  { href: "/admin", label: "Exámenes", icon: ExamIcon, match: (p: string) => p === "/admin" || p.startsWith("/admin/exams") },
  { href: "/admin/laboratories", label: "Laboratorios", icon: LabIcon, match: (p: string) => p.startsWith("/admin/laboratories") },
  { href: "/admin/subjects", label: "Materias", icon: SubjectIcon, match: (p: string) => p.startsWith("/admin/subjects") },
  { href: "/admin/students", label: "Estudiantes", icon: StudentsIcon, match: (p: string) => p.startsWith("/admin/students") },
  { href: "/admin/assistants", label: "Ayudantes", icon: AssistantIcon, match: (p: string) => p.startsWith("/admin/assistants") },
];

// An ASSISTANT only ever reviews/grades laboratory submissions — everything
// else (Exámenes, Materias, Estudiantes, Ayudantes) is TEACHER-only, and the
// backend already enforces that; this is just so the menu doesn't dangle
// links to pages the assistant can't do anything on.
const ASSISTANT_NAV_ITEMS = [
  { href: "/admin/laboratories", label: "Laboratorios", icon: LabIcon, match: (p: string) => p.startsWith("/admin/laboratories") },
];

export function AdminSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const [role, setRole] = useState<Role | null>(null);

  useEffect(() => {
    fetch("/api/admin/auth/me")
      .then((res) => res.json())
      .then((data) => setRole(data.role ?? null))
      .catch(() => setRole(null));
  }, []);

  // Defaults to the smaller ASSISTANT menu while `role` is still loading (or
  // failed to load, e.g. a deactivated account's session) — briefly hiding
  // TEACHER-only items until confirmed is preferable to briefly flashing them.
  const navItems = role === "TEACHER" ? TEACHER_NAV_ITEMS : ASSISTANT_NAV_ITEMS;

  return (
    <div className="flex h-full flex-col bg-ink-900">
      <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-white/10 px-5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
          SE
        </div>
        <span className="truncate text-sm font-semibold text-white">Sistema de Evaluación</span>
      </div>

      <nav className="scrollbar-thin flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map((item) => {
          const active = item.match(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-3">
        <div className="mb-2 flex items-center gap-2.5 rounded-lg px-2 py-1.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white">
            D
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{role === "ASSISTANT" ? "Ayudante" : "Docente"}</p>
            <p className="truncate text-xs text-slate-500">Panel administrativo</p>
          </div>
        </div>
        <LogoutButton className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-400 transition-colors hover:bg-white/5 hover:text-white" />
      </div>
    </div>
  );
}
