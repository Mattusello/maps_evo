/**
 * MapCanvas (native): Leaflet + OSM dentro react-native-webview.
 * La variante web (MapCanvas.web.tsx) usa un <iframe> con lo stesso HTML.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

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
  const ref = useRef<WebView>(null);
  const ready = useRef(false);
  const html = useMemo(() => buildLeafletHtml(), []);
  const payload = useMemo(
    () => buildSetData(markers, routeColor, center),
    [markers, routeColor, center]
  );

  const send = useCallback(() => {
    ref.current?.injectJavaScript(`window.__setData(${JSON.stringify(payload)}); true;`);
  }, [payload]);

  useEffect(() => {
    if (ready.current) send();
  }, [send]);

  const onMessage = useCallback(
    (e: WebViewMessageEvent) => {
      const msg = parseMapMessage(e.nativeEvent.data);
      if (!msg) return;
      if (msg.type === 'ready') {
        ready.current = true;
        send();
      } else if (msg.type === 'mapPress') {
        onMapPress?.({ lat: msg.lat, lng: msg.lng });
      } else if (msg.type === 'markerPress') {
        onMarkerPress?.(msg.id);
      }
    },
    [send, onMapPress, onMarkerPress]
  );

  return (
    <View style={[styles.root, style]}>
      <WebView
        ref={ref}
        source={{ html }}
        originWhitelist={['*']}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        style={styles.web}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  web: { flex: 1, backgroundColor: 'transparent' },
});
