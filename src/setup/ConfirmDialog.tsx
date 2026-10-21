import { Dialog } from '../components/Dialog';

export interface ConfirmRequest {
  title: string;
  lines: string[];
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
}

interface ConfirmDialogProps {
  request: ConfirmRequest;
  onClose: () => void;
}

export function ConfirmDialog({ request, onClose }: ConfirmDialogProps) {
  const cancel = () => {
    request.onCancel?.();
    onClose();
  };
  const confirm = () => {
    onClose();
    request.onConfirm();
  };

  return (
    <Dialog title={request.title} onClose={cancel}>
      {request.lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
      <div className="dialog-actions">
        <button type="button" autoFocus onClick={cancel}>
          Annuler
        </button>
        <button type="button" className={request.danger ? 'danger' : 'primary'} onClick={confirm}>
          {request.confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}
