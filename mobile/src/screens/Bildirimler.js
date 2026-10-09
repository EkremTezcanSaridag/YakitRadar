import { useEffect, useMemo, useState } from 'react'
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native'
import ScreenHeader from '../components/ScreenHeader'
import { colors, shadows } from '../theme'
import { useFuelData } from '../hooks/useFuelData'
import { fuelTabs } from '../services/fuelData'
import {
  cancelWeeklySummaryNotification,
  defaultNotificationSettings,
  getNotificationPermissionStatus,
  loadNotificationSettings,
  requestNotificationAccess,
  requestRemoteTestNotification,
  saveAndSyncNotificationSettings,
  scheduleWeeklySummaryNotification,
  sendTestNotification,
} from '../services/notifications'
import {
  addCustomAlert,
  alertConditions,
  defaultAlerts,
  deleteCustomAlert,
  loadCustomAlerts,
  toggleCustomAlert,
} from '../services/customAlerts'
import { loadShowMarketNote, saveShowMarketNote } from '../services/uiPreferences'

const fuelChips = ['Benzin', 'Motorin', 'LPG']

function getPermissionCopy(permission) {
  if (permission.granted) {
    if (permission.tokenError) {
      return {
        badge: 'Yerel Aktif',
        icon: 'bell-check-outline',
        title: 'Cihaz Bildirimleri Aktif',
        desc: 'Özel fiyat alarmlarınız ve haftalık özetler cihazınızda anlık çalışır.',
        tone: 'active',
      }
    }

    return {
      badge: 'Aktif',
      icon: 'bell-check-outline',
      title: 'Bildirim izni açık',
      desc: permission.expoPushToken ? 'Push token hazırlandı.' : 'Yerel bildirimler hazır.',
      tone: 'active',
    }
  }

  if (permission.tokenError) {
    return {
      badge: 'Kontrol gerekli',
      icon: 'alert-circle-outline',
      title: 'Bildirim bağlantısı kurulamadı',
      desc: 'Aşağıdaki ayrıntıyı kontrol edip tekrar deneyin.',
      tone: 'blocked',
    }
  }

  if (permission.canAskAgain === false) {
    return {
      badge: 'Kapalı',
      icon: 'bell-off-outline',
      title: 'Telefon izni kapalı',
      desc: 'Bildirimleri açmak için cihaz ayarlarından izin vermek gerekiyor.',
      tone: 'blocked',
    }
  }

  return {
    badge: 'Bekliyor',
    icon: 'bell-plus-outline',
    title: 'Bildirim izni bekliyor',
    desc: 'Açık ayarlardan biri seçildiğinde izin isteyeceğiz.',
    tone: 'pending',
  }
}

function formatToken(token) {
  if (!token) {
    return 'Token yok'
  }

  return `${token.slice(0, 18)}...${token.slice(-6)}`
}

