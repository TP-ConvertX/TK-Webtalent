/* ===================================================
   TK WEBTALENT – ADRESSPRÜFUNG FÜR VOR-ORT-TERMINE
   Antwortet, ob eine Adresse im Einsatzgebiet liegt (siehe
   _service-area.js). Wird vom Kundenbereich vor dem Buchen
   aufgerufen; die Gast-Buchung prüft direkt in api/book-guest.js.
   =================================================== */

const { SERVICE_RADIUS_KM, checkServiceArea, areaErrorCode } = require('./_service-area');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const { address } = req.body || {};
  const result = await checkServiceArea(address);

  return res.status(200).json({
    ok: result.ok,
    error: result.ok ? null : areaErrorCode(result.status),
    radiusKm: SERVICE_RADIUS_KM,
  });
};
