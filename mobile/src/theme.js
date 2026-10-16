const PRICE_RISE = '#FF6B6B'
const PRICE_FALL = '#34D399'

export const colors = {
  bg: '#000000',
  surface: '#0E0E10',
  surfaceAlt: '#17171A',
  selected: '#17171A',
  border: '#26262B',
  borderLight: '#26262B',
  text: '#F5F5F7',
  muted: '#A1A1AA',
  mutedSoft: '#6B6B73',
  accent: '#4C8DFF',
  accentPressed: '#3A75E0',
  onAccent: '#000000',
  accentDark: '#17171A',
  accentSoft: '#4C8DFF29',
  tabPillFill: 'rgba(76, 141, 255, 0.22)',
  danger: '#C96A6A',
  dangerDark: '#17171A',
  success: '#6B9E7A',
  successDark: '#17171A',
  warning: '#A1A1AA',
  warningDark: '#17171A',
  info: '#A1A1AA',
  fuelStripeBenzin: '#8A8470',
  fuelStripeMotorin: '#6E7A8A',
  fuelStripeLpg: '#7A7A82',
  chartBenzin: '#6E9FD4',
  chartMotorin: '#6B7A94',
  chartLpg: '#8A86A8',
  stationShell: '#2563A8',
  tabBar: '#000000',
  paper: '#F5F5F7',
  paperText: '#000000',
  paperMuted: '#6B6B73',
  white: '#F5F5F7',
  bgSoft: '#0E0E10',
  purpleGlow: '#A1A1AA',
  purpleDark: '#17171A',
  overlay: '#00000099',
  priceRise: PRICE_RISE,
  priceRiseBg: 'rgba(255,107,107,0.10)',
  priceRiseBorder: 'rgba(255,107,107,0.35)',
  priceFall: PRICE_FALL,
  priceFallBg: 'rgba(52,211,153,0.10)',
  priceFallBorder: 'rgba(52,211,153,0.35)',
  expectedIncrease: PRICE_RISE,
  expectedIncreaseBg: 'rgba(255,107,107,0.10)',
  expectedIncreaseBorder: 'rgba(255,107,107,0.35)',
  expectedDecrease: PRICE_FALL,
  expectedDecreaseBg: 'rgba(52,211,153,0.10)',
  expectedDecreaseBorder: 'rgba(52,211,153,0.35)',
  favorite: '#4C8DFF',
  favoriteSoft: '#4C8DFF29',
  switchThumbOff: '#D6DEE9',
  switchTrackOff: '#25364F',
  switchTrackOn: '#17171A',
  fuelIconBgBenzin: '#0C2A4A',
  fuelIconBgMotorin: '#152238',
  fuelIconBgLpg: '#1C1C24',
  chartTrack: 'rgba(255, 255, 255, 0.05)',
  stationBrandOpet: '#0055A5',
  stationBrandPetrolOfisi: '#E30613',
  stationBrandAytemiz: '#FF6600',
  stationBrandTotal: '#ED1C24',
  stationBrandTp: '#009944',
  stationBrandSunpet: '#00A3E0',
  stationBrandOther: '#888888',
  notificationLed: '#4C8DFF',
  skeleton: '#1F1F25',
  skeletonHighlight: '#2C2C34',
  mutedAccessible: '#8A8A93',
  toastWarning: '#FBBF24',
  toastBorder: {
    success: 'rgba(52,211,153,.35)',
    error: 'rgba(255,107,107,.35)',
    warning: 'rgba(251,191,36,.35)',
    info: 'rgba(76,141,255,.35)',
  },
}

export const typography = {
  display: 32,
  title: 24,
  heading: 18,
  body: 15,
  caption: 13,
  micro: 11,
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  screen: 20,
  cardGap: 12,
  cardPadding: 16,
  section: 24,
}

export const radii = {
  card: 16,
  pill: 999,
}

export const iconSize = {
  tab: 22,
  tabTouch: 48,
}

export const shadows = {
  card: {
    shadowColor: colors.bg,
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  soft: {
    shadowColor: colors.bg,
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
}

export const switchTrackColors = {
  false: colors.switchTrackOff,
  true: colors.switchTrackOn,
}

export function switchThumbColor(on) {
  return on ? colors.accent : colors.switchThumbOff
}

export function fuelAlertIconStyle(fuelKey) {
  if (fuelKey === 'motorin') {
    return { backgroundColor: colors.fuelIconBgMotorin, color: colors.chartMotorin }
  }
  if (fuelKey === 'lpg') {
    return { backgroundColor: colors.fuelIconBgLpg, color: colors.chartLpg }
  }
  return { backgroundColor: colors.fuelIconBgBenzin, color: colors.accent }
}
