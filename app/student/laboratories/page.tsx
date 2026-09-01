import { redirect } from "next/navigation";
import { getStudentSessionForPage } from "@/lib/auth/require-student";
import { StudentLaboratoriesList } from "@/components/student/StudentLaboratoriesList";

export default async function StudentLaboratoriesPage() {
  const session = await getStudentSessionForPage();
  if (!session) redirect("/student/login");

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Mis laboratorios</h1>
      <StudentLaboratoriesList />
    </div>
  );
}
