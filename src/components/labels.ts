import type { NodeKind } from '../domain/types';

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

export const KIND_OPTIONS = (Object.keys(KIND_LABELS) as NodeKind[]).map((kind) => ({
  value: kind,
  label: KIND_LABELS[kind],
}));
