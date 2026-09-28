import { useCallback, useEffect, useState } from 'react';
import { asApiError } from '../api/client';

export type RequestState<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: T };

function settle<T>(
  promise: Promise<T>,
  apply: (state: RequestState<T>) => void,
): Promise<void> {
  return promise.then(
    (data) => apply({ status: 'ready', data }),
    (caught: unknown) => apply({ status: 'error', message: asApiError(caught).message }),
  );
}

/**
 * Runs `load` on mount and whenever its identity changes, so callers pass a useCallback-wrapped
 * loader. A reload keeps the previous data on screen, which is what pull-to-refresh wants.
 */
export function useRequest<T>(load: () => Promise<T>): {
  state: RequestState<T>;
  reload: () => Promise<void>;
} {
  const [state, setState] = useState<RequestState<T>>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    void settle(load(), (next) => {
      if (active) setState(next);
    });
    return () => {
      active = false;
    };
  }, [load]);

  const reload = useCallback(() => settle(load(), setState), [load]);

  return { state, reload };
}
