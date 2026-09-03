import { AssistantManager } from "@/components/admin/AssistantManager";

export default function AssistantsPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Ayudantes</h1>
      <AssistantManager />
    </div>
  );
}
