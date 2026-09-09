import { ArticleEditorForm } from "@/components/admin/ArticleEditorForm";
import { getAdminSessionForPage } from "@/lib/auth/require-admin";

export default async function NewArticlePage() {
  const session = await getAdminSessionForPage();

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Nuevo artículo</h1>
      <ArticleEditorForm authorName={session?.name || session?.email || "Docente"} />
    </div>
  );
}
