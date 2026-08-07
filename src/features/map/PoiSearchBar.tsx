/**
 * PoiSearchBar: ricerca POI con autocomplete (debounce) tramite il PoiProvider.
 * Mostra i suggerimenti in un pannello sotto il campo; alla selezione chiama onSelect.
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { MapPin, Search, X } from 'lucide-react-native';

import type { Location } from '@/core/models';
import { getPoiProvider, type PoiSuggestion } from '@/core/providers';
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
  const provider = useRef(getPoiProvider()).current;

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        setResults(await provider.search(q, { near, limit: 8, signal: controller.signal }));
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      controller.abort();
      clearTimeout(handle);
    };
  }, [query, near, provider]);

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

      {results.length > 0 ? (
        <Card padding="none" style={styles.results} raised>
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
  result: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  resultText: { flex: 1 },
});
