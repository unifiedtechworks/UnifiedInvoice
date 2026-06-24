import { invoiceDomainFoundation } from '@invoice/domain';
import { FoundationCard } from '@invoice/ui';
import { AppRegistry, StyleSheet, View } from 'react-native';

export function App() {
  return (
    <View style={styles.page}>
      <FoundationCard title="Invoice Platform">
        Shared domain package status: {invoiceDomainFoundation.status}
      </FoundationCard>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    minHeight: '100%',
    padding: 24,
    backgroundColor: '#f6f8fa',
  },
});

AppRegistry.registerComponent('InvoiceWeb', () => App);
