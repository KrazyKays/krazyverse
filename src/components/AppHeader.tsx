interface AppHeaderProps {
  solved: number;
  total: number;
  ended: boolean;
  onOpenJournal: () => void;
  onOpenHelp: () => void;
  onOpenEnding: () => void;
  onReset: () => void;
  onOpenSetup?: () => void;
}

export function AppHeader({
  solved,
  total,
  ended,
  onOpenJournal,
  onOpenHelp,
  onOpenEnding,
  onReset,
  onOpenSetup,
}: AppHeaderProps) {
  const percent = total === 0 ? 0 : Math.round((solved / total) * 100);

  return (
    <header className="app-header">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          ✦
        </span>
        <div>
          <h1>Krazyverse</h1>
          <p className="brand-sub">Bureau des Concordances</p>
        </div>
      </div>

      <div className="mission" aria-live="polite">
        <div className="mission-label">
          <span>Mission</span>
          <span className="mission-count">
            {ended ? 'Rapport rendu' : `${solved} / ${total} conclusions`}
          </span>
        </div>
        <div
          className="progress"
          role="progressbar"
          aria-label="Avancement de la mission"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={solved}
        >
          <span className="progress-fill" style={{ width: `${percent}%` }} />
        </div>
        {ended && (
          <button type="button" className="link" onClick={onOpenEnding}>
            Relire le rapport final
          </button>
        )}
      </div>

      <nav className="header-actions" aria-label="Actions">
        <button type="button" onClick={onOpenJournal}>
          Journal
        </button>
        <button type="button" onClick={onOpenHelp}>
          Aide
        </button>
        <button type="button" className="ghost" onClick={onReset}>
          Recommencer
        </button>
        {onOpenSetup && (
          <button type="button" className="ghost" onClick={onOpenSetup}>
            Setup
          </button>
        )}
      </nav>
    </header>
  );
}
