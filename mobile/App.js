import { useEffect } from 'react'
import { enableScreens } from 'react-native-screens'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { NavigationContainer } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { ErrorBoundary } from './src/components/ErrorBoundary'
import AnaSayfa from './src/screens/AnaSayfa'
import Iller from './src/screens/Iller'
import Gecmis from './src/screens/Gecmis'
import Aracim from './src/screens/Aracim'
import Bildirimler from './src/screens/Bildirimler'
import {
  defaultNotificationSettings,
  configureNotificationHandler,
  setupNotificationChannels,
  loadNotificationSettings,
  scheduleWeeklySummaryNotification,
  subscribeToNotificationEvents,
  syncExistingNotificationPermission,
} from './src/services/notifications'
import { initAds, trackAdInteraction } from './src/services/adManager'
import { colors } from './src/theme'

import { Platform, StyleSheet, View } from 'react-native'

enableScreens()
configureNotificationHandler()

const Tab = createBottomTabNavigator()

const tabs = {
  home: 'Ana Sayfa',
  cities: 'İller',
  history: 'Geçmiş',
  vehicle: 'Aracım',
  alerts: 'Bildirimler',
}

const tabIcons = {
  [tabs.home]: { active: 'home', inactive: 'home-outline' },
  [tabs.cities]: { active: 'map-marker', inactive: 'map-marker-outline' },
  [tabs.history]: { active: 'chart-timeline-variant', inactive: 'chart-timeline-variant' },
  [tabs.vehicle]: { active: 'car', inactive: 'car-outline' },
  [tabs.alerts]: { active: 'bell', inactive: 'bell-outline' },
}

const startupNotificationMeta = {
  trackedCities: ['İstanbul', 'Ankara', 'İzmir'],
  trackedFuels: defaultNotificationSettings.trackedFuels,
}

export default function App() {
  useEffect(() => {
    initAds().catch(() => {})
    setupNotificationChannels().catch(() => {})
    const unsubscribe = subscribeToNotificationEvents()

    loadNotificationSettings()
      .then((settings) => {
        syncExistingNotificationPermission(settings, startupNotificationMeta)
        if (settings.weeklySummary) {
          scheduleWeeklySummaryNotification().catch(() => {})
        }
      })
      .catch(() => {})

    return unsubscribe
  }, [])

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
        <NavigationContainer>
          <Tab.Navigator
          screenListeners={{
            tabPress: () => {
              trackAdInteraction()
            },
          }}
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarShowLabel: true,
            tabBarIcon: ({ focused }) => {
              const iconMeta = tabIcons[route.name] ?? { active: 'circle', inactive: 'circle-outline' }
              return (
                <View style={[styles.tabIconWrap, focused && styles.tabIconWrapActive]}>
                  <MaterialCommunityIcons
                    name={focused ? iconMeta.active : iconMeta.inactive}
                    color={focused ? colors.accent : colors.muted}
                    size={20}
                  />
                </View>
              )
            },
            tabBarLabelStyle: {
              fontSize: 10,
              fontWeight: '800',
              marginTop: 1,
            },
            tabBarItemStyle: {
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 2,
            },
            tabBarStyle: {
              position: 'absolute',
              bottom: Platform.OS === 'ios' ? 24 : 12,
              left: 14,
              right: 14,
              height: 64,
              backgroundColor: '#111827',
              borderRadius: 22,
              borderWidth: 1.5,
              borderColor: '#243352',
              paddingHorizontal: 6,
              paddingTop: 6,
              paddingBottom: 6,
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.45,
              shadowRadius: 16,
              elevation: 16,
            },
            tabBarActiveTintColor: colors.accent,
            tabBarInactiveTintColor: colors.muted,
            sceneStyle: {
              backgroundColor: colors.bg,
            },
          })}
        >
          <Tab.Screen name={tabs.home} component={AnaSayfa} />
          <Tab.Screen name={tabs.cities} component={Iller} />
          <Tab.Screen name={tabs.history} component={Gecmis} />
          <Tab.Screen name={tabs.vehicle} component={Aracim} />
          <Tab.Screen name={tabs.alerts} component={Bildirimler} />
        </Tab.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
    </ErrorBoundary>
  )
}

const styles = StyleSheet.create({
  tabIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 38,
    height: 28,
    borderRadius: 14,
  },
  tabIconWrapActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.14)',
  },
})