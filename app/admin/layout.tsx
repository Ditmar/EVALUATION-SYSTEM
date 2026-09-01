"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { CloseIcon, MenuIcon } from "@/components/ui/icons";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isLoginPage = pathname === "/admin/login";

  if (isLoginPage) {
    return <ToastProvider>{children}</ToastProvider>;
  }

  return (
    <ToastProvider>
      <div className="min-h-screen bg-slate-50 lg:pl-64">
        {/* Desktop sidebar — fixed, always visible at lg+ */}
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
          <AdminSidebar />
        </aside>

        {/* Mobile top bar — replaces the sidebar below the lg breakpoint */}
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-4 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
            aria-label="Abrir menú"
          >
            <MenuIcon className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold text-slate-900">Sistema de Evaluación</span>
        </header>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 bg-slate-900/60" onClick={() => setMobileOpen(false)} />
            <div className="absolute inset-y-0 left-0 w-72 shadow-popover">
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="absolute right-3 top-4 rounded-md p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
                aria-label="Cerrar menú"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
              <AdminSidebar onNavigate={() => setMobileOpen(false)} />
            </div>
          </div>
        )}

        <main className="mx-auto max-w-screen-2xl px-6 py-8 lg:px-10">{children}</main>
      </div>
    </ToastProvider>
  );
}
