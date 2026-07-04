import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

export function FinalizeExamDialog({
  open,
  answeredCount,
  totalCount,
  onConfirm,
  onCancel,
  submitting,
}: {
  open: boolean;
  answeredCount: number;
  totalCount: number;
  onConfirm: () => void;
  onCancel: () => void;
  submitting: boolean;
}) {
  return (
    <Modal
      open={open}
      title="Confirmar envío del examen"
      onClose={onCancel}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} disabled={submitting}>
            {submitting ? "Enviando..." : "Sí, finalizar examen"}
          </Button>
        </>
      }
    >
      <p>
        Has respondido {answeredCount} de {totalCount} preguntas. Una vez enviado el examen no podrás
        modificar tus respuestas. ¿Deseas continuar?
      </p>
    </Modal>
  );
}
