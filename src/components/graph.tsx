import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
import type { NodeKind, Relation, StoryNode, Universe } from '../domain/types';
import { KIND_LABELS } from './labels';

export const VIEW_WIDTH = 1000;
export const VIEW_HEIGHT = 720;

export function onActivateKey(event: ReactKeyboardEvent<SVGGElement>, action: () => void) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    action();
  }
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
  onSelect: () => void;
  onClick?: () => void;
}

export function RevealedNode({
  node,
  selected,
  unreachable = false,
  badge,
  onSelect,
  onClick = onSelect,
}: RevealedNodeProps) {
  const classes = ['node', 'node--revealed'];
  if (selected) classes.push('node--selected');
  if (unreachable) classes.push('node--unreachable');
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
  );
}

const NODE_KINDS: NodeKind[] = ['character', 'place', 'event'];

interface GraphLegendProps {
  censored?: boolean;
  extra?: ReactNode;
}

export function GraphLegend({ censored = true, extra }: GraphLegendProps) {
  return (
    <ul className="graph-legend" aria-label="Légende de la toile">
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
            <svg className="legend-icon" viewBox="-16 -16 32 32" aria-hidden="true">
              <g className="node node--censored">
                <circle r={12} />
                <text className="node-mark" textAnchor="middle" dominantBaseline="central">
                  ?
                </text>
              </g>
            </svg>
            Nœud censuré : une question le révèle
          </li>
          <li>
            <svg className="legend-icon" viewBox="-16 -16 32 32" aria-hidden="true">
              <g className="node node--censored">
                <circle r={12} />
                <text className="node-mark" textAnchor="middle" dominantBaseline="central">
                  ×
                </text>
              </g>
            </svg>
            Nœud censuré sans question
          </li>
        </>
      )}
      {extra}
    </ul>
  );
}
