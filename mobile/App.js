import { useEffect, useState } from 'react'
import { enableScreens } from 'react-native-screens'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { NavigationContainer } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'
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
import SakinSolmaTabBar from './src/components/SakinSolmaTabBar'
import LocationOnboarding from './src/screens/LocationOnboarding'
import { hasUserConfiguredPrimaryCity } from './src/services/favoriteCities'
import { colors } from './src/theme'

import { AccessibilityInfo, Easing, Platform, View } from 'react-native'

enableScreens()
configureNotificationHandler()

const Tab = createBottomTabNavigator()

const TAB_ANIM_SLOW = Math.max(
  1,
  Number(typeof process !== 'undefined' ? process.env.EXPO_PUBLIC_TAB_ANIM_SLOW : 1) || 1,
)

const BASE_TAB_TRANSITION_MS = 180
const BASE_TAB_PILL_FADE_MS = 120

const tabs = {
  home: 'Ana Sayfa',
  cities: 'İller',
  history: 'Geçmiş',
  vehicle: 'Aracım',
  alerts: 'Bildirimler',
}

const tabIcons = {
  [tabs.home]: { active: 'home', inactive: 'home-outline' },
  [tabs.cities]: { active: 'map', inactive: 'map-outline' },
  [tabs.history]: { active: 'time', inactive: 'time-outline' },
  [tabs.vehicle]: { active: 'car', inactive: 'car-outline' },
  [tabs.alerts]: { active: 'notifications', inactive: 'notifications-outline' },
}

const startupNotificationMeta = {
  trackedCities: ['İstanbul', 'Ankara', 'İzmir'],
  trackedFuels: defaultNotificationSettings.trackedFuels,
}

const sakinSolmaSceneInterpolator = ({ current }) => ({
  sceneStyle: {
    opacity: current.progress.interpolate({
      inputRange: [-1, 0, 1],
      outputRange: [0, 1, 0],
    }),
  },
})

function MainTabs() {
  const insets = useSafeAreaInsets()
  const [reduceMotion, setReduceMotion] = useState(false)

  const transitionMs = BASE_TAB_TRANSITION_MS * TAB_ANIM_SLOW
  const pillFadeMs = BASE_TAB_PILL_FADE_MS * TAB_ANIM_SLOW

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => {})
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion)
    return () => {
      subscription?.remove?.()
    }
  }, [])

  const transitionSpec = reduceMotion
    ? undefined
    : {
        animation: 'timing',
        config: {
          duration: transitionMs,
          easing: Easing.out(Easing.cubic),
        },
      }

  const safeBottom = Math.max(insets.bottom, Platform.OS === 'web' ? 0 : 8)
  const tabBarFloat = safeBottom + (Platform.OS === 'ios' ? 6 : 4)

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenListeners={{
          tabPress: () => {
            trackAdInteraction()
          },
        }}
        safeAreaInsets={{ bottom: insets.bottom }}
        tabBar={(props) => (
          <SakinSolmaTabBar
            {...props}
            pillFadeMs={pillFadeMs}
            reduceMotion={reduceMotion}
            tabIcons={tabIcons}
            transitionMs={transitionMs}
          />
        )}
        screenOptions={() => ({
          headerShown: false,
          tabBarShowLabel: false,
          animation: reduceMotion ? 'none' : undefined,
          transitionSpec,
          sceneStyleInterpolator: reduceMotion ? undefined : sakinSolmaSceneInterpolator,
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
            marginTop: 2,
            marginBottom: 0,
            lineHeight: 12,
            includeFontPadding: false,
          },
          tabBarItemStyle: {
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 48,
            paddingTop: 4,
            paddingBottom: 2,
          },
          tabBarStyle: {
            position: 'absolute',
            bottom: tabBarFloat,
            left: 14,
            right: 14,
            minHeight: 68,
            backgroundColor: colors.tabBar,
            borderRadius: 22,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: 6,
            paddingTop: 8,
            paddingBottom: 10,
            shadowColor: colors.bg,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0,
            shadowRadius: 0,
            elevation: 0,
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
  )
}

function AppRoot() {
  const [bootState, setBootState] = useState('loading')

  useEffect(() => {
    hasUserConfiguredPrimaryCity()
      .then((configured) => setBootState(configured ? 'app' : 'onboarding'))
      .catch(() => setBootState('app'))
  }, [])

  if (bootState === 'loading') {
    return <View style={{ flex: 1, backgroundColor: colors.bg }} />
  }

  if (bootState === 'onboarding') {
    return <LocationOnboarding onComplete={() => setBootState('app')} />
  }

  return <MainTabs />
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
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
        <AppRoot />
      </GestureHandlerRootView>
    </SafeAreaProvider>
  )
}
