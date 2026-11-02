import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
import type { NodeKind, Relation, StoryNode, TaleId, Universe } from '../domain/types';
import { KIND_LABELS, TALE_LABELS } from './labels';

export const VIEW_WIDTH = 1000;
export const VIEW_HEIGHT = 720;

export function onActivateKey(event: ReactKeyboardEvent<SVGGElement>, action: () => void) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    action();
  }
}

export function taleClass(tale: TaleId | undefined): string {
  return tale ? `node--tale-${tale}` : '';
}

export function NodeShape({ kind }: { kind: NodeKind }) {
  if (kind === 'character') {
    return <circle r={14} className="shape" />;
  }
  if (kind === 'place') {
    return <rect x={-12} y={-12} width={24} height={24} rx={3} className="shape" />;
  }
  return <polygon points="0,-16 16,0 0,16 -16,0" className="shape" />;
}

interface GraphEdgesProps {
  universe: Universe;
  relations: Relation[];
  selectedId: string | null;
}

export function GraphEdges({ universe, relations, selectedId }: GraphEdgesProps) {
  return (
    <g className="graph-edges">
      {relations.map((relation) => {
        const from = universe.nodeById.get(relation.from)?.position;
        const to = universe.nodeById.get(relation.to)?.position;
        if (!from || !to) return null;
        const active = relation.from === selectedId || relation.to === selectedId;
        return (
          <line
            key={relation.id}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            className={active ? 'edge edge--active' : 'edge'}
          />
        );
      })}
    </g>
  );
}

interface RevealedNodeProps {
  node: StoryNode;
  selected: boolean;
  unreachable?: boolean;
  badge?: string;
  /** Agrandit le nœud lorsque la toile est très dézoomée, pour garder son libellé lisible. */
  markScale?: number;
  onSelect: () => void;
  onClick?: () => void;
}

export function RevealedNode({
  node,
  selected,
  unreachable = false,
  badge,
  markScale = 1,
  onSelect,
  onClick = onSelect,
}: RevealedNodeProps) {
  const classes = ['node', 'node--revealed'];
  if (selected) classes.push('node--selected');
  if (unreachable) classes.push('node--unreachable');
  if (node.tale) classes.push(taleClass(node.tale));
  return (
    <g
      className={classes.join(' ')}
      transform={`translate(${node.position.x} ${node.position.y})`}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={node.title}
      onClick={onClick}
      onKeyDown={(event) => onActivateKey(event, onSelect)}
    >
      {/* Groupe distinct : .node impose transform-box: fill-box, qui décalerait l'origine de cette mise à l'échelle. */}
      <g transform={`scale(${markScale})`}>
        <NodeShape kind={node.kind} />
        <text className="node-label" textAnchor="middle" y={30}>
          {node.title}
        </text>
        {badge && (
          <text className="node-badge" x={20} y={-14} aria-hidden="true">
            {badge}
          </text>
        )}
      </g>
    </g>
  );
}

interface CensoredNodeProps {
  investigable: boolean;
  selected?: boolean;
}

/** Nœud voilé : « ? » quand une question est ouverte, « … » sinon. */
export function CensoredMark({ investigable, selected = false }: CensoredNodeProps) {
  return (
    <>
      {investigable && <circle r={20} className="pulse" />}
      <circle r={13} className={selected ? 'veil veil--selected' : 'veil'} />
      <text className="node-mark" textAnchor="middle" dominantBaseline="central">
        {investigable ? '?' : '…'}
      </text>
    </>
  );
}

const NODE_KINDS: NodeKind[] = ['character', 'place', 'event'];

interface GraphLegendProps {
  censored?: boolean;
  /** Légende intégrée au texte (aide) plutôt que superposée à la toile. */
  inline?: boolean;
  /** Contes présents sur la toile, signalés par leur couleur. */
  tales?: TaleId[];
  extra?: ReactNode;
}

export function GraphLegend({ censored = true, inline = false, tales = [], extra }: GraphLegendProps) {
  return (
    <ul className={inline ? 'graph-legend graph-legend--inline' : 'graph-legend'} aria-label="Légende de la toile">
      {NODE_KINDS.map((kind) => (
        <li key={kind}>
          <svg className="legend-icon" viewBox="-16 -16 32 32" aria-hidden="true">
            <g className="node">
              <NodeShape kind={kind} />
            </g>
          </svg>
          {KIND_LABELS[kind]}
        </li>
      ))}
      {censored && (
        <>
          <li>
            <svg className="legend-icon" viewBox="-22 -22 44 44" aria-hidden="true">
              <g className="node node--censored node--investigable">
                <CensoredMark investigable />
              </g>
            </svg>
            Question ouverte
          </li>
          <li>
            <svg className="legend-icon" viewBox="-16 -16 32 32" aria-hidden="true">
              <g className="node node--censored">
                <CensoredMark investigable={false} />
              </g>
            </svg>
            Voilé, piste à trouver
          </li>
        </>
      )}
      {tales.map((tale) => (
        <li key={tale}>
          <span className={`tale-swatch ${taleClass(tale)}`} aria-hidden="true" />
          {TALE_LABELS[tale]}
        </li>
      ))}
      {extra}
    </ul>
  );
}
