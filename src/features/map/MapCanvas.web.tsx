/**
 * MapCanvas (web): stesso HTML Leaflet dentro un <iframe>, così l'anteprima web mostra
 * la mappa reale senza dipendere da react-native-webview.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
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

  // L'iframe è pronto molto dopo il primo render: quando arriva 'ready' i dati sono già
  // cambiati. Il payload vive quindi in un ref, così `send` manda SEMPRE l'ultimo stato
  // (con il payload in closure la mappa restava senza marker: il listener era montato una
  // volta sola e conservava il payload vuoto del primo render).
  const payloadRef = useRef(payload);
  payloadRef.current = payload;

  const send = useCallback(() => {
    ref.current?.contentWindow?.postMessage(JSON.stringify(payloadRef.current), '*');
  }, []);

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
  }, [onMapPress, onMarkerPress, send]);

  useEffect(() => {
    if (ready.current) send();
  }, [payload, send]);

  return (
    <View style={[styles.root, style]}>
      <iframe ref={ref} srcDoc={html} style={{ border: 0, width: '100%', height: '100%' }} title="map" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
});
