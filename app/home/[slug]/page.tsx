import { notFound } from "next/navigation";
import { getPublishedArticleBySlug } from "@/lib/blog/queries";
import { getStudentSessionForPage } from "@/lib/auth/require-student";
import { getAdminSessionForPage } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import { Avatar } from "@/components/blog/Avatar";
import { ArticleContent } from "@/components/blog/ArticleContent";
import { TableOfContents } from "@/components/blog/TableOfContents";
import { ApplauseButton } from "@/components/blog/ApplauseButton";
import { ShareButton } from "@/components/blog/ShareButton";
import { CommentSection } from "@/components/blog/CommentSection";

function formatDate(date: Date | null): string {
  if (!date) return "";
  return date.toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" });
}

export default async function ArticlePage({ params }: { params: { slug: string } }) {
  const article = await getPublishedArticleBySlug(params.slug);
  if (!article) notFound();

  const [studentSession, adminSession] = await Promise.all([getStudentSessionForPage(), getAdminSessionForPage()]);

  let commenterName: string | undefined;
  if (studentSession) {
    const student = await prisma.student.findUnique({
      where: { id: studentSession.studentId },
      select: { nombres: true, apellidos: true },
    });
    commenterName = student ? `${student.nombres} ${student.apellidos}`.trim() : undefined;
  } else if (adminSession) {
    commenterName = adminSession.name || adminSession.email;
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <header className="mb-8 max-w-3xl sm:mb-10">
        {article.tags.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {article.tags.map((tag) => (
              <span key={tag} className="text-sm font-semibold uppercase tracking-wide text-brand-700">
                {tag}
              </span>
            ))}
          </div>
        )}
        <h1 className="font-serif text-3xl font-bold leading-tight tracking-tight text-slate-900 sm:text-4xl">{article.title}</h1>
        <div className="mt-6 flex items-center gap-3">
          <Avatar name={article.authorName} />
          <div>
            <p className="text-base font-medium text-slate-900">{article.authorName}</p>
            <p className="text-sm text-slate-500 sm:text-base">
              {formatDate(article.publishedAt)} · {article.readingTimeMinutes} min de lectura
            </p>
          </div>
        </div>
        <div className="mt-6 flex items-center gap-3">
          <ApplauseButton slug={article.slug} initialTotal={article.applauseCount} />
          <ShareButton title={article.title} />
        </div>
      </header>

      <div className="grid gap-10 lg:grid-cols-[1fr_220px]">
        <div className="min-w-0 max-w-3xl">
          <ArticleContent content={article.definition.content} headings={article.definition.headings} />
          <CommentSection slug={article.slug} canComment={Boolean(commenterName)} commenterName={commenterName} />
        </div>
        <TableOfContents headings={article.definition.headings} />
      </div>
    </main>
  );
}
