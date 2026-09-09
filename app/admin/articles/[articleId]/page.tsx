import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getAdminSessionForPage } from "@/lib/auth/require-admin";
import { ArticleEditorForm } from "@/components/admin/ArticleEditorForm";
import { ArticleStatusBar } from "@/components/admin/ArticleStatusBar";

export default async function EditArticlePage({ params }: { params: { articleId: string } }) {
  const session = await getAdminSessionForPage();
  if (!session) notFound();

  const article = await prisma.article.findFirst({ where: { id: params.articleId, authorId: session.userId } });
  if (!article) notFound();

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold text-slate-900">{article.title}</h1>
      <ArticleStatusBar articleId={article.id} slug={article.slug} status={article.status} />
      <ArticleEditorForm
        initial={{ id: article.id, slug: article.slug, markdownSource: article.markdownSource, status: article.status }}
        authorName={session.name || session.email}
      />
    </div>
  );
}
