/**
 * Account e sincronizzazione, dentro le Impostazioni.
 *
 * Tre stati, tre messaggi onesti:
 * - **backend non configurato** → i dati restano su questo dispositivo, e si dice come
 *   attivare la sincronizzazione;
 * - **configurato ma non connessi** → modulo di accesso o registrazione;
 * - **connessi** → chi sei, quando è andata l'ultima sincronizzazione, quante modifiche
 *   aspettano di partire, e i conflitti se ci sono stati.
 *
 * Il conteggio delle modifiche in attesa non è un dettaglio tecnico: è la risposta alla
 * domanda "se perdo il telefono adesso, cosa perdo?".
 */
import { CloudOff, LogOut, RefreshCw, TriangleAlert, UserRound } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/context/AuthContext';
import { useSync } from '@/context/SyncContext';
import { ApiError } from '@/core/api/apiClient';
import { formatDateTimeShort } from '@/core/utils/format';
import { Badge, Button, Text, TextField } from '@/ui/components';
import { radius, spacing, useTheme } from '@/ui/theme';

export function AccountSyncCard() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { user, remote, signedIn, signIn, signUp, signOut } = useAuth();
  const { enabled, syncing, lastSyncAt, pending, lastReport, syncNow } = useSync();

  if (!remote || !enabled) return <BackendNotConfigured />;
  if (!signedIn) return <SignInForm onSignIn={signIn} onSignUp={signUp} />;

  const lastSync = lastSyncAt ? formatDateTimeShort(lastSyncAt) : null;

  return (
    <View style={styles.root}>
      <View style={styles.identity}>
        <View style={[styles.avatar, { backgroundColor: colors.primaryContainer }]}>
          <UserRound color={colors.onPrimaryContainer} size={18} />
        </View>
        <View style={styles.identityText}>
          <Text variant="subhead" numberOfLines={1}>
            {user?.displayName ?? t('sync.account')}
          </Text>
          {user?.email ? (
            <Text variant="footnote" color="textSecondary" numberOfLines={1}>
              {user.email}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.status}>
        <Text variant="footnote" color="textSecondary">
          {lastSync ? t('sync.lastSync', { when: lastSync }) : t('sync.never')}
        </Text>
        {pending > 0 ? (
          <Badge tone="warning" dot label={t('sync.pending', { count: pending })} />
        ) : (
          <Badge tone="success" dot label={t('sync.upToDate')} />
        )}
      </View>

      {lastReport?.error ? (
        <Notice tone="warning" text={t('sync.error')} />
      ) : lastReport && lastReport.conflicts > 0 ? (
        <Notice tone="warning" text={t('sync.conflicts', { count: lastReport.conflicts })} />
      ) : null}

      <Button
        label={t('sync.syncNow')}
        variant="tonal"
        fullWidth
        loading={syncing}
        leftIcon={<RefreshCw color={colors.onPrimaryContainer} size={18} />}
        onPress={() => void syncNow()}
      />
      <Button
        label={t('sync.signOut')}
        variant="ghost"
        fullWidth
        leftIcon={<LogOut color={colors.primary} size={18} />}
        onPress={() => void signOut()}
      />
    </View>
  );
}

function BackendNotConfigured() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { pending } = useSync();

  return (
    <View style={styles.root}>
      <View style={styles.identity}>
        <View style={[styles.avatar, { backgroundColor: colors.surfaceMuted }]}>
          <CloudOff color={colors.textSecondary} size={18} />
        </View>
        <View style={styles.identityText}>
          <Text variant="subhead">{t('sync.localOnly.title')}</Text>
          <Text variant="footnote" color="textSecondary">
            {t('sync.localOnly.body')}
          </Text>
        </View>
      </View>
      {pending > 0 ? (
        <Text variant="footnote" color="textTertiary">
          {t('sync.localOnly.queued', { count: pending })}
        </Text>
      ) : null}
      <Text variant="footnote" color="textTertiary">
        {t('sync.localOnly.howTo')}
      </Text>
    </View>
  );
}

type Mode = 'signIn' | 'signUp';

function SignInForm({
  onSignIn,
  onSignUp,
}: {
  onSignIn: (input: { email: string; password: string }) => Promise<void>;
  onSignUp: (input: { displayName: string; email: string; password: string }) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>('signIn');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    email.trim().length > 0 &&
    password.length > 0 &&
    (mode === 'signIn' || displayName.trim().length > 0);

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === 'signIn') {
        await onSignIn({ email: email.trim(), password });
      } else {
        await onSignUp({ displayName: displayName.trim(), email: email.trim(), password });
      }
      setPassword('');
    } catch (e) {
      // Il messaggio del server è più utile del nostro: 401 e 422 spiegano già cosa manca.
      setError(
        e instanceof ApiError && !e.isNetwork && e.message ? e.message : t('sync.signInFailed')
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <Text variant="subhead">
        {mode === 'signIn' ? t('sync.signInTitle') : t('sync.signUpTitle')}
      </Text>

      {mode === 'signUp' ? (
        <TextField
          label={t('sync.name')}
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="words"
          textContentType="name"
        />
      ) : null}

      <TextField
        label={t('sync.email')}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <TextField
        label={t('sync.password')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        textContentType={mode === 'signIn' ? 'password' : 'newPassword'}
        onSubmitEditing={() => void submit()}
        returnKeyType="go"
      />

      {error ? <Notice tone="danger" text={error} /> : null}

      <Button
        label={mode === 'signIn' ? t('sync.signIn') : t('sync.signUp')}
        fullWidth
        loading={busy}
        disabled={!canSubmit}
        onPress={() => void submit()}
      />
      <Button
        label={mode === 'signIn' ? t('sync.switchToSignUp') : t('sync.switchToSignIn')}
        variant="ghost"
        fullWidth
        disabled={busy}
        onPress={() => {
          setMode(mode === 'signIn' ? 'signUp' : 'signIn');
          setError(null);
        }}
      />
    </View>
  );
}

function Notice({ tone, text }: { tone: 'warning' | 'danger'; text: string }) {
  const { colors } = useTheme();
  const background = tone === 'danger' ? colors.dangerContainer : colors.warningContainer;
  const foreground = tone === 'danger' ? colors.danger : colors.warning;
  return (
    <View style={[styles.notice, { backgroundColor: background }]}>
      <TriangleAlert color={foreground} size={16} />
      <Text variant="footnote" colorValue={foreground} style={styles.noticeText}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  identityText: { flex: 1, gap: 2 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  status: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  noticeText: { flex: 1 },
});
