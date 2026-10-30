import { Dialog } from './Dialog';

interface EndingDialogProps {
  title: string;
  body: string;
  onRestart: () => void;
  onClose: () => void;
}

export function EndingDialog({ title, body, onRestart, onClose }: EndingDialogProps) {
  return (
    <Dialog title={title} eyebrow="Mission accomplie" wide onClose={onClose}>
      <div className="ending">
        <p className="ending-star" aria-hidden="true">
          ★
        </p>
        <p className="lead">{body}</p>
      </div>
      <div className="dialog-actions">
        <button type="button" onClick={onRestart}>
          Recommencer
        </button>
        <button type="button" className="primary" data-autofocus onClick={onClose}>
          Continuer à explorer
        </button>
      </div>
    </Dialog>
  );
}
