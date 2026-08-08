/**
 * PoiSearchBar: ricerca POI con autocomplete (debounce) tramite il PoiProvider.
 * Mostra i suggerimenti in un pannello sotto il campo; alla selezione chiama onSelect.
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { MapPin, Search, X } from 'lucide-react-native';

import type { Location } from '@/core/models';
import { getPoiProvider, PoiProviderError, type PoiSuggestion } from '@/core/providers';
import { Card, Text, TextField } from '@/ui/components';
import { useCategoryColor } from '@/features/stops/category';
import { elevation, spacing, useTheme } from '@/ui/theme';

export function PoiSearchBar({
  near,
  onSelect,
}: {
  near?: Location;
  onSelect: (s: PoiSuggestion) => void;
}) {
  const { t } = useTranslation();
  // Colore-linea della categoria nel tema attivo (leggibile in chiaro e in scuro).
  const categoryColor = useCategoryColor();
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PoiSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const provider = useRef(getPoiProvider()).current;

  // `near` orienta la ricerca ma non deve farla ripartire: cambia a ogni pan della mappa
  // e in dipendenza dell'effetto rilancerebbe una query per ogni spostamento.
  const nearRef = useRef(near);
  nearRef.current = near;

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      setFailed(false);
      return;
    }
    const controller = new AbortController();
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    const handle = setTimeout(async () => {
      try {
        const found = await provider.search(q, {
          near: nearRef.current,
          limit: 8,
          signal: controller.signal,
        });
        if (!cancelled) setResults(found);
      } catch (e) {
        // Query superata dalla successiva: l'abort non è un errore da mostrare.
        if (cancelled || (e as Error | undefined)?.name === 'AbortError') return;
        // Il fallimento della fonte è visibile, non silenzioso: prima si vedeva solo
        // "nessun risultato" anche quando il servizio rispondeva 400.
        console.warn('[PoiSearchBar] ricerca fallita', e instanceof PoiProviderError ? e.message : e);
        setResults([]);
        setFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(handle);
    };
  }, [query, provider]);

  const pick = (s: PoiSuggestion) => {
    onSelect(s);
    setQuery('');
    setResults([]);
  };

  return (
    <View style={styles.root}>
      <View style={[styles.field, { backgroundColor: colors.surface, borderColor: colors.border }, elevation.md]}>
        <Search color={colors.textTertiary} size={20} />
        <View style={styles.input}>
          <TextField
            placeholder={t('map.searchPlaceholder')}
            value={query}
            onChangeText={setQuery}
            style={styles.textfield}
          />
        </View>
        {loading ? <ActivityIndicator color={colors.primary} /> : null}
        {query.length > 0 && !loading ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel={t('common.cancel')}>
            <X color={colors.textTertiary} size={18} />
          </Pressable>
        ) : null}
      </View>

      {failed && !loading ? (
        <Card style={styles.results} raised>
          <Text variant="footnote" color="textTertiary">
            {t('map.searchFailed')}
          </Text>
        </Card>
      ) : null}

      {results.length > 0 ? (
        <Card padding="none" style={styles.results} raised>
          {/* Otto risultati coprivano tutta la mappa: la lista si ferma prima e scorre,
              così il luogo che si sta cercando resta visibile dietro. */}
          <ScrollView
            style={styles.resultsScroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {results.map((s) => (
              <Pressable
                key={s.placeId}
                onPress={() => pick(s)}
                style={({ pressed }) => [styles.result, pressed && { backgroundColor: colors.surfaceMuted }]}>
                <MapPin color={categoryColor(s.category)} size={18} />
                <View style={styles.resultText}>
                  <Text variant="subhead" numberOfLines={1}>
                    {s.name}
                  </Text>
                  {s.address ? (
                    <Text variant="footnote" color="textTertiary" numberOfLines={1}>
                      {s.address}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </Card>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  input: { flex: 1 },
  textfield: { borderWidth: 0, backgroundColor: 'transparent', minHeight: 44, paddingHorizontal: 0 },
  results: { overflow: 'hidden' },
  // ~4 risultati e mezzo: la lista si vede finita e resta chiaro che si può scorrere.
  resultsScroll: { maxHeight: 264 },
  result: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  resultText: { flex: 1 },
});
