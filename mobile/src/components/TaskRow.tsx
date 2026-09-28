import { Pressable, Text, View } from 'react-native';

type TaskRowProps = {
  name: string;
  description: string;
  selected: boolean;
  onPress: () => void;
};

export function TaskRow({ name, description, selected, onPress }: TaskRowProps) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      className="flex-row items-start gap-3 px-6 py-3"
      onPress={onPress}
    >
      <View
        className={`h-6 w-6 items-center justify-center rounded-md border ${
          selected ? 'border-primary bg-primary' : 'border-line bg-white'
        }`}
      >
        {selected ? <Text className="text-sm font-bold text-white">✓</Text> : null}
      </View>

      <View className="flex-1 gap-0.5">
        <Text className="text-base font-medium text-ink">{name}</Text>
        <Text className="text-sm text-muted">{description}</Text>
      </View>
    </Pressable>
  );
}
