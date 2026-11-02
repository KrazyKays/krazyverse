import type { NodeKind, TaleId } from '../domain/types';

export const KIND_LABELS: Record<NodeKind, string> = {
  character: 'Personnage',
  place: 'Lieu',
  event: 'Événement',
};

export const KIND_INDEFINITE: Record<NodeKind, string> = {
  character: 'un personnage',
  place: 'un lieu',
  event: 'un événement',
};

export const TALE_LABELS: Record<TaleId, string> = {
  chaperon: 'Le Petit Chaperon rouge',
  poucet: 'Le Petit Poucet',
  commun: 'Commun aux contes',
};

export const TALE_OPTIONS = (Object.keys(TALE_LABELS) as TaleId[]).map((tale) => ({
  value: tale,
  label: TALE_LABELS[tale],
}));

export const KIND_OPTIONS = (Object.keys(KIND_LABELS) as NodeKind[]).map((kind) => ({
  value: kind,
  label: KIND_LABELS[kind],
}));
