"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { LogoutButton } from "@/components/admin/LogoutButton";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/admin/login";

  if (isLoginPage) {
    return <ToastProvider>{children}</ToastProvider>;
  }

  const navLinks = [
    { href: "/admin", label: "Exámenes" },
    { href: "/admin/subjects", label: "Materias" },
    { href: "/admin/students", label: "Estudiantes" },
  ];

  return (
    <ToastProvider>
      <div className="min-h-screen">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <div className="flex items-center gap-8">
              <Link href="/admin" className="text-lg font-semibold text-slate-900">
                Sistema de Evaluación
              </Link>
              <nav className="flex items-center gap-5 text-sm">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={
                      pathname === link.href
                        ? "font-medium text-brand-600"
                        : "text-slate-500 hover:text-slate-900"
                    }
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>
            <LogoutButton />
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
      </div>
    </ToastProvider>
  );
}
