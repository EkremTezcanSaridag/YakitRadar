import { useEffect, useRef } from 'react'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { CommonActions } from '@react-navigation/native'
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { colors } from '../theme'

const useNativeDriver = Platform.OS !== 'web'

function ensureTabAnims(store, routeKey, focused) {
  if (!store[routeKey]) {
    store[routeKey] = {
      pillOpacity: new Animated.Value(focused ? 1 : 0),
      pillScale: new Animated.Value(focused ? 1 : 0.85),
      iconActiveOpacity: new Animated.Value(focused ? 1 : 0),
      iconInactiveOpacity: new Animated.Value(focused ? 0 : 1),
      labelActiveOpacity: new Animated.Value(focused ? 1 : 0),
      labelInactiveOpacity: new Animated.Value(focused ? 0 : 1),
    }
  }
  return store[routeKey]
}

function runFocusAnimation(anims, focused, transitionMs, pillFadeMs) {
  const easing = Easing.out(Easing.cubic)
  if (focused) {
    return Animated.parallel([
      Animated.timing(anims.pillOpacity, {
        toValue: 1,
        duration: transitionMs,
        easing,
        useNativeDriver,
      }),
      Animated.timing(anims.pillScale, {
        toValue: 1,
        duration: transitionMs,
        easing,
        useNativeDriver,
      }),
      Animated.timing(anims.iconActiveOpacity, {
        toValue: 1,
        duration: pillFadeMs,
        easing,
        useNativeDriver,
      }),
      Animated.timing(anims.iconInactiveOpacity, {
        toValue: 0,
        duration: pillFadeMs,
        easing,
        useNativeDriver,
      }),
      Animated.timing(anims.labelActiveOpacity, {
        toValue: 1,
        duration: pillFadeMs,
        easing,
        useNativeDriver,
      }),
      Animated.timing(anims.labelInactiveOpacity, {
        toValue: 0,
        duration: pillFadeMs,
        easing,
        useNativeDriver,
      }),
    ])
  }

  return Animated.parallel([
    Animated.timing(anims.pillOpacity, {
      toValue: 0,
      duration: pillFadeMs,
      easing,
      useNativeDriver,
    }),
    Animated.timing(anims.pillScale, {
      toValue: 0.85,
      duration: pillFadeMs,
      easing,
      useNativeDriver,
    }),
    Animated.timing(anims.iconActiveOpacity, {
      toValue: 0,
      duration: pillFadeMs,
      easing,
      useNativeDriver,
    }),
    Animated.timing(anims.iconInactiveOpacity, {
      toValue: 1,
      duration: pillFadeMs,
      easing,
      useNativeDriver,
    }),
    Animated.timing(anims.labelActiveOpacity, {
      toValue: 0,
      duration: pillFadeMs,
      easing,
      useNativeDriver,
    }),
    Animated.timing(anims.labelInactiveOpacity, {
      toValue: 1,
      duration: pillFadeMs,
      easing,
      useNativeDriver,
    }),
  ])
}

function setInstantFocus(anims, focused) {
  anims.pillOpacity.setValue(focused ? 1 : 0)
  anims.pillScale.setValue(focused ? 1 : 0.85)
  anims.iconActiveOpacity.setValue(focused ? 1 : 0)
  anims.iconInactiveOpacity.setValue(focused ? 0 : 1)
  anims.labelActiveOpacity.setValue(focused ? 1 : 0)
  anims.labelInactiveOpacity.setValue(focused ? 0 : 1)
}

export default function SakinSolmaTabBar({
  state,
  descriptors,
  navigation,
  tabIcons,
  reduceMotion,
  transitionMs,
  pillFadeMs,
}) {
  const tabAnimsRef = useRef({})
  const didMountRef = useRef(false)

  useEffect(() => {
    state.routes.forEach((route, index) => {
      const focused = index === state.index
      const anims = ensureTabAnims(tabAnimsRef.current, route.key, focused)

      if (reduceMotion || !didMountRef.current) {
        setInstantFocus(anims, focused)
        return
      }

      runFocusAnimation(anims, focused, transitionMs, pillFadeMs).start()
    })
    didMountRef.current = true
  }, [pillFadeMs, reduceMotion, state.index, state.routes, transitionMs])

  const focusedRouteKey = state.routes[state.index]?.key
  const tabBarStyle = descriptors[focusedRouteKey]?.options?.tabBarStyle ?? {}
  const tabBarItemStyle = descriptors[focusedRouteKey]?.options?.tabBarItemStyle ?? {}
  const tabBarLabelStyle = descriptors[focusedRouteKey]?.options?.tabBarLabelStyle ?? {}

  return (
    <View accessibilityRole="tablist" style={[styles.bar, tabBarStyle]}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key]
        const focused = index === state.index
        const label = options.title ?? route.name
        const iconMeta = tabIcons[route.name] ?? { active: 'circle', inactive: 'circle-outline' }
        const anims = ensureTabAnims(tabAnimsRef.current, route.key, focused)

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          })

          if (!focused && !event.defaultPrevented) {
            navigation.dispatch({
              ...CommonActions.navigate(route.name, route.params),
              target: state.key,
            })
          }
        }

        const onLongPress = () => {
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          })
        }

        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
            onPress={onPress}
            onLongPress={onLongPress}
            style={[styles.item, tabBarItemStyle]}
          >
            <View style={styles.iconWrap}>
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.pill,
                  {
                    opacity: anims.pillOpacity,
                    transform: [{ scale: anims.pillScale }],
                  },
                ]}
              />
              <View style={styles.iconStack}>
                <Animated.View style={[styles.iconLayer, { opacity: anims.iconInactiveOpacity }]}>
                  <MaterialCommunityIcons name={iconMeta.inactive} color={colors.muted} size={20} />
                </Animated.View>
                <Animated.View style={[styles.iconLayer, { opacity: anims.iconActiveOpacity }]}>
                  <MaterialCommunityIcons name={iconMeta.active} color={colors.accent} size={20} />
                </Animated.View>
              </View>
            </View>
            <View style={styles.labelStack}>
              <Animated.Text
                numberOfLines={1}
                style={[
                  styles.label,
                  tabBarLabelStyle,
                  { color: colors.muted, opacity: anims.labelInactiveOpacity },
                ]}
              >
                {label}
              </Animated.Text>
              <Animated.Text
                numberOfLines={1}
                style={[
                  styles.label,
                  styles.labelActive,
                  tabBarLabelStyle,
                  { color: colors.accent, opacity: anims.labelActiveOpacity },
                ]}
              >
                {label}
              </Animated.Text>
            </View>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 38,
    height: 28,
    borderRadius: 14,
  },
  pill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.accentSoft,
    borderRadius: 14,
  },
  iconStack: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLayer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelStack: {
    minHeight: 14,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 12,
    textAlign: 'center',
  },
  labelActive: {
    position: 'absolute',
  },
})
