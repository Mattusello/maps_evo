import { useRouter } from 'expo-router';
import { Map } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { EmptyState, Screen } from '@/ui/components';
import { useTheme } from '@/ui/theme';

export default function ItineraryMapScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <Screen>
      <EmptyState
        icon={<Map color={colors.primary} size={36} />}
        title={t('common.comingSoon')}
        body={t('phase.map')}
        actionLabel={t('common.back')}
        onAction={() => router.back()}
      />
    </Screen>
  );
}
