import { Tabs } from 'expo-router';
import { Compass, Route, Settings as SettingsIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { typography, useTheme } from '@/ui/theme';

export default function TabsLayout() {
  const { colors } = useTheme();
  const { t } = useTranslation();

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
        },
        // Le etichette le disegna il navigator, quindi non passano da <Text variant>:
        // le misure arrivano comunque dai token, per non far divergere le due strade.
        tabBarLabelStyle: {
          fontSize: typography.overline.fontSize,
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
