import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { colors } from '../theme'

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error,
      errorInfo,
    })

    if (__DEV__) {
      console.error('ErrorBoundary yakaladı:', error, errorInfo)
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <ScrollView 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <MaterialCommunityIcons 
              name="alert-circle-outline" 
              size={64} 
              color={colors.accent} 
              style={styles.icon}
            />
            
            <Text style={styles.title}>Bir sorun oluştu</Text>
            
            <Text style={styles.message}>
              Uygulama beklenmeyen bir hatayla karşılaştı. Lütfen uygulamayı yeniden başlatmayı deneyin.
            </Text>

            {__DEV__ && this.state.error && (
              <View style={styles.debugContainer}>
                <Text style={styles.debugTitle}>Hata Detayı (Geliştirici Modu):</Text>
                <Text style={styles.debugText}>{this.state.error.toString()}</Text>
                {this.state.errorInfo?.componentStack && (
                  <Text style={styles.debugText}>
                    {this.state.errorInfo.componentStack}
                  </Text>
                )}
              </View>
            )}

            <TouchableOpacity 
              style={styles.button} 
              onPress={this.handleReset}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons 
                name="restart" 
                size={20} 
                color="#FFFFFF" 
                style={styles.buttonIcon}
              />
              <Text style={styles.buttonText}>Yeniden Başlat</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )
    }

    return this.props.children
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
    padding: 24,
  },
  icon: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.accent,
    marginBottom: 16,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    minWidth: 200,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  debugContainer: {
    width: '100%',
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#333333',
  },
  debugTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.accent,
    marginBottom: 8,
  },
  debugText: {
    fontSize: 11,
    color: '#999999',
    fontFamily: 'monospace',
    lineHeight: 16,
  },
})
