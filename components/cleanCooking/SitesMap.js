'use client';

/**
 * Leaflet map of clean cooking sites. Loaded only in the browser (see the
 * dynamic import in CleanCookingDashboard) because Leaflet needs `window`.
 *
 * mode="points"  — where the sites are in Uganda.
 * mode="radius"  — each site with its access radius, zoomed to a settlement.
 */
import { useEffect, useMemo } from 'react';
import { Circle, CircleMarker, LayersControl, MapContainer, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import styles from './CleanCooking.module.css';

const SECONDARY = '#14B8A6';
const PRIMARY = '#054653';

// Uganda, so the first map always reads as "where in the country".
const UGANDA_BOUNDS = [[-1.55, 29.5], [4.25, 35.05]];

const KM_PER_DEG_LAT = 111.32;

/** Bounds around a set of sites, padded by `padKm` on every side. */
function boundsAround(sites, padKm) {
  const lats = sites.map((s) => s.lat);
  const lngs = sites.map((s) => s.lng);
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const dLat = padKm / KM_PER_DEG_LAT;
  const dLng = padKm / (KM_PER_DEG_LAT * Math.cos((midLat * Math.PI) / 180));
  return [[Math.min(...lats) - dLat, Math.min(...lngs) - dLng], [Math.max(...lats) + dLat, Math.max(...lngs) + dLng]];
}

function FitTo({ bounds }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(bounds, { padding: [16, 16] });
  }, [map, bounds]);
  return null;
}

const engagementText = (site) => (site.engagements?.length ? site.engagements.join(' · ') : 'Engagements not reported yet');

/** Label shown on hover (points map) and always (radius map). */
function SiteLabel({ site }) {
  return (
    <div style={{ lineHeight: 1.3 }}>
      <div style={{ fontWeight: 700 }}>{site.name}</div>
      <div style={{ fontSize: 11, color: site.engagements?.length ? '#0F5132' : '#667982' }}>{engagementText(site)}</div>
    </div>
  );
}

function SiteDetails({ site, radiusKm }) {
  return (
    <div style={{ minWidth: 190 }}>
      <div style={{ fontWeight: 700, color: PRIMARY }}>{site.name}</div>
      <div>{site.settlement} · {site.district} district</div>
      <div style={{ marginTop: 4 }}><strong>Community engagements:</strong> {engagementText(site)}</div>
      {site.note && <div style={{ marginTop: 4 }}>{site.note}</div>}
      <div style={{ marginTop: 4, color: '#667982', fontSize: 12 }}>
        {site.lat.toFixed(5)}, {site.lng.toFixed(5)} · {site.plusCode}
        {radiusKm ? <><br />Circle: {radiusKm} km access area</> : null}
      </div>
    </div>
  );
}

function BaseLayers() {
  return (
    <LayersControl position="topright">
      <LayersControl.BaseLayer checked name="Satellite">
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution="Imagery &copy; Esri, Maxar, Earthstar Geographics"
          maxZoom={19}
        />
      </LayersControl.BaseLayer>
      <LayersControl.BaseLayer name="Street map">
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
          maxZoom={19}
        />
      </LayersControl.BaseLayer>
      <LayersControl.Overlay checked name="Place names & borders">
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
          attribution="Labels &copy; Esri"
          maxZoom={19}
        />
      </LayersControl.Overlay>
    </LayersControl>
  );
}

export default function SitesMap({ sites, mode = 'points', radiusKm = 2, focus = null }) {
  const bounds = useMemo(() => {
    if (mode === 'points') return UGANDA_BOUNDS;
    const shown = focus ? sites.filter((s) => focus.includes(s.id)) : sites;
    return boundsAround(shown.length ? shown : sites, radiusKm + 0.5);
  }, [mode, sites, focus, radiusKm]);

  return (
    <div className={styles.mapBox}>
      <MapContainer bounds={bounds} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
        <BaseLayers />
        <FitTo bounds={bounds} />
        {mode === 'radius' && sites.map((s) => (
          <Circle
            key={`${s.id}-area`}
            center={[s.lat, s.lng]}
            radius={radiusKm * 1000}
            pathOptions={{ color: SECONDARY, weight: 2, fillColor: SECONDARY, fillOpacity: 0.18 }}
          />
        ))}
        {sites.map((s) => (
          <CircleMarker
            key={s.id}
            center={[s.lat, s.lng]}
            radius={mode === 'points' ? 7 : 6}
            pathOptions={{ color: '#fff', weight: 2, fillColor: mode === 'points' ? SECONDARY : PRIMARY, fillOpacity: 1 }}
          >
            <Tooltip direction="top" offset={[0, -6]} permanent={mode === 'radius'}><SiteLabel site={s} /></Tooltip>
            <Popup><SiteDetails site={s} radiusKm={mode === 'radius' ? radiusKm : null} /></Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
