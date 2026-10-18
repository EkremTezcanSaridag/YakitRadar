import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { CommonActions } from '@react-navigation/native'
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { colors, iconSize, typography } from '../theme'
import {
  computeTabPillTop,
  computeTabPillTranslateX,
  PILL_HEIGHT,
  PILL_RADIUS,
  resolvePillWidth,
} from '../utils/tabPillLayout'

const useNativeDriver = Platform.OS !== 'web'
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

function isRouteHidden(options) {
  if (options.tabBarButton === null) {
    return true
  }

  const itemStyle = StyleSheet.flatten(options.tabBarItemStyle ?? {})
  return itemStyle.display === 'none'
}

function framesEqual(first, second) {
  if (!first || !second) {
    return false
  }

  return (
    first.x === second.x
    && first.y === second.y
    && first.width === second.width
    && first.height === second.height
  )
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
  const itemLayoutsRef = useRef({})
  const iconLayoutsRef = useRef({})
  const hasPositionedPillRef = useRef(false)
  const lastFocusedKeyRef = useRef(null)
  const [itemFrames, setItemFrames] = useState({})
  const [iconFrames, setIconFrames] = useState({})
  const [pillTop, setPillTop] = useState(0)
  const [pillWidth, setPillWidth] = useState(resolvePillWidth(56))

  const focusedRoute = state.routes[state.index]
  const focusedRouteKey = focusedRoute?.key

  const tabBarStyle = descriptors[focusedRouteKey]?.options?.tabBarStyle ?? {}

  const visibleRoutes = useMemo(
    () => state.routes.filter((route) => !isRouteHidden(descriptors[route.key].options)),
    [descriptors, state.routes],
  )

  const syncItemFrame = useCallback((routeKey) => {
    const layout = itemLayoutsRef.current[routeKey]

    if (!layout) {
      return
    }

    setItemFrames((current) => {
      const previous = current[routeKey]
      if (framesEqual(previous, layout)) {
        return current
      }

      return { ...current, [routeKey]: layout }
    })
  }, [])

  const syncIconFrame = useCallback((routeKey) => {
    const layout = iconLayoutsRef.current[routeKey]

    if (!layout) {
      return
    }

    setIconFrames((current) => {
      const previous = current[routeKey]
      if (framesEqual(previous, layout)) {
        return current
      }

      return { ...current, [routeKey]: layout }
    })
  }, [])

  const allTabsMeasured = visibleRoutes.every(
    (route) => itemFrames[route.key] && iconFrames[route.key],
  )

  const focusedItemFrame = focusedRouteKey ? itemFrames[focusedRouteKey] : null
  const focusedIconFrame = focusedRouteKey ? iconFrames[focusedRouteKey] : null
  const pillTranslateTarget = computeTabPillTranslateX(focusedItemFrame)
  const pillTopTarget = computeTabPillTop(focusedItemFrame, focusedIconFrame)
  const pillReady = allTabsMeasured && pillTranslateTarget != null && pillTopTarget != null

  useEffect(() => {
    if (!pillReady) {
      return
    }

    const nextPillWidth = resolvePillWidth(focusedItemFrame.width)
    setPillWidth(nextPillWidth)
    setPillTop(pillTopTarget)

    const focusChanged = lastFocusedKeyRef.current !== focusedRouteKey
    lastFocusedKeyRef.current = focusedRouteKey

    if (!hasPositionedPillRef.current) {
      pillTranslateX.setValue(pillTranslateTarget)
      hasPositionedPillRef.current = true
      return
    }

    if (!focusChanged) {
      pillTranslateX.stopAnimation()
      pillTranslateX.setValue(pillTranslateTarget)
      return
    }

    if (reduceMotion) {
      pillTranslateX.setValue(pillTranslateTarget)
      return
    }

    Animated.spring(pillTranslateX, {
      toValue: pillTranslateTarget,
      stiffness: 420,
      damping: 34,
      mass: 1,
      useNativeDriver,
    }).start()
  }, [
    focusedItemFrame,
    focusedRouteKey,
    pillReady,
    pillTopTarget,
    pillTranslateTarget,
    pillTranslateX,
    reduceMotion,
  ])

  useEffect(() => {
    state.routes.forEach((route, index) => {
      const focused = index === state.index
      const anims = ensureTabAnims(tabAnimsRef.current, route.key, focused)
      const animation = runFocusAnimation(anims, focused, reduceMotion)
      animation?.start()
    })
  }, [reduceMotion, state.index, state.routes])

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
              top: pillTop,
              width: pillWidth,
              transform: [{ translateX: pillTranslateX }],
            },
          ]}
        />
      ) : null}

      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key]

        if (isRouteHidden(options)) {
          return null
        }

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
              const { x, y, width, height } = event.nativeEvent.layout
              itemLayoutsRef.current[route.key] = { x, y, width, height }
              syncItemFrame(route.key)
            }}
            onLongPress={onLongPress}
            onPress={onPress}
            style={[styles.item, tabBarItemStyle]}
          >
            <Animated.View
              onLayout={(event) => {
                const { x, y, height, width } = event.nativeEvent.layout
                iconLayoutsRef.current[route.key] = { x, y, height, width }
                syncIconFrame(route.key)
              }}
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
                maxFontSizeMultiplier={1.2}
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
                maxFontSizeMultiplier={1.2}
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
    direction: 'ltr',
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  slidingPill: {
    position: 'absolute',
    left: 0,
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
