/* ===================================================
   TK WEBTALENT – TERMINKALENDER
   Mo–Fr 17–20 Uhr · Sa–So 12–18 Uhr · 60-Min-Slots
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

const CAL_DAYS   = ['So','Mo','Di','Mi','Do','Fr','Sa'];
const CAL_MONTHS = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];

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
  const nowH  = new Date().getHours();

  const allHours = [...new Set(Object.values(SLOT_HOURS).flat())].sort((a, b) => a - b);

  // Buchungs-Lookup: "YYYY-MM-DD HH:00" → appointment
  const bk = {};
  (appointments || []).forEach(a => {
    bk[a.appointment_date + ' ' + a.appointment_time.slice(0, 5)] = a;
  });

  let h = `
    <div class="cal-nav">
      <button class="cal-btn-nav" onclick="calNav(-1)">‹ Vorherige</button>
      <span class="cal-nav-title">${calFmt(mon)} – ${calFmt(sun)} ${sun.getFullYear()}</span>
      <button class="cal-btn-nav" onclick="calNav(1)">Nächste ›</button>
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

  // Zeilen (Stunden)
  allHours.forEach(hr => {
    h += `<div class="cal-time">${String(hr).padStart(2, '0')}:00</div>`;
    days.forEach(d => {
      const dow  = d.getDay();
      const ds   = calISO(d);
      const ts   = String(hr).padStart(2, '0') + ':00';
      const key  = ds + ' ' + ts;
      const has  = (SLOT_HOURS[dow] || []).includes(hr);
      const past = d < today || (ds === calISO(today) && hr <= nowH);
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
          const name = ap.profiles?.full_name || 'Kunde';
          h += `<div class="cal-cell cal-admin-bk">
            <div class="cal-cust-name">${calEsc(name)}</div>
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
  const endH = parseInt(timeStr) + 1;
  return CAL_DAYS[d.getDay()] + ', ' + d.getDate() + '. ' + CAL_MONTHS[d.getMonth()] + ' ' + d.getFullYear()
    + ' · ' + timeStr.slice(0,5) + ' – ' + String(endH).padStart(2,'0') + ':00 Uhr';
}

function calEsc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// Werden von jeder Seite überschrieben
function calOnBook(date, time) {}
function calOnCancel(id) {}
