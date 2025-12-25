import React from 'react';
import { Text, View, StyleSheet } from 'react-native';

// Widget component for home screen
export default function SwertresWidget() {
  return (
    <View style={styles.widget}>
      <View style={styles.header}>
        <Text style={styles.title}>🎰 Swertres</Text>
      </View>
      <View style={styles.content}>
        <View style={styles.resultRow}>
          <Text style={styles.time}>2PM</Text>
          <Text style={styles.numbers}>_-_-_</Text>
        </View>
        <View style={styles.resultRow}>
          <Text style={styles.time}>5PM</Text>
          <Text style={styles.numbers}>_-_-_</Text>
        </View>
        <View style={styles.resultRow}>
          <Text style={styles.time}>9PM</Text>
          <Text style={styles.numbers}>_-_-_</Text>
        </View>
      </View>
      <Text style={styles.tapHint}>Tap to open</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  widget: {
    width: '100%',
    height: '100%',
    backgroundColor: '#16213e',
    borderRadius: 16,
    padding: 12,
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
    justifyContent: 'space-evenly',
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  time: {
    fontSize: 14,
    color: '#aaa',
    fontWeight: '600',
  },
  numbers: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
    fontFamily: 'monospace',
  },
  tapHint: {
    fontSize: 10,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
});