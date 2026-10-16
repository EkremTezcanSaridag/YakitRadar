import React from 'react'
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, radii, spacing, typography } from '../theme'
import { logError } from '../utils/logger'
import { buildErrorDigest, reloadApp, shouldReloadAfterRecover } from '../utils/errorRecovery'

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorDigest: null,
      recoverAttempts: 0,
      contentKey: 0,
      recovering: false,
    }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    const errorDigest = buildErrorDigest(error)

    this.setState({
      error,
      errorInfo,
      errorDigest,
    })

    logError('errorBoundary', error)
  }

  handleRecover = async () => {
    const { recoverAttempts, errorDigest } = this.state

    if (shouldReloadAfterRecover(recoverAttempts)) {
      this.setState({ recovering: true })
      const reloaded = await reloadApp()
      this.setState({ recovering: false })

      if (reloaded) {
        return
      }
    }

    this.setState((current) => ({
      hasError: false,
      error: null,
      errorInfo: null,
      errorDigest,
      recoverAttempts: current.recoverAttempts + 1,
      contentKey: current.contentKey + 1,
    }))
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <Ionicons color={colors.priceRise} name="alert-circle-outline" size={64} style={styles.icon} />

            <Text allowFontScaling style={styles.title}>Bir şeyler ters gitti</Text>

            <Text allowFontScaling style={styles.message}>
              Uygulama beklenmedik bir sorunla karşılaştı. Yeniden denemek için dokun.
            </Text>

            {__DEV__ && this.state.error ? (
              <View style={styles.debugContainer}>
                <Text style={styles.debugTitle}>Geliştirici ayrıntısı</Text>
                <Text style={styles.debugText}>{this.state.error.toString()}</Text>
                {this.state.errorInfo?.componentStack ? (
                  <Text style={styles.debugText}>{this.state.errorInfo.componentStack}</Text>
                ) : null}
              </View>
            ) : null}

            <Pressable
              accessibilityRole="button"
              disabled={this.state.recovering}
              onPress={this.handleRecover}
              style={({ pressed }) => [styles.button, pressed && styles.pressed, this.state.recovering && styles.disabled]}
            >
              <Text allowFontScaling style={styles.buttonText}>
                {this.state.recovering ? 'Yenileniyor…' : 'Yeniden dene'}
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      )
    }

    return <React.Fragment key={this.state.contentKey}>{this.props.children}</React.Fragment>
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  icon: {
    marginBottom: spacing.xl,
  },
  title: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: '700',
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  message: {
    color: colors.text,
    fontSize: typography.body,
    lineHeight: 22,
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
    textAlign: 'center',
  },
  button: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: radii.card,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 200,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  buttonText: {
    color: colors.onAccent,
    fontSize: typography.body,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.6,
  },
  debugContainer: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: radii.card,
    borderWidth: 1,
    marginBottom: spacing.xl,
    padding: spacing.lg,
    width: '100%',
  },
  debugTitle: {
    color: colors.muted,
    fontSize: typography.caption,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  debugText: {
    color: colors.mutedSoft,
    fontFamily: 'monospace',
    fontSize: 11,
    lineHeight: 16,
  },
})
