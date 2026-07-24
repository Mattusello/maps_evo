/**
 * Mappa i tag OpenStreetMap (osm_key/osm_value di Photon) alle nostre categorie di tappa.
 * Serve a scegliere il colore-linea del marker e l'icona.
 */
import type { StopCategory } from '../../models';

export function mapOsmToCategory(osmKey?: string, osmValue?: string): StopCategory {
  const key = osmKey ?? '';
  const value = osmValue ?? '';

  if (key === 'tourism') {
    if (value === 'hotel' || value === 'hostel' || value === 'guest_house' || value === 'motel')
      return 'alloggio';
    if (value === 'museum' || value === 'gallery' || value === 'artwork') return 'cultura';
    if (value === 'viewpoint') return 'panorama';
    return 'cultura';
  }
  if (key === 'historic') return 'cultura';
  if (key === 'amenity') {
    if (value === 'restaurant' || value === 'cafe' || value === 'fast_food' || value === 'food_court')
      return 'cibo';
    if (value === 'bar' || value === 'pub' || value === 'nightclub' || value === 'biergarten')
      return 'notte';
    if (
      value === 'bus_station' ||
      value === 'ferry_terminal' ||
      value === 'taxi' ||
      value === 'car_rental'
    )
      return 'trasporto';
    return 'altro';
  }
  if (key === 'shop') return 'shopping';
  if (key === 'leisure') return 'natura';
  if (key === 'natural') return 'natura';
  if (key === 'railway' || key === 'aeroway' || key === 'public_transport') return 'trasporto';

  return 'altro';
}
