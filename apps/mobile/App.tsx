import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { LORA_CONFIG } from '@salbar/protocol';

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>SALBAR Resident</Text>
      <Text style={styles.subtitle}>
        Expo SDK 58 Ready | LoRa {LORA_CONFIG.FREQUENCY_MHZ} MHz SF{LORA_CONFIG.SPREADING_FACTOR}
      </Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0F1D',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 13,
  },
});
