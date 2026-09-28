import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { SafeAreaView } from 'react-native';

export function Screen({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar style="dark" />
      {children}
    </SafeAreaView>
  );
}
