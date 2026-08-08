import type { StyleProp, ViewStyle } from 'react-native';

/** Marker da disegnare sulla mappa. */
export type MapMarker = {
  id: string;
  lat: number;
  lng: number;
  /** Colore-linea della categoria. */
  color: string;
  /** Etichetta (titolo tappa). */
  label: string;
  /** Numero d'ordine mostrato nel marker (fermata 1, 2, …). 0 = punto singolo/ricerca. */
  index: number;
};

export type MapCanvasProps = {
  markers: MapMarker[];
  /** Colore della linea-percorso che collega i marker in ordine. */
  routeColor: string;
  /** Centro iniziale se non ci sono marker. */
  center?: { lat: number; lng: number };
  /** Chiamata al tap su un punto vuoto della mappa (per aggiungere una tappa). */
  onMapPress?: (loc: { lat: number; lng: number }) => void;
  /** Chiamata al tap su un marker. */
  onMarkerPress?: (id: string) => void;
  /**
   * Centro corrente della mappa a fine spostamento: serve a orientare la ricerca POI
   * sull'area che l'utente sta guardando. NON va reinviato come `center`, o la mappa
   * si riposizionerebbe da sola a ogni pan.
   */
  onCenterChange?: (loc: { lat: number; lng: number }) => void;
  style?: StyleProp<ViewStyle>;
};

/** Messaggi WebView/iframe → app. */
export type MapOutMessage =
  | { type: 'ready' }
  | { type: 'mapPress'; lat: number; lng: number }
  | { type: 'markerPress'; id: string }
  | { type: 'centerChange'; lat: number; lng: number };
