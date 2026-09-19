/* ===================================================
   TK WEBTALENT – EINSATZGEBIET FÜR VOR-ORT-TERMINE (geteilt)
   Kein eigener Endpoint (Underscore-Präfix), nur require()

   Persönliche Termine vor Ort gibt es nur im Umkreis von
   SERVICE_RADIUS_KM (Luftlinie) um Krauchenwies – also Landkreis
   Sigmaringen und Umgebung, bis etwa Ravensburg. Wer weiter weg
   wohnt, wird auf einen Zoom-Call umgelenkt.

   Die Adresse wird per OpenStreetMap-Nominatim geocodiert (kostenlos,
   kein API-Key; Nutzungsregeln: identifizierender User-Agent, max.
   1 Anfrage/Sekunde – bei dem Buchungsvolumen hier unkritisch).
   =================================================== */

const BASE = { name: 'Krauchenwies', lat: 48.0186, lon: 9.2509 };
const SERVICE_RADIUS_KM = 40;

const cache = new Map(); // adresse -> { lat, lon, at }
const CACHE_TTL_MS = 60 * 60 * 1000;

function distanceKm(lat1, lon1, lat2, lon2) {
  const rad = (x) => x * Math.PI / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

async function geocode(address) {
  const key = address.toLowerCase().replace(/\s+/g, ' ');
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=de&q=' + encodeURIComponent(address);
    const r = await fetch(url, {
      headers: { 'User-Agent': 'TK-Webtalent/1.0 (kontakt@tp-convertx.de)' },
      signal: ctrl.signal,
    });
    if (!r.ok) throw new Error('nominatim_' + r.status);
    const results = await r.json();
    if (!Array.isArray(results) || !results.length) return null;
    const entry = { lat: parseFloat(results[0].lat), lon: parseFloat(results[0].lon), at: Date.now() };
    if (!isFinite(entry.lat) || !isFinite(entry.lon)) return null;
    cache.set(key, entry);
    return entry;
  } finally {
    clearTimeout(timer);
  }
}

/* status: 'inside' | 'outside' | 'not_found' | 'unavailable' */
async function checkServiceArea(address) {
  const clean = String(address || '').trim();
  if (clean.length < 5 || clean.length > 200) return { ok: false, status: 'not_found' };

  let pos;
  try {
    pos = await geocode(clean);
  } catch (e) {
    console.error('[service-area] Geocoding fehlgeschlagen:', e.message);
    return { ok: false, status: 'unavailable' };
  }
  if (!pos) return { ok: false, status: 'not_found' };

  const km = distanceKm(BASE.lat, BASE.lon, pos.lat, pos.lon);
  return km <= SERVICE_RADIUS_KM
    ? { ok: true, status: 'inside', distanceKm: Math.round(km) }
    : { ok: false, status: 'outside', distanceKm: Math.round(km) };
}

/* Fehlercode für die Frontends (book-guest / check-address) */
function areaErrorCode(status) {
  return { outside: 'out_of_area', not_found: 'address_not_found', unavailable: 'address_check_unavailable' }[status];
}

module.exports = { SERVICE_RADIUS_KM, checkServiceArea, areaErrorCode };
