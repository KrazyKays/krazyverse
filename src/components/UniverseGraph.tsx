import { useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import { visibilityFor, visibleRelationIds } from '../domain/visibility';
import type { GameState, Question, Universe } from '../domain/types';
import { GraphEdges, GraphLegend, onActivateKey, RevealedNode, VIEW_HEIGHT, VIEW_WIDTH } from './graph';

const MIN_SCALE = 0.5;
const MAX_SCALE = 2.5;
const DRAG_THRESHOLD = 4;

interface View {
  scale: number;
  tx: number;
  ty: number;
}

const INITIAL_VIEW: View = { scale: 1, tx: 0, ty: 0 };

interface UniverseGraphProps {
  universe: Universe;
  state: GameState;
  selectedId: string | null;
  questions: Question[];
  onSelect: (nodeId: string) => void;
  onDeselect: () => void;
  onOpenQuestion: (questionId: string) => void;
}

export function UniverseGraph({
  universe,
  state,
  selectedId,
  questions,
  onSelect,
  onDeselect,
  onOpenQuestion,
}: UniverseGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [view, setView] = useState<View>(INITIAL_VIEW);
  const dragRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const movedRef = useRef(false);

  const visibility = useMemo(() => visibilityFor(state, universe), [state, universe]);
  const relationIds = useMemo(() => visibleRelationIds(universe, visibility), [universe, visibility]);
  const investigationByNodeId = useMemo(
    () => new Map(questions.map((question) => [question.targetNodeId, question])),
    [questions],
  );

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const factor = event.deltaY < 0 ? 1.1 : 0.9;
      setView((current) => ({ ...current, scale: clampScale(current.scale * factor) }));
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, []);

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    dragRef.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    movedRef.current = false;
  };

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    const svg = svgRef.current;
    if (!drag || !svg) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!movedRef.current && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    if (!movedRef.current) {
      // Capturing on pointerdown would redirect the click to the svg and swallow node clicks.
      svg.setPointerCapture(drag.pointerId);
    }
    movedRef.current = true;
    drag.x = event.clientX;
    drag.y = event.clientY;
    const unit = Math.max(VIEW_WIDTH / svg.clientWidth, VIEW_HEIGHT / svg.clientHeight);
    setView((current) => ({ ...current, tx: current.tx + dx * unit, ty: current.ty + dy * unit }));
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  const onBackgroundClick = (event: ReactMouseEvent<SVGSVGElement>) => {
    if (movedRef.current) return;
    if ((event.target as Element).closest('.node')) return;
    onDeselect();
  };

  const zoomBy = (factor: number) => {
    setView((current) => ({ ...current, scale: clampScale(current.scale * factor) }));
  };

  const activate = (action: () => void) => {
    if (movedRef.current) return;
    action();
  };

  return (
    <div className="graph-wrapper">
      <svg
        ref={svgRef}
        className="graph"
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        role="group"
        aria-label={`Toile de l'univers ${universe.name}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={onBackgroundClick}
      >
        <g transform={`translate(${view.tx} ${view.ty}) scale(${view.scale})`}>
          <GraphEdges
            universe={universe}
            relations={universe.relations.filter((relation) => relationIds.has(relation.id))}
            selectedId={selectedId}
          />
          <g className="graph-nodes">
            {universe.nodes.map((node) => {
              const status = visibility.get(node.id) ?? 'hidden';
              if (status === 'hidden') return null;
              const { x, y } = node.position;

              if (status === 'censored') {
                const question = investigationByNodeId.get(node.id);
                const openInvestigation = question ? () => onOpenQuestion(question.id) : undefined;
                return (
                  <g
                    key={node.id}
                    className={question ? 'node node--censored node--investigable' : 'node node--censored'}
                    transform={`translate(${x} ${y})`}
                    aria-label={question ? 'Nœud censuré, question disponible' : 'Nœud censuré'}
                    role={question ? 'button' : 'img'}
                    tabIndex={question ? 0 : undefined}
                    onClick={openInvestigation && (() => activate(openInvestigation))}
                    onKeyDown={openInvestigation && ((event) => onActivateKey(event, openInvestigation))}
                  >
                    <circle r={12} />
                    <text className="node-mark" textAnchor="middle" dominantBaseline="central">
                      ?
                    </text>
                  </g>
                );
              }

              const select = () => onSelect(node.id);
              return (
                <RevealedNode
                  key={node.id}
                  node={node}
                  selected={node.id === selectedId}
                  onSelect={select}
                  onClick={() => activate(select)}
                />
              );
            })}
          </g>
        </g>
      </svg>

      <div className="graph-controls" role="toolbar" aria-label="Contrôles de la toile">
        <button type="button" onClick={() => zoomBy(1.2)} aria-label="Zoom avant">
          +
        </button>
        <button type="button" onClick={() => zoomBy(1 / 1.2)} aria-label="Zoom arrière">
          −
        </button>
        <button type="button" onClick={() => setView(INITIAL_VIEW)}>
          Recentrer
        </button>
      </div>

      <GraphLegend />
    </div>
  );
}

function clampScale(value: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
}
