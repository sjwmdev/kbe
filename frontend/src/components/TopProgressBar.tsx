import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

const COMPLETE_HIDE_DELAY_MS = 200;

// A minimal NProgress-style bar keyed to route changes (path + search), not
// to any individual page's own data fetch — it's purely a navigation-feel
// affordance, since most route changes here are instant client-side swaps.
export function TopProgressBar() {
  const location = useLocation();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];

    setVisible(true);
    setProgress(15);

    timers.current.push(
      window.setTimeout(() => setProgress(70), 100),
      window.setTimeout(() => setProgress(90), 300),
      window.setTimeout(() => {
        setProgress(100);
        timers.current.push(
          window.setTimeout(() => {
            setVisible(false);
            setProgress(0);
          }, COMPLETE_HIDE_DELAY_MS),
        );
      }, 450),
    );

    return () => {
      timers.current.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[300] h-0.5">
      <div
        className="h-full bg-brand-accent shadow-[0_0_8px_color-mix(in_srgb,var(--color-brand-accent)_60%,transparent)] transition-[width,opacity] duration-300 ease-out"
        style={{ width: `${progress}%`, opacity: progress === 100 ? 0 : 1 }}
      />
    </div>
  );
}
