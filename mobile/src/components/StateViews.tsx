import { useState } from 'react';
import { Text, View } from 'react-native';
import { ActivityIndicator } from 'react-native-css/components';
import { Button } from './Button';

export function LoadingView({ label }: { label?: string }) {
  return (
    <View className="flex-1 items-center justify-center gap-3 px-6">
      <ActivityIndicator className="text-primary" size="large" />
      {label === undefined ? null : <Text className="text-base text-muted">{label}</Text>}
    </View>
  );
}

export function EmptyView({ title, message }: { title: string; message: string }) {
  return (
    <View className="flex-1 items-center justify-center gap-2 px-6 py-10">
      <Text className="text-center text-lg font-semibold text-ink">{title}</Text>
      <Text className="text-center text-base text-muted">{message}</Text>
    </View>
  );
}

export function ErrorView({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => Promise<void>;
}) {
  const [retrying, setRetrying] = useState(false);

  async function retry(): Promise<void> {
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  }

  return (
    <View className="flex-1 items-center justify-center gap-4 px-6">
      <Text className="text-center text-lg font-semibold text-ink">Something went wrong</Text>
      <Text className="text-center text-base text-muted">{message}</Text>
      <Button label="Try again" loading={retrying} onPress={retry} variant="secondary" />
    </View>
  );
}
