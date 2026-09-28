import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, SafeAreaView, Text, View } from 'react-native';
import { ScrollView } from 'react-native-css/components';

const TAGLINE = "You don't manage tasks — we do.";

type AuthLayoutProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="grow justify-center gap-8 px-6 py-10"
          keyboardShouldPersistTaps="handled"
        >
          <View className="gap-1">
            <Text className="text-3xl font-bold text-primary">PadosiPro</Text>
            <Text className="text-base text-muted">{TAGLINE}</Text>
          </View>

          <View className="gap-6">
            <View className="gap-1">
              <Text className="text-2xl font-semibold text-ink">{title}</Text>
              {subtitle === undefined ? null : (
                <Text className="text-base text-muted">{subtitle}</Text>
              )}
            </View>
            {children}
          </View>

          {footer === undefined ? null : <View className="gap-3">{footer}</View>}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
