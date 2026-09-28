import { Text, View } from 'react-native';

export type BannerTone = 'error' | 'info';

export function Banner({ tone, message }: { tone: BannerTone; message: string }) {
  const isError = tone === 'error';

  return (
    <View
      accessibilityLiveRegion="polite"
      className={`rounded-xl border px-4 py-3 ${
        isError ? 'border-danger bg-danger/10' : 'border-primary bg-primary/10'
      }`}
    >
      <Text className={`text-sm ${isError ? 'text-danger' : 'text-primary'}`}>{message}</Text>
    </View>
  );
}
