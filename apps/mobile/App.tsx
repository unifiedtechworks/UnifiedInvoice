/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import { invoiceDomainFoundation } from '@invoice/domain';
import { FoundationCard } from '@invoice/ui';
import { StatusBar, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <AppContent />
    </SafeAreaProvider>
  );
}

function AppContent() {
  const safeAreaInsets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: safeAreaInsets.top + 24 }]}>
      <Text style={styles.heading}>Invoice Platform</Text>
      <FoundationCard title="Shared foundation">
        Shared domain package status: {invoiceDomainFoundation.status}
      </FoundationCard>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: '#f6f8fa',
  },
  heading: {
    color: '#111827',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 16,
  },
});

export default App;
