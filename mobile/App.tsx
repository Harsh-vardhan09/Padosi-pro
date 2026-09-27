import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, Text } from 'react-native';
import './global.css';

export default function App() {
  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-white">
      <StatusBar style="dark" />
      <Text className="text-3xl font-bold text-primary">PadosiPro</Text>
    </SafeAreaView>
  );
}
