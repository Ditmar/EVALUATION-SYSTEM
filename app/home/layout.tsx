import Link from "next/link";

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/home" className="font-serif text-xl font-bold tracking-tight text-slate-900">
            Blog
          </Link>
          <Link href="/admin/login" className="text-sm text-slate-400 hover:text-slate-600">
            Acceso docente
          </Link>
        </div>
      </header>
      {children}
      <footer className="mx-auto max-w-5xl px-4 py-10 text-center text-xs text-slate-400 sm:px-6">
        Sistema de Evaluación — Blog
      </footer>
    </div>
  );
}
