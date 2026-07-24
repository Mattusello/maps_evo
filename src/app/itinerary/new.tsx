import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { Minus, Plus, X } from 'lucide-react-native';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useItineraries } from '@/context/ItinerariesContext';
import {
  createItineraryInputSchema,
  type CreateItineraryInput,
  type Currency,
} from '@/core/models';
import { Button, Chip, Screen, Text, TextField } from '@/ui/components';
import { spacing, useTheme } from '@/ui/theme';

const CURRENCIES: Currency[] = ['EUR', 'USD', 'GBP', 'CHF'];

export default function NewItineraryScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const { createItinerary } = useItineraries();

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateItineraryInput>({
    resolver: zodResolver(createItineraryInputSchema),
    defaultValues: { title: '', description: '', currency: 'EUR', partySize: 1 },
  });

  const onSubmit = async (values: CreateItineraryInput) => {
    const created = await createItinerary(values);
    router.replace(`/itinerary/${created.id}`);
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="title2">{t('itineraries.new.title')}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.cancel')} onPress={() => router.back()} hitSlop={10}>
          <X color={colors.textSecondary} size={24} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Controller
          control={control}
          name="title"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextField
              label={t('itineraries.new.nameLabel')}
              placeholder={t('itineraries.new.namePlaceholder')}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              autoFocus
              error={errors.title?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="description"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextField
              placeholder={t('itineraries.new.descriptionPlaceholder')}
              value={value ?? ''}
              onChangeText={onChange}
              onBlur={onBlur}
              multiline
              numberOfLines={3}
              style={styles.multiline}
            />
          )}
        />

        <Controller
          control={control}
          name="currency"
          render={({ field: { onChange, value } }) => (
            <View style={styles.field}>
              <Text variant="subhead" color="textSecondary">
                {t('budget.currency')}
              </Text>
              <View style={styles.chips}>
                {CURRENCIES.map((c) => (
                  <Chip key={c} label={c} selected={value === c} onPress={() => onChange(c)} />
                ))}
              </View>
            </View>
          )}
        />

        <Controller
          control={control}
          name="partySize"
          render={({ field: { onChange, value } }) => (
            <View style={styles.field}>
              <Text variant="subhead" color="textSecondary">
                {t('budget.split')}
              </Text>
              <View style={styles.stepper}>
                <Button
                  label=""
                  variant="outline"
                  size="sm"
                  leftIcon={<Minus color={colors.primary} size={18} />}
                  onPress={() => onChange(Math.max(1, value - 1))}
                  accessibilityLabel="-"
                />
                <Text variant="title3" tabular style={styles.count}>
                  {t('budget.people', { count: value })}
                </Text>
                <Button
                  label=""
                  variant="outline"
                  size="sm"
                  leftIcon={<Plus color={colors.primary} size={18} />}
                  onPress={() => onChange(value + 1)}
                  accessibilityLabel="+"
                />
              </View>
            </View>
          )}
        />
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label={t('itineraries.new.create')}
          fullWidth
          loading={isSubmitting}
          onPress={handleSubmit(onSubmit)}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  content: { paddingHorizontal: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl },
  field: { gap: spacing.sm },
  chips: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  count: { minWidth: 120, textAlign: 'center' },
  footer: { padding: spacing.lg },
});
