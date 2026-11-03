import { Platform, StyleSheet, Switch, Text, View } from 'react-native'
import { colors, switchThumbColor, switchTrackColors } from '../theme'

export default function NotificationSettingsRow({
  children,
  description,
  disabled = false,
  icon,
  isFirst = false,
  onValueChange,
  title,
  value,
}) {
  return (
    <View style={[styles.row, isFirst && styles.rowFirst]}>
      {icon ? <View style={styles.iconWrap}>{icon}</View> : null}
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
        {children}
      </View>
      {typeof value === 'boolean' && onValueChange ? (
        <View style={styles.switchSlot}>
          <Switch
            disabled={disabled}
            ios_backgroundColor={colors.switchTrackOff}
            onValueChange={onValueChange}
            thumbColor={Platform.OS === 'android' ? switchThumbColor(value) : undefined}
            trackColor={switchTrackColors}
            value={value}
          />
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    minHeight: 56,
    paddingVertical: 10,
  },
  rowFirst: {
    borderTopWidth: 0,
    marginTop: 4,
  },
  iconWrap: {
    alignItems: 'center',
    backgroundColor: colors.bgSoft,
    borderRadius: 8,
    height: 36,
    justifyContent: 'center',
    marginRight: 10,
    width: 36,
  },
  copy: {
    flex: 1,
    paddingRight: 8,
  },
  title: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  description: {
    color: colors.mutedSoft,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
    marginTop: 3,
  },
  switchSlot: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    width: 52,
  },
})
