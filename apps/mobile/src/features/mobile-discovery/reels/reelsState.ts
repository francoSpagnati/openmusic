import type { DiscoveryReelItem } from '@openmusic/shared';

/** Reel hidden with "Non fa per me", kept so it can be put back where it was. */
export interface HiddenReel {
  item: DiscoveryReelItem;
  index: number;
}

export interface ReelsState {
  items: DiscoveryReelItem[];
  /** Most recent last. Only the last one is offered for undo, but a stack keeps undo honest. */
  hidden: HiddenReel[];
}

export type ReelsAction =
  | { type: 'load'; items: DiscoveryReelItem[] }
  | { type: 'hide'; id: string }
  | { type: 'undoHide' };

export const initialReelsState: ReelsState = { items: [], hidden: [] };

const MAX_UNDO = 10;

export function reelsReducer(state: ReelsState, action: ReelsAction): ReelsState {
  switch (action.type) {
    case 'load':
      return { items: action.items, hidden: [] };
    case 'hide': {
      const index = state.items.findIndex((item) => item.id === action.id);
      const item = state.items[index];
      if (!item) return state;
      return {
        items: state.items.filter((_, i) => i !== index),
        hidden: [...state.hidden, { item, index }].slice(-MAX_UNDO),
      };
    }
    case 'undoHide': {
      const last = state.hidden[state.hidden.length - 1];
      if (!last) return state;
      const items = state.items.slice();
      items.splice(Math.min(last.index, items.length), 0, last.item);
      return { items, hidden: state.hidden.slice(0, -1) };
    }
  }
}
