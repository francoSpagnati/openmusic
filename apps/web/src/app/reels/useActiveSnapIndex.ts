'use client';

import { useEffect, useState, type RefObject } from 'react';

interface SnapChangeEvent extends Event {
  snapTargetBlock?: Element | null;
}

/**
 * Index of the snapped child (`[data-snap-index]`) in a vertical scroll-snap container.
 * Uses `scrollsnapchange` where supported (fires once the scroll settles) and falls back to an
 * IntersectionObserver elsewhere (Firefox, Safari).
 */
export function useActiveSnapIndex(
  containerRef: RefObject<HTMLElement | null>,
  count: number,
  /** Change it when the container is re-mounted with new content (resets to the first item). */
  resetKey: unknown
): number {
  const [active, setActive] = useState(0);

  useEffect(() => {
    setActive(0);
    const root = containerRef.current;
    if (!root || count === 0) return;

    const indexOf = (el: Element | null | undefined): number | null => {
      const raw = el instanceof HTMLElement ? el.dataset.snapIndex : undefined;
      const n = raw === undefined ? NaN : Number(raw);
      return Number.isInteger(n) ? n : null;
    };

    if ('onscrollsnapchange' in HTMLElement.prototype) {
      const onSnap = (event: Event) => {
        const index = indexOf((event as SnapChangeEvent).snapTargetBlock);
        if (index !== null) setActive(index);
      };
      root.addEventListener('scrollsnapchange', onSnap);
      return () => root.removeEventListener('scrollsnapchange', onSnap);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const index = indexOf(visible?.target);
        if (index !== null) setActive(index);
      },
      { root, threshold: 0.6 }
    );
    root.querySelectorAll('[data-snap-index]').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [containerRef, count, resetKey]);

  return Math.min(active, Math.max(0, count - 1));
}
