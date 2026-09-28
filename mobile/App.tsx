import { useState } from 'react';
import { SafeAreaView } from 'react-native';
import { ActivityIndicator } from 'react-native-css/components';
import './global.css';
import { SessionProvider, useSession } from './src/auth/SessionProvider';
import { HomeScreen } from './src/screens/HomeScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { RegisterScreen } from './src/screens/RegisterScreen';
import { VerifyScreen, type VerifyTarget } from './src/screens/VerifyScreen';

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
      <SafeAreaView className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator className="text-primary" size="large" />
      </SafeAreaView>
    );
  }

  return state.status === 'signedIn' ? <HomeScreen /> : <AuthFlow />;
}

export default function App() {
  return (
    <SessionProvider>
      <Guard />
    </SessionProvider>
  );
}
