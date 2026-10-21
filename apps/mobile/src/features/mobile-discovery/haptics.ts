import * as Haptics from 'expo-haptics';

/**
 * Fire-and-forget haptics for the discovery screens. They never throw (simulators and devices
 * with haptics disabled reject the promise) and never block the UI.
 */
export const haptics = {
  /** Light tick: play/pause, reaction, chip. */
  tap(): void {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  },
  /** Selection change: segmented control, genre chip, reel snapped into place. */
  select(): void {
    Haptics.selectionAsync().catch(() => undefined);
  },
  /** Heavier thud: roulette lands, undo. */
  thud(): void {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
  },
  success(): void {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  },
  error(): void {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
  },
};
