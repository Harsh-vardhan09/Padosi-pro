import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { SafeAreaView, Text, View } from 'react-native';
import { useSession } from '../auth/SessionProvider';
import { Button } from '../components/Button';

export function HomeScreen() {
  const { signOut } = useSession();
  const [signingOut, setSigningOut] = useState(false);

  async function logOut(): Promise<void> {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar style="dark" />
      <View className="flex-1 justify-center gap-8 px-6">
        <View className="gap-2">
          <Text className="text-3xl font-bold text-primary">PadosiPro</Text>
          <Text className="text-base text-muted">
            Your email is verified. Profile and task setup come next.
          </Text>
        </View>
        <Button label="Log out" loading={signingOut} onPress={logOut} variant="secondary" />
      </View>
    </SafeAreaView>
  );
}
