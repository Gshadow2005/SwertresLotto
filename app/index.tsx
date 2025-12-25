import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  RefreshControl,
  Platform,
  TouchableOpacity
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import Constants from 'expo-constants';

const STORAGE_KEY = '@swertres_results';
const IS_EXPO_GO = Constants.appOwnership === 'expo';

interface DrawResult {
  time: string;
  numbers: string;
}

interface LottoResults {
  date: string;
  results: DrawResult[];
  lastFetch: string;
}

// Web scraping function
async function fetchSwertresResults(): Promise<LottoResults | null> {
  try {
    const response = await axios.get('https://philnews.ph/pcso-lotto-result/swertres-result/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36'
      },
      timeout: 10000 // 10 second timeout
    });

    const html = response.data;
    
    // Extract date using regex
    const dateMatch = html.match(/SWERTRES RESULT[^<]*([A-Z][a-z]+ \d{1,2}, \d{4})/i);
    const date = dateMatch ? dateMatch[1] : 'Unknown Date';

    // Extract table rows
    const tableMatch = html.match(/<table[^>]*>(.*?)<\/table>/is);
    if (!tableMatch) return null;

    const tableContent = tableMatch[1];
    const rowMatches = tableContent.matchAll(/<tr[^>]*>(.*?)<\/tr>/gis);
    
    const results: DrawResult[] = [];
    let isFirstRow = true;

    for (const rowMatch of rowMatches) {
      if (isFirstRow) {
        isFirstRow = false;
        continue; // Skip header
      }

      const row = rowMatch[1];
      const cellMatches = [...row.matchAll(/<td[^>]*>(.*?)<\/td>/gis)];
      
      if (cellMatches.length >= 2) {
        const time = cellMatches[0][1].replace(/<[^>]*>/g, '').trim();
        const numbers = cellMatches[1][1].replace(/<[^>]*>/g, '').trim();
        
        if (time && numbers) {
          results.push({ time, numbers });
        }
      }
    }

    // Ensure we have 3 time slots
    const timeSlots = ['2:00 PM', '5:00 PM', '9:00 PM'];
    const formattedResults: DrawResult[] = timeSlots.map((slot) => {
      const existing = results.find(r => r.time.includes(slot.split(':')[0]));
      return existing || { time: slot, numbers: '_‑_‑_' };
    });

    return {
      date,
      results: formattedResults,
      lastFetch: new Date().toISOString()
    };
  } catch (error) {
    console.error('Fetch error:', error);
    return null;
  }
}

