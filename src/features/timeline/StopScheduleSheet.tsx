/**
 * StopScheduleSheet — modifica di una fermata dalla timeline: orario di arrivo,
 * permanenza, costo a persona; più lo spostamento su/giù (alternativa accessibile
 * al trascinamento) e la rimozione.
 *
 * L'orario è **facoltativo**: senza orario la tappa scorre dietro la precedente, con
 * orario diventa un vincolo (prenotazione). Il testo lo spiega, invece di lasciarlo intuire.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react-native';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { z } from 'zod';

import type { Currency, Stop } from '@/core/models';
import type { StopPatch } from '@/core/repositories/contracts';
import type { ScheduleEntry } from '@/core/schedule/daySchedule';
import { formatClock, formatDuration, parseClock } from '@/core/utils/time';
import { categoryColor, categoryLabel } from '@/features/stops/category';
import { Badge, Button, Chip, Sheet, Text, TextField } from '@/ui/components';
import { spacing, useTheme } from '@/ui/theme';

/** Permanenze proposte come scorciatoia (minuti). */
const DURATION_CHOICES = [15, 30, 45, 60, 90, 120, 180];

/** Importo da stringa italiana ("12,50") a numero; null se non valido. */
function parseAmount(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (normalized === '') return null;
  const n = Number(normalized);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

// I messaggi sono chiavi i18n: la traduzione avviene al render.
const formSchema = z.object({
  arrival: z
    .string()
    .refine((v) => v.trim() === '' || parseClock(v) !== null, 'timeline.arrivalInvalid'),
  durationMin: z.number().int().positive(),
  cost: z
    .string()
    .refine((v) => v.trim() === '' || parseAmount(v) !== null, 'timeline.costInvalid'),
});
type FormValues = z.infer<typeof formSchema>;

type Props = {
  stop: Stop | null;
  /** Riga di timeline calcolata: serve a mostrare l'orario effettivo quando non è fissato. */
  entry: ScheduleEntry | null;
  currency: Currency;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onDismiss: () => void;
  onSave: (stopId: string, patch: StopPatch) => void;
  onMove: (stopId: string, direction: -1 | 1) => void;
  onRemove: (stopId: string) => void;
};

export function StopScheduleSheet({
  stop,
  entry,
  currency,
  canMoveUp,
  canMoveDown,
  onDismiss,
  onSave,
  onMove,
  onRemove,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const { control, handleSubmit, reset, setValue, watch, formState } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { arrival: '', durationMin: 60, cost: '' },
  });

  // All'apertura il form riparte dai valori della tappa selezionata.
  useEffect(() => {
    if (!stop) return;
    reset({
      arrival: stop.plannedArrival ?? '',
      durationMin: entry?.durationMin ?? stop.plannedDurationMin ?? 60,
      cost: stop.cost ? String(stop.cost.amount).replace('.', ',') : '',
    });
  }, [stop, entry, reset]);

  const submit = handleSubmit((values) => {
    if (!stop) return;
    const amount = parseAmount(values.cost);
    onSave(stop.id, {
      plannedArrival: values.arrival.trim() === '' ? undefined : values.arrival.trim(),
      plannedDurationMin: values.durationMin,
      cost: amount === null ? undefined : { amount, currency },
    });
  });

  const duration = watch('durationMin');
  const arrival = watch('arrival');

  // Ogni campo ha un solo vincolo, quindi la presenza dell'errore basta a scegliere il messaggio.
  const arrivalError = formState.errors.arrival ? t('timeline.arrivalInvalid') : undefined;
  const costError = formState.errors.cost ? t('timeline.costInvalid') : undefined;

  return (
    <Sheet open={stop !== null} onDismiss={onDismiss} snapPoints={['62%', '92%']}>
      {stop ? (
        <>
          <View style={styles.header}>
            <View style={[styles.dot, { backgroundColor: categoryColor(stop.category) }]} />
            <Text variant="overline" colorValue={categoryColor(stop.category)}>
              {categoryLabel(t, stop.category)}
            </Text>
          </View>
          <Text variant="title2" numberOfLines={2}>
            {stop.title}
          </Text>
          <Text variant="overline" color="textTertiary">
            {t('timeline.editTitle')}
          </Text>

          {/* Orario di arrivo */}
          <Controller
            control={control}
            name="arrival"
            render={({ field: { onChange, onBlur, value } }) => (
              <View style={styles.field}>
                <TextField
                  label={t('timeline.arrival')}
                  placeholder={t('timeline.arrivalPlaceholder')}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                  error={arrivalError}
                />
                <View style={styles.inlineRow}>
                  {arrival.trim() === '' ? (
                    <Text variant="footnote" color="textTertiary" style={styles.flex}>
                      {entry
                        ? `${t('timeline.arrivalFreeHint')} (${formatClock(entry.arrivalMin)})`
                        : t('timeline.arrivalFreeHint')}
                    </Text>
                  ) : (
                    <Button
                      label={t('timeline.arrivalFree')}
                      variant="ghost"
                      size="sm"
                      onPress={() => onChange('')}
                    />
                  )}
                </View>
                {entry?.conflict ? (
                  <Badge tone="danger" dot label={t('timeline.conflict')} />
                ) : null}
              </View>
            )}
          />

          {/* Permanenza */}
          <View style={styles.field}>
            <View style={styles.labelRow}>
              <Text variant="subhead" color="textSecondary">
                {t('timeline.duration')}
              </Text>
              <Text variant="subhead" tabular>
                {formatDuration(duration)}
              </Text>
            </View>
            <View style={styles.chips}>
              {DURATION_CHOICES.map((minutes) => (
                <Chip
                  key={minutes}
                  label={formatDuration(minutes)}
                  selected={duration === minutes}
                  onPress={() => setValue('durationMin', minutes, { shouldDirty: true })}
                />
              ))}
            </View>
            {entry?.durationIsDefault && !stop.plannedDurationMin ? (
              <Text variant="footnote" color="textTertiary">
                {t('timeline.durationEstimated')}
              </Text>
            ) : null}
          </View>

          {/* Costo a persona */}
          <Controller
            control={control}
            name="cost"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextField
                label={`${t('timeline.cost')} (${currency})`}
                placeholder={t('timeline.costPlaceholder')}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                keyboardType="decimal-pad"
                error={costError}
              />
            )}
          />

          <Button label={t('common.save')} fullWidth onPress={submit} />

          {/* Riordino accessibile: alternativa al trascinamento */}
          <View style={styles.moveRow}>
            <Button
              label={t('timeline.moveUp')}
              variant="outline"
              size="sm"
              disabled={!canMoveUp}
              leftIcon={<ArrowUp color={colors.primary} size={16} />}
              onPress={() => onMove(stop.id, -1)}
            />
            <Button
              label={t('timeline.moveDown')}
              variant="outline"
              size="sm"
              disabled={!canMoveDown}
              leftIcon={<ArrowDown color={colors.primary} size={16} />}
              onPress={() => onMove(stop.id, 1)}
            />
          </View>

          <Button
            label={t('stop.remove')}
            variant="ghost"
            leftIcon={<Trash2 color={colors.danger} size={16} />}
            onPress={() => onRemove(stop.id)}
          />
        </>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  field: { gap: spacing.sm },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  inlineRow: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  moveRow: { flexDirection: 'row', gap: spacing.sm },
});
