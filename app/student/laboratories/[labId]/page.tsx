import { redirect } from "next/navigation";
import { getStudentSessionForPage } from "@/lib/auth/require-student";
import { LaboratoryAttempt } from "@/components/student/LaboratoryAttempt";

export default async function StudentLaboratoryPage({ params }: { params: { labId: string } }) {
  const session = await getStudentSessionForPage();
  if (!session) redirect("/student/login");

  return <LaboratoryAttempt labId={params.labId} />;
}
