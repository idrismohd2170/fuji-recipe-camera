import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { PressableScale } from '@/components/PressableScale';
import { useColors } from '@/hooks/useColors';
import { fonts, type } from '@/constants/typography';

export default function NotFoundScreen() {
  const colors = useColors();
  const router = useRouter();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[type.title1, styles.title, { color: colors.foreground }]}>
        This screen doesn&apos;t exist.
      </Text>
      <PressableScale
        accessibilityLabel="Go to recipes"
        onPress={() => router.replace('/')}
        style={[styles.button, { backgroundColor: colors.primary }]}
      >
        <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>
          Back to recipes
        </Text>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 24,
  },
  title: { textAlign: 'center' },
  button: {
    height: 52,
    minWidth: 200,
    borderRadius: 26,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontFamily: fonts.semibold, fontSize: 16, letterSpacing: -0.2 },
});
