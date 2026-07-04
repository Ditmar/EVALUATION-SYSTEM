import { ExamResultLookup } from "@/components/student/ExamResultLookup";

export default function ExamResultPage({ params }: { params: { token: string } }) {
  return <ExamResultLookup token={params.token} />;
}
