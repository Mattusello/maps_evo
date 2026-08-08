import { Tabs } from 'expo-router';
import { Compass, Route, Settings as SettingsIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { spacing, typography, useTheme } from '@/ui/theme';

/**
 * Altezza della barra al netto della safe area. L'altezza di default del navigator (49)
 * non basta a icona + etichetta: le discendenti di "Esplora"/"Impostazioni" finivano
 * tagliate sotto il bordo. Qui la barra è alta quanto il suo contenuto e la safe area
 * si somma invece di mangiarsela.
 */
const BAR_CONTENT_HEIGHT = 58;

export default function TabsLayout() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: BAR_CONTENT_HEIGHT + insets.bottom,
          paddingTop: spacing.xs,
          paddingBottom: insets.bottom + spacing.xs,
        },
        // Le etichette le disegna il navigator, quindi non passano da <Text variant>:
        // le misure arrivano comunque dai token, per non far divergere le due strade.
        tabBarLabelStyle: {
          fontSize: typography.overline.fontSize,
          lineHeight: typography.overline.lineHeight,
          fontWeight: '600',
          fontFamily: typography.caption.fontFamily,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.itineraries'),
          tabBarIcon: ({ color, size }) => <Route color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: t('tabs.explore'),
          tabBarIcon: ({ color, size }) => <Compass color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings'),
          tabBarIcon: ({ color, size }) => <SettingsIcon color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
