import { useState } from 'react';
import './global.css';
import { SessionProvider, useSession } from './src/auth/SessionProvider';
import { Screen } from './src/components/Screen';
import { LoadingView } from './src/components/StateViews';
import { LoginScreen } from './src/screens/LoginScreen';
import { RegisterScreen } from './src/screens/RegisterScreen';
import { VerifyScreen, type VerifyTarget } from './src/screens/VerifyScreen';
import { SignedInApp } from './src/SignedInApp';

type AuthRoute = { name: 'login' } | { name: 'register' } | { name: 'verify'; target: VerifyTarget };

function AuthFlow() {
  const [route, setRoute] = useState<AuthRoute>({ name: 'login' });

  if (route.name === 'register') {
    return (
      <RegisterScreen
        onGoToLogin={() => setRoute({ name: 'login' })}
        onRegistered={(target) => setRoute({ name: 'verify', target })}
      />
    );
  }

  if (route.name === 'verify') {
    return <VerifyScreen onGoToLogin={() => setRoute({ name: 'login' })} target={route.target} />;
  }

  return (
    <LoginScreen
      onGoToRegister={() => setRoute({ name: 'register' })}
      onNeedsVerification={(target) => setRoute({ name: 'verify', target })}
    />
  );
}

function Guard() {
  const { state } = useSession();

  if (state.status === 'loading') {
    return (
      <Screen>
        <LoadingView />
      </Screen>
    );
  }

  return state.status === 'signedIn' ? <SignedInApp token={state.token} /> : <AuthFlow />;
}

export default function App() {
  return (
    <SessionProvider>
      <Guard />
    </SessionProvider>
  );
}