export default function App() {
  const [results, setResults] = useState<LottoResults | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);

  useEffect(() => {
    // Load cached results
    loadCachedResults();

    // Initial fetch
    fetchAndUpdate();

    // Set up auto-refresh every 5 minutes (only when app is active)
    let interval: NodeJS.Timeout | null = null;
    
    if (autoRefreshEnabled) {
      interval = setInterval(() => {
        const now = new Date();
        const hour = now.getHours();
        const minute = now.getMinutes();
        
        // More frequent checks around draw times: 2PM, 5PM, 9PM
        const isDrawTime = (hour === 14 || hour === 17 || hour === 21) && minute < 10;
        
        if (isDrawTime) {
          console.log('Auto-refreshing near draw time...');
          fetchAndUpdate();
        } else {
          // Otherwise check every 30 minutes
          if (minute % 30 === 0) {
            console.log('Auto-refreshing...');
            fetchAndUpdate();
          }
        }
      }, 60000); // Check every minute
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefreshEnabled]);

  const loadCachedResults = async () => {
    try {
      const cached = await AsyncStorage.getItem(STORAGE_KEY);
      if (cached) {
        setResults(JSON.parse(cached));
      }
    } catch (error) {
      console.error('Load cache error:', error);
    }
  };

  const fetchAndUpdate = async () => {
    try {
      const data = await fetchSwertresResults();
      if (data) {
        // Save to storage
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        setResults(data);
        
        // Check for new results (simple version without notifications)
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const oldData: LottoResults = JSON.parse(stored);
          let hasNewResults = false;
          
          for (let i = 0; i < data.results.length; i++) {
            if (data.results[i].numbers !== oldData.results[i].numbers && 
                data.results[i].numbers !== '_‑_‑_') {
              hasNewResults = true;
              console.log(`New result: ${data.results[i].time} - ${data.results[i].numbers}`);
            }
          }
          
          if (hasNewResults && !IS_EXPO_GO) {
            // Would show notification here in development build
            console.log('New results available!');
          }
        }
      }
    } catch (error) {
      console.error('Update error:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAndUpdate();
    setRefreshing(false);
  };

  const getStatusColor = (numbers: string) => {
    return numbers === '_‑_‑_' ? '#666' : '#4CAF50';
  };

  const clearCache = async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      setResults(null);
      setLoading(true);
      await fetchAndUpdate();
    } catch (error) {
      console.error('Clear cache error:', error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🎰 Swertres Lotto</Text>
        <Text style={styles.headerSubtitle}>3D Results</Text>
        {IS_EXPO_GO && (
          <View style={styles.expoGoBanner}>
            <Text style={styles.expoGoText}>
              📱 Running in Expo Go (limited features)
            </Text>
          </View>
        )}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading results...</Text>
          </View>
        ) : results ? (
          <View style={styles.resultsContainer}>
            <Text style={styles.dateText}>
              Swertres (3D) Lotto Results — {results.date}
            </Text>
            
            <View style={styles.resultsBox}>
              {results.results.map((draw, index) => (
                <View key={index} style={styles.resultRow}>
                  <View style={styles.timeContainer}>
                    <Text style={styles.bullet}>•</Text>
                    <Text style={styles.timeText}>{draw.time}</Text>
                  </View>
                  <Text style={styles.arrow}>→</Text>
                  <Text style={[styles.numbersText, { color: getStatusColor(draw.numbers) }]}>
                    {draw.numbers}
                  </Text>
                </View>
              ))}
            </View>

            <Text style={styles.lastUpdate}>
              Last updated: {new Date(results.lastFetch).toLocaleTimeString()}
            </Text>
          </View>
        ) : (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Unable to load results</Text>
            <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>📅 Draw Times</Text>
          <Text style={styles.infoText}>• 2:00 PM</Text>
          <Text style={styles.infoText}>• 5:00 PM</Text>
          <Text style={styles.infoText}>• 9:00 PM</Text>
          <Text style={styles.infoNote}>
            Pull down to refresh manually{'\n'}
            {autoRefreshEnabled ? '✓ Auto-refresh enabled' : '✗ Auto-refresh disabled'}
          </Text>
        </View>

        <View style={styles.controlsBox}>
          <TouchableOpacity 
            style={[styles.controlButton, autoRefreshEnabled && styles.controlButtonActive]} 
            onPress={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
          >
            <Text style={styles.controlButtonText}>
              {autoRefreshEnabled ? '🔄 Auto-Refresh ON' : '⏸ Auto-Refresh OFF'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.controlButton} 
            onPress={clearCache}
          >
            <Text style={styles.controlButtonText}>🗑 Clear Cache</Text>
          </TouchableOpacity>
        </View>

        {!IS_EXPO_GO && (
          <View style={[styles.infoBox, { backgroundColor: '#1a3a1a' }]}>
            <Text style={styles.infoTitle}>✨ Development Build Features</Text>
            <Text style={styles.infoText}>• Push notifications for new results</Text>
            <Text style={styles.infoText}>• Background fetch (even when app closed)</Text>
            <Text style={styles.infoText}>• Better performance</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: '#16213e',
    borderBottomWidth: 3,
    borderBottomColor: '#0f3460',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#aaa',
    textAlign: 'center',
    marginTop: 5,
  },
  expoGoBanner: {
    backgroundColor: '#ff6b35',
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
  },
  expoGoText: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    color: '#aaa',
    fontSize: 18,
  },
  resultsContainer: {
    marginBottom: 30,
  },
  dateText: {
    fontSize: 18,
    color: '#fff',
    marginBottom: 20,
    fontWeight: '600',
  },
  resultsBox: {
    backgroundColor: '#16213e',
    borderRadius: 15,
    padding: 20,
    borderWidth: 2,
    borderColor: '#0f3460',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  bullet: {
    color: '#4CAF50',
    fontSize: 24,
    marginRight: 8,
  },
  timeText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '500',
  },
  arrow: {
    color: '#666',
    fontSize: 20,
    marginHorizontal: 10,
  },
  numbersText: {
    fontSize: 28,
    fontWeight: 'bold',
    minWidth: 100,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  lastUpdate: {
    color: '#666',
    fontSize: 12,
    marginTop: 15,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 18,
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  infoBox: {
    backgroundColor: '#16213e',
    borderRadius: 15,
    padding: 20,
    borderWidth: 2,
    borderColor: '#0f3460',
    marginBottom: 20,
  },
  infoTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  infoText: {
    color: '#aaa',
    fontSize: 16,
    marginVertical: 4,
  },
  infoNote: {
    color: '#666',
    fontSize: 13,
    marginTop: 15,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  controlsBox: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  controlButton: {
    flex: 1,
    backgroundColor: '#16213e',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#0f3460',
    alignItems: 'center',
  },
  controlButtonActive: {
    borderColor: '#4CAF50',
    backgroundColor: '#1a3a1a',
  },
  controlButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});