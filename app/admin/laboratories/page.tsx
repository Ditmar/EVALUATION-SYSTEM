import Link from "next/link";
import { LaboratoryList } from "@/components/admin/LaboratoryList";
import { Button } from "@/components/ui/Button";

export default function AdminLaboratoriesPage() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Mis laboratorios</h1>
        <Link href="/admin/laboratories/new">
          <Button>+ Nuevo laboratorio</Button>
        </Link>
      </div>
      <LaboratoryList />
    </div>
  );
}