export default function Bildirimler() {
  const { data } = useFuelData()
  const [settings, setSettings] = useState(defaultNotificationSettings)
  const [customAlerts, setCustomAlerts] = useState(defaultAlerts)
  const [newAlertModalOpen, setNewAlertModalOpen] = useState(false)

  // New Custom Alert Form State
  const [alertCity, setAlertCity] = useState('İstanbul')
  const [alertFuelKey, setAlertFuelKey] = useState('benzin95')
  const [alertCondition, setAlertCondition] = useState('below_price')
  const [alertTargetValue, setAlertTargetValue] = useState('70')

  const [permission, setPermission] = useState({
    canAskAgain: true,
    expoPushToken: null,
    granted: false,
    status: 'undetermined',
    tokenError: null,
  })
  const [loading, setLoading] = useState(true)
  const [permissionBusy, setPermissionBusy] = useState(false)
  const [testBusy, setTestBusy] = useState(false)
  const [showMarketNote, setShowMarketNote] = useState(true)
  const cityChips = data.cities.slice(0, 3).map((city) => city.name)
  const registrationMeta = useMemo(
    () => ({
      trackedCities: cityChips,
      trackedFuels: fuelChips,
    }),
    [cityChips.join('|')],
  )
  const permissionCopy = getPermissionCopy(permission)

  useEffect(() => {
    let isMounted = true

    loadNotificationSettings().then(async (storedSettings) => {
      const currentPermission = await getNotificationPermissionStatus(storedSettings, registrationMeta)

      if (!isMounted) {
        return
      }

      setSettings(storedSettings)
      setPermission(currentPermission)
      setLoading(false)
    })

    loadCustomAlerts().then((alerts) => {
      if (isMounted) {
        setCustomAlerts(alerts)
      }
    })

    loadShowMarketNote().then((enabled) => {
      if (isMounted) {
        setShowMarketNote(enabled)
      }
    })

    return () => {
      isMounted = false
    }
  }, [registrationMeta])

  const notificationRows = useMemo(
    () => [
      {
        desc: 'Önemli fiyat hareketlerinde anlık uyarı.',
        icon: 'bell-ring-outline',
        key: 'dailyAlerts',
        title: 'Günlük fiyat uyarıları',
        value: settings.dailyAlerts,
      },
      {
        desc: 'Takip edilen iller için ayrı bildirim.',
        icon: 'map-marker-radius-outline',
        key: 'cityAlerts',
        title: 'İl bazlı uyarılar',
        value: settings.cityAlerts,
      },
      {
        desc: 'Haftalık kısa fiyat özeti.',
        icon: 'email-newsletter',
        key: 'weeklySummary',
        title: 'Haftalık özet',
        value: settings.weeklySummary,
      },
    ],
    [settings],
  )

  async function ensureNotificationAccess() {
    setPermissionBusy(true)

    const nextPermission = await requestNotificationAccess(settings, registrationMeta)

    setPermission(nextPermission)
    setPermissionBusy(false)

    if (!nextPermission.granted) {
      Alert.alert('Bildirim izni kapalı', 'Telefon ayarlarından Yakıt Radar bildirimlerine izin vermen gerekiyor.')
      return false
    }

    return true
  }

  async function updateSetting(key, value) {
    if (value && key !== 'quietHours') {
      const allowed = await ensureNotificationAccess()

      if (!allowed) {
        return
      }
    }

    const nextSettings = {
      ...settings,
      [key]: value,
    }

    setSettings(nextSettings)
    const registration = await saveAndSyncNotificationSettings(nextSettings, permission.expoPushToken, registrationMeta)

    if (key === 'weeklySummary') {
      if (value) {
        scheduleWeeklySummaryNotification(data.prices).catch(() => {})
      } else {
        cancelWeeklySummaryNotification().catch(() => {})
      }
    }

    if (registration.error) {
      setPermission((current) => ({
        ...current,
        tokenError: registration.error,
      }))
    }
  }

  async function handleTestNotification() {
    const allowed = permission.granted || (await ensureNotificationAccess())

    if (!allowed) {
      return
    }

    setTestBusy(true)

    try {
      await requestRemoteTestNotification()
      Alert.alert('Backend testi sırada', 'GitHub Action tamamlandığında gerçek push bildirimi bu cihaza gönderilecek.')
    } catch (error) {
      try {
        await sendTestNotification()
        Alert.alert('Test Bildirimi Gönderildi', 'Yerel bildirim kanalı test edildi. Bildirim çubuğunuzu kontrol edin.')
      } catch (localError) {
        Alert.alert('Bildirim gönderilemedi', localError?.message ?? error?.message ?? 'Beklenmeyen bir sorun oluştu.')
      }
    } finally {
      setTestBusy(false)
    }
  }

  async function handleCreateCustomAlert() {
    const selectedFuelMeta = fuelTabs.find((f) => f.key === alertFuelKey) ?? fuelTabs[0]

    const updatedAlerts = await addCustomAlert({
      city: alertCity,
      condition: alertCondition,
      fuelKey: alertFuelKey,
      fuelTitle: selectedFuelMeta.title,
      targetValue: alertTargetValue.trim(),
    })

    setCustomAlerts(updatedAlerts)
    setNewAlertModalOpen(false)
    Alert.alert('Fiyat Alarmı Eklendi', `${alertCity} ${selectedFuelMeta.title} için özel alarmınız aktif tutuldu.`)
  }

  async function handleToggleAlert(id) {
    const updated = await toggleCustomAlert(id)
    setCustomAlerts(updated)
  }

  async function handleDeleteAlert(id) {
    Alert.alert('Alarmı Sil', 'Bu özel bildirim alarmını silmek istediğinize emin misiniz?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: async () => {
          const updated = await deleteCustomAlert(id)
          setCustomAlerts(updated)
        },
      },
    ])
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader showRefresh title="Bildirimler" />

        <View style={styles.summaryCard}>
          <View style={styles.summaryIcon}>
            <Ionicons name={permission.granted ? 'notifications-outline' : 'notifications-off-outline'} size={22} color={colors.muted} />
          </View>
          <View style={styles.summaryText}>
            <Text style={styles.summaryTitle}>{permissionCopy.title}</Text>
            <Text style={styles.summaryDesc}>{loading ? 'Durum kontrol ediliyor.' : permissionCopy.desc}</Text>
            {permission.granted && !permission.tokenError && (
              <Text style={styles.tokenText}>Expo token: {formatToken(permission.expoPushToken)}</Text>
            )}
          </View>
        </View>

        {permission.tokenError && (
          <View style={styles.errorCard}>
            <MaterialCommunityIcons name="information-outline" size={18} color={colors.danger} />
            <Text style={styles.errorText}>{permission.tokenError}</Text>
          </View>
        )}

        {/* Kişisel Fiyat Alarmları Paneli */}
        <View style={styles.panel}>
          <View style={styles.panelHeaderRow}>
            <View style={styles.panelHeaderCopy}>
              <Text style={styles.panelTitle}>Kişisel Fiyat Alarmları</Text>
              <Text style={styles.panelSubtitle}>Hedef eşiklere ulaşıldığında anında bildirim alırsınız.</Text>
            </View>
          </View>

          {customAlerts.map((alertItem, idx) => {
            const condMeta = alertConditions.find((c) => c.id === alertItem.condition) ?? alertConditions[0]
            const isMotorin = alertItem.fuelKey === 'motorin'
            const isLpg = alertItem.fuelKey === 'lpg'
            const fuelIcon = isMotorin ? 'truck-outline' : isLpg ? 'fire' : 'gas-station'
            const fuelColor = isMotorin ? colors.warning : isLpg ? colors.purpleGlow : colors.accent
            const fuelBg = isMotorin ? '#2D1F08' : isLpg ? '#261438' : '#0C2A4A'

            return (
              <View key={alertItem.id} style={[styles.customAlertRow, idx === 0 && styles.rowFirst]}>
                <View style={[styles.customAlertIconBox, { backgroundColor: fuelBg }]}>
                  <MaterialCommunityIcons name={fuelIcon} size={18} color={fuelColor} />
                </View>
                <View style={styles.customAlertInfo}>
                  <Text style={styles.customAlertTitle}>{alertItem.city} · {alertItem.fuelTitle}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <MaterialCommunityIcons name={condMeta.icon} size={13} color={fuelColor} />
                    <Text style={styles.customAlertDesc}>
                      {alertItem.condition === 'news_hike'
                        ? 'Groq AI zam haberi tespit edince uyar'
                        : alertItem.condition === 'below_price'
                        ? `Fiyat ${alertItem.targetValue} TL altına düşünce uyar`
                        : `Fiyat ${alertItem.targetValue} TL aşınca uyar`}
                    </Text>
                  </View>
                </View>
                <View style={styles.customAlertActions}>
                  <Switch
                    onValueChange={() => handleToggleAlert(alertItem.id)}
                    thumbColor={alertItem.isEnabled ? colors.accent : '#D6DEE9'}
                    trackColor={{ false: '#25364F', true: colors.accentDark }}
                    value={alertItem.isEnabled}
                  />
                  <Pressable onPress={() => handleDeleteAlert(alertItem.id)} style={styles.deleteAlertBtn}>
                    <MaterialCommunityIcons name="trash-can-outline" size={16} color={colors.danger} />
                  </Pressable>
                </View>
              </View>
            )
          })}

          <Pressable onPress={() => setNewAlertModalOpen(true)} style={({ pressed }) => [styles.fullWidthAddAlertBtn, pressed && styles.pressed]}>
            <MaterialCommunityIcons name="bell-plus-outline" size={18} color={colors.bg} />
            <Text style={styles.fullWidthAddAlertBtnText}>+ Yeni Fiyat Alarmı Oluştur</Text>
          </Pressable>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Görünüm</Text>
          <View style={[styles.row, styles.rowFirst]}>
            <View style={styles.rowIcon}>
              <Ionicons name="pulse-outline" size={18} color={colors.muted} />
            </View>
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle}>Piyasa notunu göster</Text>
              <Text style={styles.rowDesc}>Ana sayfada piyasa analizi özetini gösterir.</Text>
            </View>
            <Switch
              onValueChange={async (value) => {
                setShowMarketNote(value)
                await saveShowMarketNote(value)
              }}
              thumbColor={showMarketNote ? colors.accent : '#D6DEE9'}
              trackColor={{ false: '#25364F', true: colors.accentDark }}
              value={showMarketNote}
            />
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Uyarı Ayarları</Text>

          {notificationRows.map((row, index) => (
            <View key={row.key} style={[styles.row, index === 0 && styles.rowFirst]}>
              <View style={styles.rowIcon}>
                <MaterialCommunityIcons name={row.icon} size={18} color={colors.accent} />
              </View>
              <View style={styles.rowCopy}>
                <Text style={styles.rowTitle}>{row.title}</Text>
                <Text style={styles.rowDesc}>{row.desc}</Text>
              </View>
              <Switch
                disabled={permissionBusy}
                onValueChange={(value) => updateSetting(row.key, value)}
                thumbColor={row.value ? colors.accent : '#D6DEE9'}
                trackColor={{ false: '#25364F', true: colors.accentDark }}
                value={row.value}
              />
            </View>
          ))}
        </View>

        <View style={styles.panel}>
          <View style={styles.panelTop}>
            <View>
              <Text style={styles.panelTitle}>Sessiz Saatler</Text>
              <Text style={styles.panelSubtitle}>Kritik olmayan bildirimleri duraklatır.</Text>
            </View>
            <Switch
              onValueChange={(value) => updateSetting('quietHours', value)}
              thumbColor={settings.quietHours ? colors.accent : '#D6DEE9'}
              trackColor={{ false: '#25364F', true: colors.accentDark }}
              value={settings.quietHours}
            />
          </View>

          <View style={styles.timeRow}>
            <View style={styles.timeChip}>
              <MaterialCommunityIcons name="weather-night" size={15} color={colors.accent} />
              <Text style={styles.timeText}>22:00</Text>
            </View>
            <View style={styles.timeLine} />
            <View style={styles.timeChip}>
              <MaterialCommunityIcons name="white-balance-sunny" size={15} color={colors.warning} />
              <Text style={styles.timeText}>08:00</Text>
            </View>
          </View>
        </View>

      </ScrollView>

      {/* Yeni Fiyat Alarmı Ekle Modalı */}
      <Modal animationType="slide" visible={newAlertModalOpen} transparent onRequestClose={() => setNewAlertModalOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setNewAlertModalOpen(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleGroup}>
                <MaterialCommunityIcons name="bell-plus" size={22} color={colors.accent} />
                <Text style={styles.modalTitle}>Yeni Fiyat Alarmı Ekle</Text>
              </View>
              <Pressable accessibilityLabel="Kapat" onPress={() => setNewAlertModalOpen(false)} style={styles.closeButton}>
                <MaterialCommunityIcons name="close" size={20} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>Şehir</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRowContainer}>
                {['Tüm Şehirler', ...data.prices.map((p) => p.city)].map((cityName) => {
                  const isSelected = alertCity === cityName
                  return (
                    <Pressable key={cityName} onPress={() => setAlertCity(cityName)} style={[styles.selectChip, isSelected && styles.selectChipActive]}>
                      <Text style={[styles.selectChipText, isSelected && styles.selectChipTextActive]}>{cityName}</Text>
                    </Pressable>
                  )
                })}
              </ScrollView>

              <Text style={styles.fieldLabel}>Yakıt Türü</Text>
              <View style={styles.fuelSelectorRow}>
                {fuelTabs.map((fuel) => {
                  const selected = fuel.key === alertFuelKey
                  return (
                    <Pressable key={fuel.key} onPress={() => setAlertFuelKey(fuel.key)} style={[styles.fuelOption, selected && styles.fuelOptionActive]}>
                      <MaterialCommunityIcons name={fuel.icon} size={15} color={selected ? colors.bg : colors.mutedSoft} />
                      <Text style={[styles.fuelOptionText, selected && styles.fuelOptionTextActive]}>{fuel.label}</Text>
                    </Pressable>
                  )
                })}
              </View>

              <Text style={styles.fieldLabel}>Alarm Koşulu</Text>
              {alertConditions.map((cond) => {
                const isSelected = alertCondition === cond.id
                return (
                  <Pressable key={cond.id} onPress={() => setAlertCondition(cond.id)} style={[styles.condCard, isSelected && styles.condCardActive]}>
                    <MaterialCommunityIcons name={cond.icon} size={18} color={isSelected ? colors.accent : colors.mutedSoft} />
                    <View style={styles.condCardCopy}>
                      <Text style={[styles.condCardTitle, isSelected && styles.condCardTitleActive]}>{cond.label}</Text>
                      <Text style={styles.condCardDesc}>{cond.desc}</Text>
                    </View>
                  </Pressable>
                )
              })}

              {alertCondition !== 'news_hike' ? (
                <View style={{ marginTop: 14 }}>
                  <Text style={styles.fieldLabel}>Hedef Fiyat Eşiği (TL)</Text>
                  <View style={styles.inputShell}>
                    <TextInput value={alertTargetValue} onChangeText={setAlertTargetValue} keyboardType="decimal-pad" placeholder="70.00" placeholderTextColor={colors.muted} style={styles.input} />
                    <Text style={styles.unit}>TL</Text>
                  </View>
                </View>
              ) : null}

              <Pressable onPress={handleCreateCustomAlert} style={({ pressed }) => [styles.saveAlertButton, pressed && styles.pressed]}>
                <MaterialCommunityIcons name="check-circle-outline" size={19} color={colors.bg} />
                <Text style={styles.saveAlertButtonText}>Alarmı Kur</Text>
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    backgroundColor: colors.bg,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 96,
  },
  header: {
    alignItems: 'center',
    backgroundColor: colors.bg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: -16,
    marginTop: -8,
    marginBottom: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerMark: {
    alignItems: 'center',
    backgroundColor: colors.bgSoft,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandMain: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  brandAccent: {
    color: colors.accent,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  titleRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  titleCopy: {
    flex: 1,
    paddingRight: 12,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 5,
  },
  statusBadge: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  activeBadge: {
    backgroundColor: colors.accentDark,
    borderColor: colors.accent,
  },
  pendingBadge: {
    backgroundColor: colors.bgSoft,
    borderColor: colors.border,
  },
  blockedBadge: {
    backgroundColor: colors.dangerDark,
    borderColor: colors.danger,
  },
  statusDot: {
    borderRadius: 999,
    height: 7,
    marginRight: 6,
    width: 7,
  },
  activeDot: {
    backgroundColor: colors.accent,
  },
  pendingDot: {
    backgroundColor: colors.warning,
  },
  blockedDot: {
    backgroundColor: colors.danger,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '900',
  },
  activeText: {
    color: colors.accent,
  },
  pendingText: {
    color: colors.warning,
  },
  blockedText: {
    color: colors.danger,
  },
  summaryCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 12,
    padding: 14,
    ...shadows.card,
  },
  summaryIcon: {
    alignItems: 'center',
    backgroundColor: colors.bgSoft,
    borderRadius: 8,
    height: 42,
    justifyContent: 'center',
    marginRight: 12,
    width: 42,
  },
  summaryText: {
    flex: 1,
  },
  summaryTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  summaryDesc: {
    color: colors.mutedSoft,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  tokenText: {
    color: colors.info,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 5,
  },
  errorCard: {
    alignItems: 'flex-start',
    backgroundColor: colors.dangerDark,
    borderColor: colors.danger,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 12,
    padding: 12,
  },
  errorText: {
    color: colors.text,
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
    marginLeft: 8,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 2,
  },
  actionButton: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 8,
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 12,
  },
  actionButtonText: {
    color: colors.bg,
    fontSize: 12,
    fontWeight: '900',
    marginLeft: 7,
  },
  ghostButton: {
    alignItems: 'center',
    backgroundColor: colors.bgSoft,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 12,
  },
  ghostButtonText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '900',
    marginLeft: 7,
  },
  disabled: {
    opacity: 0.55,
  },
  pressed: {
    opacity: 0.74,
  },
  panel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
    padding: 14,
    ...shadows.soft,
  },
  panelTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  panelTitle: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '900',
  },
  panelSubtitle: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
  row: {
    alignItems: 'center',
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    paddingTop: 13,
    paddingBottom: 13,
  },
  rowFirst: {
    marginTop: 8,
  },
  rowIcon: {
    alignItems: 'center',
    backgroundColor: colors.bgSoft,
    borderRadius: 8,
    height: 36,
    justifyContent: 'center',
    marginRight: 10,
    width: 36,
  },
  rowCopy: {
    flex: 1,
    paddingRight: 12,
  },
  rowTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  rowDesc: {
    color: colors.mutedSoft,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
  timeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 16,
  },
  timeChip: {
    alignItems: 'center',
    backgroundColor: colors.bgSoft,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  timeText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
    marginLeft: 6,
  },
  timeLine: {
    backgroundColor: colors.border,
    flex: 1,
    height: 1,
    marginHorizontal: 10,
  },
  groupLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
    marginTop: 14,
    textTransform: 'uppercase',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  chip: {
    backgroundColor: colors.accentDark,
    borderColor: colors.accent,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 8,
    marginBottom: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  chipText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '900',
  },
  chipMuted: {
    alignItems: 'center',
    backgroundColor: colors.bgSoft,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    marginRight: 8,
    marginBottom: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  chipMutedText: {
    color: colors.mutedSoft,
    fontSize: 12,
    fontWeight: '900',
    marginLeft: 5,
  },
  infoCard: {
    alignItems: 'flex-start',
    backgroundColor: colors.bgSoft,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 12,
    padding: 12,
  },
  infoText: {
    color: colors.mutedSoft,
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 16,
    marginLeft: 8,
  },
  panelHeaderRow: {
    marginBottom: 12,
  },
  panelHeaderCopy: {
    flex: 1,
  },
  fullWidthAddAlertBtn: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
    ...shadows.soft,
  },
  fullWidthAddAlertBtnText: {
    color: colors.bg,
    fontSize: 13,
    fontWeight: '900',
  },
  customAlertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: 10,
  },
  customAlertIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.bgSoft,
    alignItems: 'center',
    justify: 'center',
    marginRight: 10,
  },
  customAlertInfo: {
    flex: 1,
    paddingRight: 6,
  },
  customAlertTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  customAlertDesc: {
    color: colors.mutedSoft,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  customAlertActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deleteAlertBtn: {
    padding: 4,
  },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000099' },
  modalSheet: { maxHeight: '88%', backgroundColor: colors.bg, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 24 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  modalTitleGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: '900' },
  closeButton: { width: 36, height: 36, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  fieldLabel: { color: colors.mutedSoft, fontSize: 12, fontWeight: '700', marginTop: 12, marginBottom: 6 },
  chipRowContainer: { flexDirection: 'row', gap: 8, paddingBottom: 6 },
  selectChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: colors.bgSoft, borderWidth: 1, borderColor: colors.border },
  selectChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  selectChipText: { color: colors.text, fontSize: 12, fontWeight: '700' },
  selectChipTextActive: { color: colors.bg },
  fuelSelectorRow: { flexDirection: 'row', gap: 7 },
  fuelOption: { flex: 1, height: 38, borderRadius: 7, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5 },
  fuelOptionActive: { borderColor: colors.accent, backgroundColor: colors.accent },
  fuelOptionText: { color: colors.mutedSoft, fontSize: 12, fontWeight: '800' },
  fuelOptionTextActive: { color: colors.bg },
  condCard: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgSoft, marginBottom: 8, gap: 10 },
  condCardActive: { borderColor: colors.accent, backgroundColor: colors.surfaceAlt },
  condCardCopy: { flex: 1 },
  condCardTitle: { color: colors.text, fontSize: 13, fontWeight: '800' },
  condCardTitleActive: { color: colors.accent },
  condCardDesc: { color: colors.muted, fontSize: 10, fontWeight: '700', marginTop: 2 },
  inputShell: { height: 44, borderRadius: 7, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bgSoft, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '700' },
  unit: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  saveAlertButton: { height: 46, borderRadius: 8, backgroundColor: colors.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 18 },
  saveAlertButtonText: { color: colors.bg, fontSize: 14, fontWeight: '900' },
})
