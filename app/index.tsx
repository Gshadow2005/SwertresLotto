import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  RefreshControl,
  Platform,
  Alert,
  Linking,
  AppState,
  AppStateStatus
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';

const STORAGE_KEY = '@swertres_results';
const AUTO_START_ASKED_KEY = '@auto_start_asked';
const BACKGROUND_FETCH_TASK = 'SWERTRES_BACKGROUND_FETCH';
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

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Background fetch task definition
TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  try {
    const data = await fetchSwertresResults();
    if (data) {
      // Save to storage
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      
      // Check for new results
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const oldData: LottoResults = JSON.parse(stored);
        
        for (let i = 0; i < data.results.length; i++) {
          if (data.results[i].numbers !== oldData.results[i].numbers && 
              data.results[i].numbers !== '_‑_‑_') {
            // Send notification
            await Notifications.scheduleNotificationAsync({
              content: {
                title: '🎰 New Swertres Result!',
                body: `${data.results[i].time}: ${data.results[i].numbers}`,
                sound: true,
              },
              trigger: null,
            });
          }
        }
      }
      
      return BackgroundFetch.BackgroundFetchResult.NewData;
    }
    return BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (error) {
    console.error('Background fetch error:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// Web scraping function
async function fetchSwertresResults(): Promise<LottoResults | null> {
  try {
    const response = await axios.get('https://philnews.ph/pcso-lotto-result/swertres-result/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36'
      },
      timeout: 10000
    });

    const html = response.data;
    
    const dateMatch = html.match(/SWERTRES RESULT[^<]*?([A-Z][a-z]+(?:ber|ary|ch|il|ay|ne|ly|ust)?\s+\d{1,2},?\s+\d{4})/i);
    const date = dateMatch ? dateMatch[1] : 'Unknown Date';

    const tableMatch = html.match(/<table[^>]*>(.*?)<\/table>/is);
    if (!tableMatch) return null;

    const tableContent = tableMatch[1];
    const rowMatches = tableContent.matchAll(/<tr[^>]*>(.*?)<\/tr>/gis);
    
    const results: DrawResult[] = [];
    let isFirstRow = true;

    for (const rowMatch of rowMatches) {
      if (isFirstRow) {
        isFirstRow = false;
        continue;
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

const updateWidget = async () => {
  if (Platform.OS === 'android' && !IS_EXPO_GO) {
    try {
      // Send broadcast to update widget
      const { NativeModules } = require('react-native');
      if (NativeModules.WidgetUpdateModule) {
        NativeModules.WidgetUpdateModule.updateWidget();
      }
    } catch (error) {
      console.log('Widget update not available');
    }
  }
};

export default function App() {
  const [results, setResults] = useState<LottoResults | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    initializeApp();

    // Listen to app state changes
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, []);

  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (appState.match(/inactive|background/) && nextAppState === 'active') {
      // App has come to foreground, refresh data
      fetchAndUpdate();
    }
    setAppState(nextAppState);
  };

  const initializeApp = async () => {
    // Request notification permissions
    if (!IS_EXPO_GO) {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Notifications Disabled',
          'Enable notifications to receive alerts for new results.',
          [{ text: 'OK' }]
        );
      }
    }

    // Ask for auto-start permission (one time)
    await askAutoStartPermission();

    // Register background fetch
    if (!IS_EXPO_GO) {
      await registerBackgroundFetch();
    }

    // Load cached results
    await loadCachedResults();

    // Initial fetch
    await fetchAndUpdate();
  };

  const askAutoStartPermission = async () => {
    try {
      const hasAsked = await AsyncStorage.getItem(AUTO_START_ASKED_KEY);
      
      if (!hasAsked && Platform.OS === 'android') {
        Alert.alert(
          '🔄 Enable Auto-Start',
          'Allow this app to run in the background to receive automatic updates for new lottery results.\n\nYou may need to enable this in your device settings.',
          [
            {
              text: 'Open Settings',
              onPress: () => {
                Linking.openSettings();
                AsyncStorage.setItem(AUTO_START_ASKED_KEY, 'true');
              }
            },
            {
              text: 'Maybe Later',
              onPress: () => AsyncStorage.setItem(AUTO_START_ASKED_KEY, 'true'),
              style: 'cancel'
            }
          ]
        );
      }
    } catch (error) {
      console.error('Auto-start permission error:', error);
    }
  };

  const registerBackgroundFetch = async () => {
    try {
      const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_FETCH_TASK);
      
      if (!isRegistered) {
        await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
          minimumInterval: 15 * 60, // 15 minutes
          stopOnTerminate: false,
          startOnBoot: true,
        });
        console.log('Background fetch registered');
      }
    } catch (error) {
      console.error('Background fetch registration error:', error);
    }
  };

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
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        let hasNewResults = false;
        
        if (stored) {
          const oldData: LottoResults = JSON.parse(stored);
          
          for (let i = 0; i < data.results.length; i++) {
            if (data.results[i].numbers !== oldData.results[i].numbers && 
                data.results[i].numbers !== '_‑_‑_') {
              hasNewResults = true;
              
              // Send notification if app is in background
              if (!IS_EXPO_GO && appState !== 'active') {
                await Notifications.scheduleNotificationAsync({
                  content: {
                    title: '🎰 New Swertres Result!',
                    body: `${data.results[i].time}: ${data.results[i].numbers}`,
                    sound: true,
                  },
                  trigger: null,
                });
              }
            }
          }
        }
        
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        setResults(data);
        updateWidget();
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🎰 Swertres Lotto</Text>
        <Text style={styles.headerSubtitle}>3D Results</Text>
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
            <Text style={styles.titleText}>
              Swertres (3D) Lotto Results
            </Text>
            <Text style={styles.dateText}>
              {results.date}
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
          </View>
        )}

        {!IS_EXPO_GO && (
          <View style={[styles.infoBox, { backgroundColor: '#1a3a1a' }]}>
            <Text style={styles.infoTitle}>✨ Active Features</Text>
            <Text style={styles.infoText}>• 🔔 Push notifications for new results</Text>
            <Text style={styles.infoText}>• 🔄 Background updates (every 15 min)</Text>
            <Text style={styles.infoText}>• 📱 Auto-start on device boot</Text>
            <Text style={styles.infoNote}>
              Pull down to refresh manually
            </Text>
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
  titleText: {
  fontSize: 18,
  color: '#fff',
  fontWeight: '600',
  marginBottom: 8,
},
  dateText: {
    fontSize: 16,
    color: '#aaa',
    marginBottom: 20,
    fontWeight: '500',
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
});