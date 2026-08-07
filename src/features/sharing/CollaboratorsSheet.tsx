/**
 * CollaboratorsSheet — chi viaggia con te su questo itinerario.
 *
 * Vive a **livello di modello** (`Itinerary.collaborators`): la lista è salvata con
 * l'itinerario e viaggia con il codice di condivisione solo come copia. Finché non c'è il
 * backend (Fase 5) non manda inviti a nessuno, e il foglio lo dichiara invece di far credere
 * il contrario: serve a dividere i costi e a ricordarsi chi fa cosa.
 */
import { Trash2, UserPlus } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Collaborator, CollaboratorRole } from '@/core/models';
import { newId } from '@/core/utils/id';
import { Badge, Button, Chip, Sheet, Text, TextField } from '@/ui/components';
import { minTapTarget, radius, spacing, useTheme } from '@/ui/theme';

/** Ruoli assegnabili a mano: `owner` esiste solo per chi ha creato l'itinerario. */
const ASSIGNABLE_ROLES: CollaboratorRole[] = ['editor', 'viewer'];

export type CollaboratorsSheetProps = {
  open: boolean;
  onDismiss: () => void;
  collaborators: Collaborator[];
  /** Id dell'utente corrente, per marcare la propria riga. */
  currentUserId: string;
  onChange: (next: Collaborator[]) => Promise<void>;
};

export function CollaboratorsSheet({
  open,
  onDismiss,
  collaborators,
  currentUserId,
  onChange,
}: CollaboratorsSheetProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [name, setName] = useState('');
  const [role, setRole] = useState<CollaboratorRole>('editor');
  const [saving, setSaving] = useState(false);

  const trimmed = name.trim();

  const add = async () => {
    if (!trimmed) return;
    setSaving(true);
    try {
      // Id locale: quando ci sarà l'account, l'invito lo sostituirà con l'utente reale.
      await onChange([...collaborators, { userId: newId(), displayName: trimmed, role }]);
      setName('');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (userId: string) => {
    setSaving(true);
    try {
      await onChange(collaborators.filter((c) => c.userId !== userId));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onDismiss={onDismiss} snapPoints={['70%']}>
      <View style={styles.head}>
        <Text variant="overline" color="textTertiary">
          {t('sharing.collaborators')}
        </Text>
        <Text variant="title2">{t('sharing.collaboratorsTitle')}</Text>
      </View>

      <View style={styles.list}>
        {collaborators.map((c) => {
          const isOwner = c.role === 'owner';
          const label = c.displayName ?? (c.userId === currentUserId ? t('sharing.you') : t('sharing.guest'));
          return (
            <View key={c.userId} style={[styles.row, { borderColor: colors.border }]}>
              <View style={[styles.avatar, { backgroundColor: colors.primaryContainer }]}>
                <Text variant="caption" color="onPrimaryContainer">
                  {label.slice(0, 1).toUpperCase()}
                </Text>
              </View>
              <View style={styles.rowText}>
                <Text variant="subhead" numberOfLines={1}>
                  {label}
                  {c.userId === currentUserId ? ` · ${t('sharing.you')}` : ''}
                </Text>
              </View>
              <Badge tone={isOwner ? 'primary' : 'neutral'} label={t(`sharing.roles.${c.role}`)} />
              {isOwner ? null : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('sharing.removeCollaborator', { name: label })}
                  onPress={() => void remove(c.userId)}
                  disabled={saving}
                  hitSlop={8}
                  style={styles.remove}>
                  <Trash2 color={colors.textTertiary} size={18} />
                </Pressable>
              )}
            </View>
          );
        })}
      </View>

      <View style={styles.form}>
        <TextField
          label={t('sharing.addCollaborator')}
          placeholder={t('sharing.namePlaceholder')}
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          onSubmitEditing={() => void add()}
          returnKeyType="done"
        />
        <View style={styles.roles}>
          {ASSIGNABLE_ROLES.map((r) => (
            <Chip
              key={r}
              label={t(`sharing.roles.${r}`)}
              selected={role === r}
              onPress={() => setRole(r)}
            />
          ))}
        </View>
        <Button
          label={t('common.add')}
          variant="tonal"
          fullWidth
          disabled={!trimmed || saving}
          leftIcon={<UserPlus color={colors.onPrimaryContainer} size={18} />}
          onPress={() => void add()}
        />
      </View>

      <Text variant="footnote" color="textTertiary">
        {t('sharing.collaboratorsNote')}
      </Text>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  head: { gap: spacing.xs },
  list: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1 },
  remove: {
    width: minTapTarget - 12,
    height: minTapTarget - 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  form: { gap: spacing.sm },
  roles: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
});
