import { useCallback, useState } from 'react';
import { getMe, type Me } from './api/me';
import { Screen } from './components/Screen';
import { ErrorView, LoadingView } from './components/StateViews';
import { useRequest } from './hooks/useRequest';
import { HomeScreen } from './screens/HomeScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { TaskSelectionScreen } from './screens/TaskSelectionScreen';

type AppRoute =
  | { name: 'profile' }
  | { name: 'tasks'; selection: number[]; canCancel: boolean }
  | { name: 'home' };

/** Where a signed-in user lands: the profile and first task pick happen once, then always Home. */
function initialRoute(me: Me): AppRoute {
  if (me.profile === null) return { name: 'profile' };
  if (me.selectedTaskCount === 0) return { name: 'tasks', selection: [], canCancel: false };
  return { name: 'home' };
}

export function SignedInApp({ token }: { token: string }) {
  const load = useCallback(() => getMe(token), [token]);
  const { state, reload } = useRequest(load);

  // Derived from the bootstrap until the user navigates, so no effect has to sync the two.
  const [route, setRoute] = useState<AppRoute | null>(null);

  if (state.status === 'loading') {
    return (
      <Screen>
        <LoadingView />
      </Screen>
    );
  }

  if (state.status === 'error') {
    return (
      <Screen>
        <ErrorView message={state.message} onRetry={reload} />
      </Screen>
    );
  }

  const current = route ?? initialRoute(state.data);

  if (current.name === 'profile') {
    return (
      <ProfileScreen
        onSaved={() => setRoute({ name: 'tasks', selection: [], canCancel: false })}
        token={token}
      />
    );
  }

  if (current.name === 'tasks') {
    return (
      <TaskSelectionScreen
        initialSelection={current.selection}
        onDone={() => setRoute({ name: 'home' })}
        token={token}
        {...(current.canCancel ? { onCancel: () => setRoute({ name: 'home' }) } : {})}
      />
    );
  }

  return (
    <HomeScreen
      onEditTasks={(selection) => setRoute({ name: 'tasks', selection, canCancel: true })}
      token={token}
    />
  );
}
