import { useEffect, useState } from 'react';

function secondsLeft(target: number): number {
  return Math.max(0, Math.ceil((target - Date.now()) / 1000));
}

/**
 * Counts down to an epoch-millisecond deadline, settling at 0 once it has passed. The value is
 * derived at render; the interval only exists to re-render once a second until the deadline.
 */
export function useSecondsUntil(target: number): number {
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setTick((tick) => tick + 1);
      if (secondsLeft(target) === 0) clearInterval(timer);
    }, 1000);

    return () => clearInterval(timer);
  }, [target]);

  return secondsLeft(target);
}
