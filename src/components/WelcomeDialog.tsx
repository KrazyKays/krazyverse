import { Dialog } from './Dialog';
import { GraphLegend } from './graph';

interface WelcomeDialogProps {
  firstTime: boolean;
  onClose: () => void;
}

const STEPS = [
  {
    title: 'Lisez les récits',
    body: 'Cliquez sur un élément révélé de la toile pour lire son histoire dans le panneau de droite.',
  },
  {
    title: 'Levez les voiles',
    body: 'Les éléments marqués « ? » cachent une question. La réponse se trouve dans les récits déjà lus : un mot-clé suffit.',
  },
  {
    title: 'Voyagez entre les univers',
    body: 'Les noms traversent les univers. Une découverte dans l\'un en révèle souvent d\'autres ailleurs : un point lumineux vous le signale.',
  },
  {
    title: 'Rendez votre rapport',
    body: 'Les conclusions de la mission s\'assemblent dans le Bureau des Concordances. L\'onglet « Pistes » liste toutes les questions ouvertes.',
  },
];

export function WelcomeDialog({ firstTime, onClose }: WelcomeDialogProps) {
  return (
    <Dialog title={firstTime ? 'Bienvenue au Bureau des Concordances' : 'Comment jouer'} eyebrow="Krazyverse" wide onClose={onClose}>
      <p className="lead">
        Trois univers racontent la même histoire, celle du Petit Chaperon rouge, mais chacun obéit à sa propre Loi. Le
        Bureau vous charge de les arpenter pour répondre à une seule question :{' '}
        <em>à partir de quel moment un univers doit-il être déclaré défaillant ?</em>
      </p>
      <ol className="steps">
        {STEPS.map((step, index) => (
          <li key={step.title}>
            <span className="step-number" aria-hidden="true">
              {index + 1}
            </span>
            <div>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <GraphLegend inline />
      <div className="dialog-actions">
        <button type="button" className="primary" data-autofocus onClick={onClose}>
          {firstTime ? 'Commencer l\'arpentage' : 'Reprendre'}
        </button>
      </div>
    </Dialog>
  );
}
