import { SubjectManager } from "@/components/admin/SubjectManager";

export default function SubjectsPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Materias</h1>
      <SubjectManager />
    </div>
  );
}
