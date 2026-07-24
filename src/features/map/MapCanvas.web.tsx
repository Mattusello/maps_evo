/**
 * MapCanvas (web): stesso HTML Leaflet dentro un <iframe>, così l'anteprima web mostra
 * la mappa reale senza dipendere da react-native-webview.
 */
import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import type { MapCanvasProps } from './MapCanvas.types';
import { buildLeafletHtml } from './leafletHtml';
import { buildSetData, parseMapMessage } from './mapPayload';

export function MapCanvas({
  markers,
  routeColor,
  center,
  onMapPress,
  onMarkerPress,
  style,
}: MapCanvasProps) {
  const ref = useRef<HTMLIFrameElement>(null);
  const ready = useRef(false);
  const html = useMemo(() => buildLeafletHtml(), []);
  const payload = useMemo(
    () => buildSetData(markers, routeColor, center),
    [markers, routeColor, center]
  );

  const send = () => ref.current?.contentWindow?.postMessage(JSON.stringify(payload), '*');

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const msg = parseMapMessage(e.data);
      if (!msg) return;
      if (msg.type === 'ready') {
        ready.current = true;
        send();
      } else if (msg.type === 'mapPress') {
        onMapPress?.({ lat: msg.lat, lng: msg.lng });
      } else if (msg.type === 'markerPress') {
        onMarkerPress?.(msg.id);
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onMapPress, onMarkerPress]);

  useEffect(() => {
    if (ready.current) send();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload]);

  return (
    <View style={[styles.root, style]}>
      <iframe ref={ref} srcDoc={html} style={{ border: 0, width: '100%', height: '100%' }} title="map" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
});
