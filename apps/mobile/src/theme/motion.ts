import { Easing, FadeIn, FadeInUp, useReducedMotion } from 'react-native-reanimated';
import { THEME } from '@openmusic/shared';

const [x1, y1, x2, y2] = THEME.motion.easing.out;
const easeOut = Easing.bezier(x1, y1, x2, y2);
/** Stagger only the first few items; later rows appear with the last delay. */
const MAX_STAGGERED = 8;

/**
 * Calm `entering` animation for Reanimated views, the native twin of the web `.om-enter` /
 * `.om-fade` / `.om-stagger`: `up` fades in with a 6px rise in 250ms, `fade` fades in 200ms;
 * `index` staggers list items 40ms apart. Returns `undefined` under reduced motion, so the
 * view simply appears.
 */
export function useEntering(kind: 'up' | 'fade' = 'up', index = 0) {
  const reduced = useReducedMotion();
  if (reduced) return undefined;
  const delay = Math.min(index, MAX_STAGGERED) * THEME.motion.stagger;
  if (kind === 'fade') {
    return FadeIn.duration(THEME.motion.duration.base).delay(delay).easing(easeOut);
  }
  return FadeInUp.duration(THEME.motion.duration.slow)
    .delay(delay)
    .easing(easeOut)
    .withInitialValues({ opacity: 0, transform: [{ translateY: THEME.motion.distance.md }] });
}
