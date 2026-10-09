import { useEffect, useRef, useState } from 'react'
import { enableScreens } from 'react-native-screens'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { MaterialCommunityIcons } from '@expo/vector-icons'
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
import { colors } from './src/theme'

import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  StyleSheet,
  View,
} from 'react-native'

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
  [tabs.cities]: { active: 'map-marker', inactive: 'map-marker-outline' },
  [tabs.history]: { active: 'chart-timeline-variant', inactive: 'chart-timeline-variant' },
  [tabs.vehicle]: { active: 'car', inactive: 'car-outline' },
  [tabs.alerts]: { active: 'bell', inactive: 'bell-outline' },
}

const startupNotificationMeta = {
  trackedCities: ['İstanbul', 'Ankara', 'İzmir'],
  trackedFuels: defaultNotificationSettings.trackedFuels,
}

function AnimatedTabIcon({ focused, routeName, reduceMotion, transitionMs, pillFadeMs }) {
  const iconMeta = tabIcons[routeName] ?? { active: 'circle', inactive: 'circle-outline' }
  const pillOpacity = useRef(new Animated.Value(focused ? 1 : 0)).current
  const pillScale = useRef(new Animated.Value(focused ? 1 : 0.85)).current
  const outlineOpacity = useRef(new Animated.Value(focused ? 0 : 1)).current
  const filledOpacity = useRef(new Animated.Value(focused ? 1 : 0)).current

  useEffect(() => {
    if (reduceMotion) {
      pillOpacity.setValue(focused ? 1 : 0)
      pillScale.setValue(focused ? 1 : 0.85)
      outlineOpacity.setValue(focused ? 0 : 1)
      filledOpacity.setValue(focused ? 1 : 0)
      return
    }

    if (focused) {
      Animated.parallel([
        Animated.timing(pillOpacity, {
          toValue: 1,
          duration: transitionMs,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(pillScale, {
          toValue: 1,
          duration: transitionMs,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(outlineOpacity, {
          toValue: 0,
          duration: pillFadeMs,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(filledOpacity, {
          toValue: 1,
          duration: pillFadeMs,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start()
    } else {
      Animated.parallel([
        Animated.timing(pillOpacity, {
          toValue: 0,
          duration: pillFadeMs,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(pillScale, {
          toValue: 0.85,
          duration: pillFadeMs,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(outlineOpacity, {
          toValue: 1,
          duration: pillFadeMs,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(filledOpacity, {
          toValue: 0,
          duration: pillFadeMs,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start()
    }
  }, [focused, filledOpacity, outlineOpacity, pillFadeMs, pillOpacity, pillScale, reduceMotion, transitionMs])

  return (
    <View style={styles.tabIconWrap}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.tabIconPill,
          {
            opacity: pillOpacity,
            transform: [{ scale: pillScale }],
          },
        ]}
      />
      <View style={styles.tabIconStack}>
        <Animated.View style={[styles.tabIconLayer, { opacity: outlineOpacity }]}>
          <MaterialCommunityIcons name={iconMeta.inactive} color={colors.muted} size={20} />
        </Animated.View>
        <Animated.View style={[styles.tabIconLayer, styles.tabIconLayerFilled, { opacity: filledOpacity }]}>
          <MaterialCommunityIcons name={iconMeta.active} color={colors.accent} size={20} />
        </Animated.View>
      </View>
    </View>
  )
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
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarShowLabel: true,
          animation: reduceMotion ? 'none' : undefined,
          transitionSpec,
          sceneStyleInterpolator: reduceMotion ? undefined : sakinSolmaSceneInterpolator,
          tabBarIcon: ({ focused }) => (
            <AnimatedTabIcon
              focused={focused}
              pillFadeMs={pillFadeMs}
              reduceMotion={reduceMotion}
              routeName={route.name}
              transitionMs={transitionMs}
            />
          ),
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '800',
            marginTop: 2,
            marginBottom: 0,
            lineHeight: 12,
            includeFontPadding: false,
          },
          tabBarItemStyle: {
            alignItems: 'center',
            justifyContent: 'center',
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
        <MainTabs />
      </GestureHandlerRootView>
    </SafeAreaProvider>
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
  tabIconPill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.accentSoft,
    borderRadius: 14,
  },
  tabIconStack: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconLayer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconLayerFilled: {
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
})
