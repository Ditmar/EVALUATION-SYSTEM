import Link from "next/link";
import { ExamList } from "@/components/admin/ExamList";
import { Button } from "@/components/ui/Button";

export default function AdminDashboardPage() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Mis exámenes</h1>
        <Link href="/admin/exams/new">
          <Button>+ Nuevo examen</Button>
        </Link>
      </div>
      <ExamList />
    </div>
  );
}
