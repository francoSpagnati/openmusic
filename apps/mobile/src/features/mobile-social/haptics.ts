import * as Haptics from 'expo-haptics';

/**
 * Fire-and-forget haptics. They never throw (simulators, web and devices with haptics disabled
 * reject the promise) and never block the UI.
 */
export const haptics = {
  /** Light tick for toggles and taps (like, reaction, ghost toggle). */
  tap(): void {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  },
  /** Selection change (tabs, segmented controls, pickers). */
  select(): void {
    Haptics.selectionAsync().catch(() => undefined);
  },
  /** Something completed (post published, message sent, followed). */
  success(): void {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  },
  /** Something failed and was rolled back. */
  error(): void {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
  },
  /** Incoming live event (new notification / message while on screen). */
  notify(): void {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
  },
};
