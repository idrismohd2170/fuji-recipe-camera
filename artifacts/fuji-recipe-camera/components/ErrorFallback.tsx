import React, { useState } from 'react';
import { Modal, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { PressableScale } from '@/components/PressableScale';
import { fonts, type } from '@/constants/typography';
import { Feather } from '@expo/vector-icons';
import { reloadAppAsync } from 'expo';

export type ErrorFallbackProps = {
  error: Error;
  resetError: () => void;
};

export function ErrorFallback({ error, resetError }: ErrorFallbackProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [isModalVisible, setIsModalVisible] = useState(false);

  const handleRestart = async () => {
    try {
      await reloadAppAsync();
    } catch (restartError) {
      console.error('Failed to restart app:', restartError);
      resetError();
    }
  };

  const formatErrorDetails = (): string => {
    let details = `Error: ${error.message}\n\n`;
    if (error.stack) {
      details += `Stack Trace:\n${error.stack}`;
    }
    return details;
  };

  const monoFont = Platform.select({
    ios: 'Menlo',
    android: 'monospace',
    default: 'monospace',
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {__DEV__ ? (
        <PressableScale
          onPress={() => setIsModalVisible(true)}
          accessibilityLabel="View error details"
          style={[
            styles.topButton,
            { top: insets.top + 12, backgroundColor: colors.card },
          ]}
        >
          <Feather name="alert-circle" size={20} color={colors.foreground} />
        </PressableScale>
      ) : null}

      <View style={styles.content}>
        <Text style={[type.title1, styles.title, { color: colors.foreground }]}>
          Something went wrong
        </Text>

        <Text style={[type.callout, styles.message, { color: colors.mutedForeground }]}>
          Please reload the app to continue.
        </Text>

        <PressableScale
          onPress={handleRestart}
          accessibilityLabel="Try again"
          style={[styles.button, { backgroundColor: colors.primary }]}
        >
          <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>
            Try Again
          </Text>
        </PressableScale>
      </View>

      {__DEV__ ? (
        <Modal
          visible={isModalVisible}
          animationType="slide"
          transparent={true}
          statusBarTranslucent
          navigationBarTranslucent
          onRequestClose={() => setIsModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View
              style={[
                styles.modalContainer,
                { backgroundColor: colors.background },
              ]}
            >
              <View
                style={[
                  styles.modalHeader,
                  { borderBottomColor: colors.separator },
                ]}
              >
                <Text style={[type.title3, { color: colors.foreground }]}>
                  Error Details
                </Text>
                <PressableScale
                  onPress={() => setIsModalVisible(false)}
                  accessibilityLabel="Close error details"
                  style={styles.closeButton}
                >
                  <Feather name="x" size={24} color={colors.foreground} />
                </PressableScale>
              </View>

              <ScrollView
                style={styles.modalScrollView}
                contentContainerStyle={[
                  styles.modalScrollContent,
                  { paddingBottom: insets.bottom + 16 },
                ]}
                showsVerticalScrollIndicator
              >
                <View
                  style={[
                    styles.errorContainer,
                    { backgroundColor: colors.card },
                  ]}
                >
                  <Text
                    style={[
                      styles.errorText,
                      {
                        color: colors.foreground,
                        fontFamily: monoFont,
                      },
                    ]}
                    selectable
                  >
                    {formatErrorDetails()}
                  </Text>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    width: '100%',
    maxWidth: 600,
  },
  title: {
    textAlign: 'center',
  },
  message: {
    textAlign: 'center',
  },
  topButton: {
    position: 'absolute',
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  button: {
    height: 52,
    borderRadius: 26,
    paddingHorizontal: 24,
    minWidth: 200,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  buttonText: {
    fontFamily: fonts.semibold,
    textAlign: 'center',
    fontSize: 16,
    letterSpacing: -0.2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    width: '100%',
    height: '90%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingLeft: 20,
    paddingRight: 12,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  closeButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScrollView: {
    flex: 1,
  },
  modalScrollContent: {
    padding: 16,
  },
  errorContainer: {
    width: '100%',
    borderRadius: 20,
    overflow: 'hidden',
    padding: 16,
  },
  errorText: {
    fontSize: 12,
    lineHeight: 18,
    width: '100%',
  },
});
