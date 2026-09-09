import Link from "next/link";
import { ArticleList } from "@/components/admin/ArticleList";
import { Button } from "@/components/ui/Button";

export default function AdminArticlesPage() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Mis artículos</h1>
        <Link href="/admin/articles/new">
          <Button>+ Nuevo artículo</Button>
        </Link>
      </div>
      <ArticleList />
    </div>
  );
}
