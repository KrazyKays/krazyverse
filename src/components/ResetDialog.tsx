import { Dialog } from './Dialog';

interface ResetDialogProps {
  onConfirm: () => void;
  onClose: () => void;
}

export function ResetDialog({ onConfirm, onClose }: ResetDialogProps) {
  return (
    <Dialog title="Réinitialiser la progression" onClose={onClose}>
      <p>
        Toutes les découvertes, enquêtes et échos seront effacés de ce navigateur. Cette action est irréversible.
      </p>
      <div className="dialog-actions">
        <button type="button" onClick={onClose}>
          Annuler
        </button>
        <button type="button" className="danger" onClick={onConfirm}>
          Réinitialiser
        </button>
      </div>
    </Dialog>
  );
}
