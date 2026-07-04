import { ExamImportForm } from "@/components/admin/ExamImportForm";

export default function NewExamPage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Importar nuevo examen</h1>
      <ExamImportForm />
    </div>
  );
}
