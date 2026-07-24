import { Compass } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { EmptyState, Screen } from '@/ui/components';
import { useTheme } from '@/ui/theme';

export default function ExploreScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <Screen>
      <EmptyState
        icon={<Compass color={colors.primary} size={36} />}
        title={t('tabs.explore')}
        body={t('explore.comingSoon')}
      />
    </Screen>
  );
}
