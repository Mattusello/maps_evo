import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useSettings } from '@/context/SettingsContext';
import { Card, Chip, Screen, Text } from '@/ui/components';
import { spacing, type ThemePreference } from '@/ui/theme';

const THEME_OPTIONS: ThemePreference[] = ['system', 'light', 'dark'];

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { themePreference, setThemePreference } = useSettings();

  return (
    <Screen edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="display">{t('settings.title')}</Text>

        <Section title={t('settings.appearance')}>
          <View style={styles.chips}>
            {THEME_OPTIONS.map((opt) => (
              <Chip
                key={opt}
                label={t(`settings.theme.${opt}`)}
                selected={themePreference === opt}
                onPress={() => setThemePreference(opt)}
              />
            ))}
          </View>
        </Section>

        <Section title={t('settings.language')}>
          <Text variant="body" color="textSecondary">
            Italiano
          </Text>
        </Section>

        <Section title={t('settings.about')}>
          <Text variant="body">{t('common.appName')}</Text>
          <Text variant="footnote" color="textTertiary">
            v{Constants.expoConfig?.version ?? '1.0.0'}
          </Text>
        </Section>
      </ScrollView>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="overline" color="textTertiary">
        {title}
      </Text>
      <Card padding="lg">
        <View style={{ gap: spacing.sm }}>{children}</View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing['4xl'] },
  section: { gap: spacing.sm },
  chips: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
});
