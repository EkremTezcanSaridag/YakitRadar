import { useEffect, useRef } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { Animated, Easing, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native'
import { colors, radii, spacing } from '../theme'

const TYPE_META = {
  success: {
    icon: 'checkmark-circle',
    iconColor: colors.priceFall,
    borderColor: colors.toastBorder.success,
    liveRegion: 'polite',
    role: undefined,
  },
  info: {
    icon: 'information-circle',
    iconColor: colors.accent,
    borderColor: colors.toastBorder.info,
    liveRegion: 'polite',
    role: undefined,
  },
  warning: {
    icon: 'warning',
    iconColor: colors.toastWarning,
    borderColor: colors.toastBorder.warning,
    liveRegion: 'polite',
    role: undefined,
  },
  error: {
    icon: 'alert-circle',
    iconColor: colors.priceRise,
    borderColor: colors.toastBorder.error,
    liveRegion: 'assertive',
    role: 'alert',
  },
}

export default function Toast({
  type,
  message,
  actionLabel,
  onAction,
  onDismiss,
  bottomOffset,
  reduceMotion,
  visible,
}) {
  const translateY = useRef(new Animated.Value(16)).current
  const opacity = useRef(new Animated.Value(0)).current
  const meta = TYPE_META[type] ?? TYPE_META.info

  useEffect(() => {
    if (!visible) {
      return undefined
    }

    translateY.setValue(reduceMotion ? 0 : 16)
    opacity.setValue(0)

    if (reduceMotion) {
      Animated.timing(opacity, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }).start()
      return undefined
    }

    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start()

    return undefined
  }, [opacity, reduceMotion, translateY, visible, message, type])

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 4,
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > 40) {
          onDismiss()
        }
      },
    }),
  ).current

  if (!visible) {
    return null
  }

  return (
    <Animated.View
      accessibilityLiveRegion={meta.liveRegion}
      accessibilityRole={meta.role}
      pointerEvents="box-none"
      style={[
        styles.container,
        {
          bottom: bottomOffset,
          opacity,
          transform: [{ translateY }],
        },
      ]}
      {...panResponder.panHandlers}
    >
      <View style={[styles.box, { borderColor: meta.borderColor }]}>
        <Ionicons color={meta.iconColor} name={meta.icon} size={20} />
        <Text allowFontScaling ellipsizeMode="tail" numberOfLines={2} style={styles.message}>{message}</Text>
        {actionLabel && onAction ? (
          <Pressable accessibilityRole="button" hitSlop={8} onPress={onAction} style={styles.action}>
            <Text allowFontScaling style={styles.actionText}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    left: spacing.lg,
    maxWidth: 480,
    position: 'absolute',
    right: spacing.lg,
    width: '100%',
    zIndex: 1000,
  },
  box: {
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.card,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  message: {
    color: colors.text,
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  action: {
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: spacing.xs,
  },
  actionText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
})
