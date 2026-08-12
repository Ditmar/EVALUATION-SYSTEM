import { StudentImportForm } from "@/components/admin/StudentImportForm";

export default function StudentsPage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Estudiantes</h1>
      <StudentImportForm />
    </div>
  );
}
