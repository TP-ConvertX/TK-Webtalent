/* ===================================================
   TK WEBTALENT – TERMINKALENDER
   Mo–Fr 17–20 Uhr · Sa–So 12–18 Uhr · buchbar zur vollen
   UND zur halben Stunde (60-Min-Slots je Startzeit)
   =================================================== */

const SLOT_HOURS = {
  0: [12,13,14,15,16,17], // Sonntag
  1: [17,18,19],           // Montag
  2: [17,18,19],           // Dienstag
  3: [17,18,19],           // Mittwoch
  4: [17,18,19],           // Donnerstag
  5: [17,18,19],           // Freitag
  6: [12,13,14,15,16,17]  // Samstag
};

/* Aus den Geschäftsstunden (SLOT_HOURS) werden je Stunde ZWEI
   Startzeiten erzeugt: volle und halbe Stunde (z.B. 17 → "17:00" UND
   "17:30"). So bleibt SLOT_HOURS weiterhin die einfache, gut lesbare
   Quelle für die Geschäftszeiten, ohne dass man dort jede Halbe-
   Stunde-Marke einzeln auflisten muss. */
function calSlotsForHour(h) {
  const hh = String(h).padStart(2, '0');
  return [hh + ':00', hh + ':30'];
}

const CAL_DAYS   = ['So','Mo','Di','Mi','Do','Fr','Sa'];
const CAL_MONTHS = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];

const CAL_TYPE_LABELS = {
  telefon:     '📞 Telefonisch',
  persoenlich: '🤝 Persönlich',
  zoom:        '💻 Zoom',
};
function calTypeLabel(t) { return CAL_TYPE_LABELS[t] || CAL_TYPE_LABELS.telefon; }

let _calWeekOff      = 0;
let _calRefreshFn    = null;

function calMonday(off) {
  const d = new Date();
  const dow = d.getDay();
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow) + off * 7);
  d.setHours(0, 0, 0, 0);
  return d;
}

function calAdd(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function calISO(d)    { return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }
function calFmt(d)    { return d.getDate() + '. ' + CAL_MONTHS[d.getMonth()]; }

function calNav(dir) {
  _calWeekOff += dir;
  if (_calRefreshFn) _calRefreshFn(_calWeekOff);
}

function calRender(containerId, { appointments, myId, isAdmin, weekOff }) {
  const el = document.getElementById(containerId);
  if (!el) return;

  const mon   = calMonday(weekOff);
  const sun   = calAdd(mon, 6);
  const days  = Array.from({length: 7}, (_, i) => calAdd(mon, i));
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();

  const allSlots = [...new Set(Object.values(SLOT_HOURS).flat().flatMap(calSlotsForHour))].sort();

  // Buchungs-Lookup: "YYYY-MM-DD HH:00" → appointment
  const bk = {};
  (appointments || []).forEach(a => {
    bk[a.appointment_date + ' ' + a.appointment_time.slice(0, 5)] = a;
  });

  let h = `
    <div class="cal-nav">
      <button class="cal-btn-nav" onclick="calNav(-1)">‹ <span class="cal-nav-label">Vorherige</span></button>
      <span class="cal-nav-title">${calFmt(mon)} – ${calFmt(sun)} ${sun.getFullYear()}</span>
      <button class="cal-btn-nav" onclick="calNav(1)"><span class="cal-nav-label">Nächste</span> ›</button>
    </div>
    <div class="cal-scroll">
      <div class="cal-grid">
        <div class="cal-th-time"></div>`;

  // Spalten-Header (Wochentage)
  days.forEach(d => {
    const isToday = calISO(d) === calISO(today);
    h += `<div class="cal-th${isToday ? ' is-today' : ''}">
      <div class="cal-dname">${CAL_DAYS[d.getDay()]}</div>
      <div class="cal-dnum">${d.getDate()}</div>
    </div>`;
  });

  // Zeilen (halbe Stunden)
  allSlots.forEach(ts => {
    const hr = parseInt(ts.slice(0, 2), 10);
    const min = parseInt(ts.slice(3, 5), 10);
    h += `<div class="cal-time">${ts}</div>`;
    days.forEach(d => {
      const dow  = d.getDay();
      const ds   = calISO(d);
      const key  = ds + ' ' + ts;
      /* Dienstags nur im Admin-Bereich buchbar (Minijob) */
      const tuesdayBlocked = dow === 2 && !isAdmin;
      const has  = !tuesdayBlocked && (SLOT_HOURS[dow] || []).includes(hr);
      const past = d < today || (ds === calISO(today) && (hr * 60 + min) <= nowMinutes);
      const ap   = bk[key];

      if (!has) {
        h += `<div class="cal-cell cal-na"></div>`;
      } else if (past) {
        h += `<div class="cal-cell cal-past">—</div>`;
      } else if (ap) {
        const mine = ap.customer_id === myId;
        if (mine) {
          h += `<div class="cal-cell cal-mine">
            <div class="cal-mine-label">✓ Gebucht</div>
            <button class="cal-x-btn" onclick="calOnCancel('${ap.id}')">Absagen</button>
          </div>`;
        } else if (isAdmin) {
          const name = ap.profiles?.full_name || ap.guest_name || 'Kunde';
          h += `<div class="cal-cell cal-admin-bk">
            <div class="cal-cust-name">${calEsc(name)}</div>
            <div class="cal-appt-type">${calTypeLabel(ap.appointment_type)}</div>
            <button class="cal-x-btn" onclick="calOnCancel('${ap.id}')">Stornieren</button>
          </div>`;
        } else {
          h += `<div class="cal-cell cal-taken">Belegt</div>`;
        }
      } else {
        h += `<div class="cal-cell cal-free" onclick="calOnBook('${ds}','${ts}')">Buchen</div>`;
      }
    });
  });

  h += `</div></div>
    <div class="cal-legend">
      <span class="cal-leg-item"><span class="cal-leg-dot cal-leg-free"></span>Verfügbar</span>
      <span class="cal-leg-item"><span class="cal-leg-dot cal-leg-mine"></span>Mein Termin</span>
      <span class="cal-leg-item"><span class="cal-leg-dot cal-leg-taken"></span>Belegt</span>
    </div>`;

  el.innerHTML = h;
}

function calFormatAppt(dateStr, timeStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const [h, m] = timeStr.split(':').map(Number);
  const endMin = h * 60 + m + 60;
  const endStr = String(Math.floor(endMin / 60) % 24).padStart(2, '0') + ':' + String(endMin % 60).padStart(2, '0');
  return CAL_DAYS[d.getDay()] + ', ' + d.getDate() + '. ' + CAL_MONTHS[d.getMonth()] + ' ' + d.getFullYear()
    + ' · ' + timeStr.slice(0,5) + ' – ' + endStr + ' Uhr';
}

function calEsc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// Werden von jeder Seite überschrieben
function calOnBook(date, time) {}
function calOnCancel(id) {}
