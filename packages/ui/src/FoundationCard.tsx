import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

export type FoundationCardProps = {
  title: string;
  children: ReactNode;
};

export function FoundationCard({ title, children }: FoundationCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d0d7de',
    padding: 16,
    backgroundColor: '#ffffff',
  },
  title: {
    color: '#111827',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  body: {
    color: '#374151',
    fontSize: 16,
    lineHeight: 22,
  },
});
