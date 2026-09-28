import * as SecureStore from 'expo-secure-store';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { logout } from '../api/auth';
import { setTokenRejectedHandler } from '../api/client';

const TOKEN_KEY = 'padosipro.accessToken';

type SessionState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; token: string };

type SessionContextValue = {
  state: SessionState;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

function forgetToken(): Promise<void> {
  return SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => undefined);
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    SecureStore.getItemAsync(TOKEN_KEY)
      .catch(() => null)
      .then((token) => {
        if (!active) return;
        setState(token === null ? { status: 'signedOut' } : { status: 'signedIn', token });
      });
    return () => {
      active = false;
    };
  }, []);

  // A revoked or expired token would otherwise strand a screen on an error it can never retry past.
  useEffect(() => {
    setTokenRejectedHandler(() => {
      void forgetToken().then(() => setState({ status: 'signedOut' }));
    });
  }, []);

  async function signIn(token: string): Promise<void> {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    setState({ status: 'signedIn', token });
  }

  // The stored token goes whatever the server says: a failed logout call must not strand the user.
  async function signOut(): Promise<void> {
    if (state.status === 'signedIn') {
      await logout(state.token).catch(() => undefined);
    }
    await forgetToken();
    setState({ status: 'signedOut' });
  }

  return (
    <SessionContext.Provider value={{ state, signIn, signOut }}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (value === null) throw new Error('useSession must be used inside a SessionProvider');
  return value;
}
