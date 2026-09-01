"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { StudentLogoutButton } from "@/components/student/StudentLogoutButton";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/student/login";

  if (isLoginPage) {
    return <ToastProvider>{children}</ToastProvider>;
  }

  return (
    <ToastProvider>
      <div className="min-h-screen">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
            <Link href="/student/laboratories" className="text-lg font-semibold text-slate-900">
              Laboratorios
            </Link>
            <StudentLogoutButton />
          </div>
        </header>
        <main className="mx-auto max-w-3xl px-4 py-8">{children}</main>
      </div>
    </ToastProvider>
  );
}
