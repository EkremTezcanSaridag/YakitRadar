import { useCallback, useEffect, useRef, useState } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { CommonActions } from '@react-navigation/native'
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { colors, iconSize, typography } from '../theme'
import { computeTabPillTranslateX, mergeTabBarContentFrame } from '../utils/tabPillLayout'

const useNativeDriver = Platform.OS !== 'web'
const PILL_WIDTH = 52
const PILL_HEIGHT = 30
const PILL_RADIUS = 15
const FOCUSED_ICON_SCALE = 1.08

function ensureTabAnims(store, routeKey, focused) {
  if (!store[routeKey]) {
    store[routeKey] = {
      iconScale: new Animated.Value(focused ? FOCUSED_ICON_SCALE : 1),
      labelActiveOpacity: new Animated.Value(focused ? 1 : 0),
      labelInactiveOpacity: new Animated.Value(focused ? 0 : 1),
    }
  }
  return store[routeKey]
}

function runFocusAnimation(anims, focused, reduceMotion) {
  const iconTarget = focused ? FOCUSED_ICON_SCALE : 1
  if (reduceMotion) {
    anims.iconScale.setValue(iconTarget)
    anims.labelActiveOpacity.setValue(focused ? 1 : 0)
    anims.labelInactiveOpacity.setValue(focused ? 0 : 1)
    return null
  }

  return Animated.parallel([
    Animated.spring(anims.iconScale, {
      toValue: iconTarget,
      stiffness: 420,
      damping: 34,
      mass: 1,
      useNativeDriver,
    }),
    Animated.timing(anims.labelActiveOpacity, {
      toValue: focused ? 1 : 0,
      duration: 180,
      useNativeDriver,
    }),
    Animated.timing(anims.labelInactiveOpacity, {
      toValue: focused ? 0 : 1,
      duration: 180,
      useNativeDriver,
    }),
  ])
}

function framesEqual(first, second) {
  if (!first || !second) {
    return false
  }

  return first.x === second.x && first.width === second.width
}

export default function SakinSolmaTabBar({
  state,
  descriptors,
  navigation,
  tabIcons,
  reduceMotion,
}) {
  const tabAnimsRef = useRef({})
  const pillTranslateX = useRef(new Animated.Value(0)).current
  const pressableLayoutsRef = useRef({})
  const contentLayoutsRef = useRef({})
  const hasAnimatedPillRef = useRef(false)
  const [tabFrames, setTabFrames] = useState({})

  const syncTabFrame = useCallback((routeKey) => {
    const merged = mergeTabBarContentFrame(
      pressableLayoutsRef.current[routeKey],
      contentLayoutsRef.current[routeKey],
    )

    if (!merged) {
      return
    }

    setTabFrames((current) => {
      const previous = current[routeKey]
      if (framesEqual(previous, merged)) {
        return current
      }

      return { ...current, [routeKey]: merged }
    })
  }, [])

  const focusedRouteKey = state.routes[state.index]?.key
  const focusedTabFrame = focusedRouteKey ? tabFrames[focusedRouteKey] : null
  const pillTranslateTarget = computeTabPillTranslateX(focusedTabFrame, PILL_WIDTH)
  const pillReady = pillTranslateTarget != null

  useEffect(() => {
    if (!pillReady) {
      return
    }

    if (!hasAnimatedPillRef.current || reduceMotion) {
      pillTranslateX.setValue(pillTranslateTarget)
      hasAnimatedPillRef.current = true
      return
    }

    Animated.spring(pillTranslateX, {
      toValue: pillTranslateTarget,
      stiffness: 420,
      damping: 34,
      mass: 1,
      useNativeDriver,
    }).start()
  }, [pillReady, pillTranslateTarget, pillTranslateX, reduceMotion])

  useEffect(() => {
    state.routes.forEach((route, index) => {
      const focused = index === state.index
      const anims = ensureTabAnims(tabAnimsRef.current, route.key, focused)
      const animation = runFocusAnimation(anims, focused, reduceMotion)
      animation?.start()
    })
  }, [reduceMotion, state.index, state.routes])

  const tabBarStyle = descriptors[focusedRouteKey]?.options?.tabBarStyle ?? {}
  const tabBarItemStyle = descriptors[focusedRouteKey]?.options?.tabBarItemStyle ?? {}
  const tabBarLabelStyle = descriptors[focusedRouteKey]?.options?.tabBarLabelStyle ?? {}

  return (
    <View accessibilityRole="tablist" style={[styles.bar, tabBarStyle]}>
      {pillReady ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.slidingPill,
            {
              transform: [{ translateX: pillTranslateX }],
            },
          ]}
        />
      ) : null}

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
            onLayout={(event) => {
              const { x, width } = event.nativeEvent.layout
              pressableLayoutsRef.current[route.key] = { x, width }
              syncTabFrame(route.key)
            }}
            onLongPress={onLongPress}
            onPress={onPress}
            style={[styles.item, tabBarItemStyle]}
          >
            <View
              style={styles.tabContent}
              onLayout={(event) => {
                const { x, width } = event.nativeEvent.layout
                contentLayoutsRef.current[route.key] = { x, width }
                syncTabFrame(route.key)
              }}
            >
              <Animated.View
                style={[styles.iconStack, { transform: [{ scale: anims.iconScale }] }]}
              >
                <Ionicons
                  name={focused ? iconMeta.active : iconMeta.inactive}
                  color={focused ? colors.accent : colors.muted}
                  size={iconSize.tab}
                />
              </Animated.View>
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
    position: 'relative',
  },
  slidingPill: {
    position: 'absolute',
    top: (iconSize.tabTouch - PILL_HEIGHT) / 2 - 6,
    left: 0,
    width: PILL_WIDTH,
    height: PILL_HEIGHT,
    borderRadius: PILL_RADIUS,
    backgroundColor: colors.tabPillFill,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: iconSize.tabTouch,
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconStack: {
    width: iconSize.tab,
    height: iconSize.tab,
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
    fontSize: typography.micro,
    fontWeight: '600',
    lineHeight: 12,
    textAlign: 'center',
  },
  labelActive: {
    position: 'absolute',
  },
})
