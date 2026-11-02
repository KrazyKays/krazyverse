import { useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, RefObject } from 'react';
import { visibilityFor, visibleRelationIds } from '../domain/visibility';
import type { GameState, Question, Universe } from '../domain/types';
import { CensoredMark, GraphEdges, GraphLegend, onActivateKey, RevealedNode, taleClass, VIEW_HEIGHT, VIEW_WIDTH } from './graph';

const MIN_SCALE = 0.5;
const MAX_SCALE = 2.5;
const DRAG_THRESHOLD = 4;

interface View {
  scale: number;
  tx: number;
  ty: number;
}

const INITIAL_VIEW: View = { scale: 1, tx: 0, ty: 0 };

/** Portion de la toile cadrée par le viewBox, en coordonnées des nœuds. */
interface Frame {
  x: number;
  y: number;
  w: number;
  h: number;
}

const FRAME_PADDING = 80;
/** Marge du bas : la légende est superposée à la toile et ne doit pas masquer de nœud. */
const FRAME_BOTTOM_PADDING = 250;
const MIN_FRAME_WIDTH = 720;
const FRAME_ANIMATION_MS = 450;
/** En dessous de cette échelle (pixels par unité de toile), les nœuds sont agrandis pour rester lisibles. */
const READABLE_PIXELS_PER_UNIT = 0.72;

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
  const paneSize = usePaneSize(svgRef);
  const paneRatio = paneSize.width > 0 && paneSize.height > 0 ? paneSize.width / paneSize.height : VIEW_WIDTH / VIEW_HEIGHT;
  const visibleNodes = useMemo(
    () => universe.nodes.filter((node) => visibility.get(node.id) !== 'hidden'),
    [universe, visibility],
  );
  const targetFrame = useMemo(
    () => fitFrame(visibleNodes.map((node) => node.position), paneRatio),
    [visibleNodes, paneRatio],
  );
  const frame = useAnimatedFrame(targetFrame);
  const pixelsPerUnit = Math.min(paneSize.width / frame.w, paneSize.height / frame.h);
  const markScale = pixelsPerUnit > 0 ? Math.max(1, READABLE_PIXELS_PER_UNIT / pixelsPerUnit) : 1;
  const tales = useMemo(
    () => (['chaperon', 'poucet', 'commun'] as const).filter((tale) => visibleNodes.some((node) => node.tale === tale)),
    [visibleNodes],
  );
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
      const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(svg.getScreenCTM()?.inverse());
      setView((current) => zoomAround(current, event.deltaY < 0 ? 1.1 : 1 / 1.1, point.x, point.y));
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
    const unit = Math.max(frame.w / svg.clientWidth, frame.h / svg.clientHeight);
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
    setView((current) => zoomAround(current, factor, frame.x + frame.w / 2, frame.y + frame.h / 2));
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
        viewBox={`${frame.x} ${frame.y} ${frame.w} ${frame.h}`}
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
                const action = question ? () => onOpenQuestion(question.id) : () => onSelect(node.id);
                const classes = ['node', 'node--censored'];
                if (question) classes.push('node--investigable');
                if (node.tale) classes.push(taleClass(node.tale));
                return (
                  <g
                    key={node.id}
                    className={classes.join(' ')}
                    transform={`translate(${x} ${y})`}
                    aria-label={question ? 'Élément voilé : question ouverte' : 'Élément voilé'}
                    role="button"
                    tabIndex={0}
                    onClick={() => activate(action)}
                    onKeyDown={(event) => onActivateKey(event, action)}
                  >
                    <g transform={`scale(${markScale})`}>
                      <CensoredMark investigable={question !== undefined} selected={node.id === selectedId} />
                    </g>
                  </g>
                );
              }

              const select = () => onSelect(node.id);
              return (
                <RevealedNode
                  key={node.id}
                  node={node}
                  selected={node.id === selectedId}
                  markScale={markScale}
                  onSelect={select}
                  onClick={() => activate(select)}
                />
              );
            })}
          </g>
        </g>
      </svg>

      <div className="graph-controls" role="toolbar" aria-label="Contrôles de la toile">
        <button type="button" onClick={() => zoomBy(1.2)} aria-label="Zoom avant" title="Zoom avant">
          +
        </button>
        <button type="button" onClick={() => zoomBy(1 / 1.2)} aria-label="Zoom arrière" title="Zoom arrière">
          −
        </button>
        <button type="button" onClick={() => setView(INITIAL_VIEW)} aria-label="Recentrer la toile" title="Recentrer">
          ⌖
        </button>
      </div>

      <GraphLegend tales={tales} />
    </div>
  );
}

function clampScale(value: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
}

/** Zoome en gardant fixe le point (x, y) exprimé en coordonnées de la toile. */
function zoomAround(view: View, factor: number, x: number, y: number): View {
  const scale = clampScale(view.scale * factor);
  const ratio = scale / view.scale;
  return { scale, tx: x - (x - view.tx) * ratio, ty: y - (y - view.ty) * ratio };
}

/** Cadre englobant les nœuds visibles, aux proportions de la zone d'affichage. */
function fitFrame(points: { x: number; y: number }[], ratio: number): Frame {
  if (points.length === 0) return { x: 0, y: 0, w: VIEW_WIDTH, h: VIEW_HEIGHT };
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs) - FRAME_PADDING;
  const minY = Math.min(...ys) - FRAME_PADDING;
  let w = Math.max(Math.max(...xs) + FRAME_PADDING - minX, MIN_FRAME_WIDTH);
  const maxY = Math.max(...ys) + FRAME_BOTTOM_PADDING;
  let h = maxY - minY;
  if (w / h < ratio) w = h * ratio;
  else h = w / ratio;
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (minY + maxY) / 2;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

function usePaneSize(ref: RefObject<SVGSVGElement | null>): { width: number; height: number } {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    const measure = () => setSize({ width: svg.clientWidth, height: svg.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(svg);
    return () => observer.disconnect();
  }, [ref]);

  return size;
}

function useAnimatedFrame(target: Frame): Frame {
  const [frame, setFrame] = useState(target);
  const frameRef = useRef(frame);
  frameRef.current = frame;

  useEffect(() => {
    const from = frameRef.current;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setFrame(target);
      return;
    }
    const start = performance.now();
    let handle = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / FRAME_ANIMATION_MS);
      const eased = 1 - (1 - t) ** 3;
      const mix = (a: number, b: number) => a + (b - a) * eased;
      setFrame({ x: mix(from.x, target.x), y: mix(from.y, target.y), w: mix(from.w, target.w), h: mix(from.h, target.h) });
      if (t < 1) handle = requestAnimationFrame(step);
    };
    handle = requestAnimationFrame(step);
    return () => cancelAnimationFrame(handle);
  }, [target]);

  return frame;
}
