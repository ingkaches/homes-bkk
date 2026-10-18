/**
 * HOMES/BKK intake backend (Google Apps Script web app).
 *
 * Receives two kinds of POSTs from the website and files them in a Google Sheet:
 *   kind "submission"  -> sheet "Submissions"      (owner / agent submits a home)
 *   kind "viewing"     -> sheet "Viewing requests" (visitor asks for a viewing)
 *
 * The listing system (login, listings, photos, review) is in Portal.gs.
 *
 * Setup: see README-TH.md. In short: bind this script to a Google Sheet, run setup() once,
 * then Deploy > New deployment > Web app (execute as: Me, access: Anyone), and paste the
 * /exec URL into config.js on the website.
 *
 * The site sends Content-Type text/plain so the browser makes a "simple" request (no CORS
 * preflight, which Apps Script cannot answer). The body is JSON.
 */

var HB = {
  SUBMISSIONS: 'Submissions',
  VIEWINGS: 'Viewing requests',
  STATUSES: ['new', 'contacted', 'viewing set', 'closed', 'spam'],
  RATE_PER_HOUR: 5,        // per contact value
  RATE_GLOBAL_PER_HOUR: 60 // whole site, protects the mailbox and the sheet
};

var HEADERS = {
  'Submissions': ['ref', 'received_at', 'status', 'role', 'name', 'contact', 'email', 'intent', 'type', 'project_or_area',
                  'bedrooms', 'size_sqm', 'price', 'unit', 'pets_allowed', 'story', 'photos_to_send', 'lang', 'page', 'notes'],
  'Viewing requests': ['ref', 'received_at', 'status', 'home_id', 'home', 'date', 'time', 'format', 'name', 'phone_or_line',
                       'note', 'lang', 'page', 'notes']
};

/* ---------- one-time setup (run from the editor) ---------- */

function setup() {
  var ss = SpreadsheetApp.getActive();
  if (!ss) throw new Error('Open this script from a Google Sheet (Extensions > Apps Script).');
  Object.keys(HEADERS).forEach(function (name) {
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    var h = HEADERS[name];
    sh.getRange(1, 1, 1, h.length).setValues([h]).setFontWeight('bold').setBackground('#e6e2d6');
    sh.setFrozenRows(1);
    var statusCol = h.indexOf('status') + 1;
    sh.getRange(2, statusCol, 1000, 1).setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(HB.STATUSES, true).setAllowInvalid(false).build());
  });
  var props = PropertiesService.getScriptProperties();
  props.setProperty('SHEET_ID', ss.getId());
  portalSetup_(ss, props);
  if (!props.getProperty('NOTIFY_EMAIL')) {
    props.setProperty('NOTIFY_EMAIL', Session.getEffectiveUser().getEmail());
  }
  Logger.log('Ready. Sheet: ' + ss.getUrl() + ' | notify: ' + props.getProperty('NOTIFY_EMAIL'));
}

/* ---------- web app entry points ---------- */

function doGet(e) {
  var pr = portalGet_(e);
  if (pr) return pr;
  return json_({ ok: true, service: 'homes-bkk-intake' });
}

function doPost(e) {
  var body;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '');
  } catch (err) {
    return json_({ ok: false, error: 'bad_request' });
  }
  if (body && typeof body === 'object' && typeof body.action === 'string') return portalPost_(body);
  if (!body || typeof body !== 'object' || typeof body.data !== 'object' || body.data === null) {
    return json_({ ok: false, error: 'bad_request' });
  }

  // Honeypot: real visitors never fill this. Pretend success, store nothing.
  if (body.hp) return json_({ ok: true, ref: 'HB-OK' });

  var kind = body.kind;
  if (kind !== 'submission' && kind !== 'viewing') return json_({ ok: false, error: 'unknown_kind' });

  var clean = kind === 'submission' ? cleanSubmission_(body.data) : cleanViewing_(body.data);
  if (clean.errors) return json_({ ok: false, error: 'validation', fields: clean.errors });

  var meta = {
    lang: body.lang === 'th' ? 'th' : 'en',
    page: text_(body.page, 120)
  };

  var limited = rateLimited_(clean.contactKey);
  if (limited) return json_({ ok: false, error: 'rate_limited' });

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  var ref;
  try {
    ref = kind === 'submission' ? saveSubmission_(clean.row, meta) : saveViewing_(clean.row, meta);
  } finally {
    lock.releaseLock();
  }
  notify_(kind, ref, clean.row, meta);
  if (kind === 'viewing') notifyOwnerOfViewing_(clean.row, ref);
  return json_({ ok: true, ref: ref });
}

/* ---------- validation ---------- */

function cleanSubmission_(d) {
  var errors = {};
  var row = {
    role: text_(d.role, 40),
    name: text_(d.name, 120),
    contact: text_(d.contact, 120),
    email: text_(d.email, 160),
    intent: text_(d.intent, 40),
    type: text_(d.type, 40),
    where: text_(d.where, 200),
    beds: text_(d.beds, 10),
    size: text_(d.size, 20),
    price: text_(d.price, 80),
    unit: text_(d.unit, 80),
    pets: d.pets ? 'yes' : '',
    story: text_(d.story, 4000),
    photos: d.photos ? 'yes' : ''
  };
  if (!row.name) errors.name = 'required';
  if (!row.contact) errors.contact = 'required';
  if (!row.where) errors.where = 'required';
  if (d.auth !== true) errors.auth = 'required';
  if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(row.email)) errors.email = 'invalid';
  if (row.beds && !/^\d{1,2}$/.test(row.beds)) errors.beds = 'invalid';
  if (row.size && !/^\d{1,5}([.,]\d{1,2})?$/.test(row.size)) errors.size = 'invalid';
  if (Object.keys(errors).length) return { errors: errors };
  return { row: row, contactKey: row.contact.toLowerCase() };
}

function cleanViewing_(d) {
  var errors = {};
  var row = {
    homeId: text_(d.homeId, 60),
    home: text_(d.home, 200),
    date: text_(d.date, 60),
    time: text_(d.time, 40),
    format: text_(d.format, 80),
    name: text_(d.name, 120),
    phone: text_(d.phone, 120),
    note: text_(d.note, 2000)
  };
  if (!row.name) errors.name = 'required';
  if (!row.phone) errors.phone = 'required';
  if (!row.home) errors.home = 'required';
  if (!row.date) errors.date = 'required';
  if (!row.time) errors.time = 'required';
  if (d.consent !== true) errors.consent = 'required';
  if (Object.keys(errors).length) return { errors: errors };
  return { row: row, contactKey: row.phone.toLowerCase() };
}

/** Trim, drop control characters, cap the length, and defuse spreadsheet formulas. */
function text_(v, max) {
  if (v === null || v === undefined || typeof v === 'object') return '';
  var s = String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  if (s.length > max) s = s.slice(0, max);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // a leading quote makes Sheets treat it as text
  return s;
}

/* ---------- storage ---------- */

function sheet_(name) {
  var id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  var ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(name);
  if (!sh) throw new Error('Sheet "' + name + '" is missing. Run setup().');
  return sh;
}

function now_() {
  return Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');
}

function newRef_(prefix) {
  var day = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyMMdd');
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', tail = '';
  for (var i = 0; i < 4; i++) tail += chars.charAt(Math.floor(Math.random() * chars.length));
  return 'HB-' + prefix + '-' + day + '-' + tail;
}

function saveSubmission_(r, m) {
  var ref = newRef_('S');
  sheet_(HB.SUBMISSIONS).appendRow([
    ref, now_(), 'new', r.role, r.name, r.contact, r.email, r.intent, r.type, r.where,
    r.beds, r.size, r.price, r.unit, r.pets, r.story, r.photos, m.lang, m.page, ''
  ]);
  return ref;
}

function saveViewing_(r, m) {
  var ref = newRef_('V');
  sheet_(HB.VIEWINGS).appendRow([
    ref, now_(), 'new', r.homeId, r.home, r.date, r.time, r.format, r.name, r.phone,
    r.note, m.lang, m.page, ''
  ]);
  return ref;
}

/* ---------- abuse control ---------- */

function rateLimited_(contactKey) {
  var cache = CacheService.getScriptCache();
  var hash = Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, contactKey)).slice(0, 22);
  var keys = ['c:' + hash, 'all'];
  var limits = [HB.RATE_PER_HOUR, HB.RATE_GLOBAL_PER_HOUR];
  var counts = keys.map(function (k) { return Number(cache.get(k) || 0); });
  for (var i = 0; i < keys.length; i++) if (counts[i] >= limits[i]) return true;
  keys.forEach(function (k, i) { cache.put(k, String(counts[i] + 1), 3600); });
  return false;
}

/* ---------- email notification (never blocks the save) ---------- */

function notify_(kind, ref, r, m) {
  try {
    var to = PropertiesService.getScriptProperties().getProperty('NOTIFY_EMAIL');
    if (!to) return;
    var lines, subject;
    var q = {};
    Object.keys(r).forEach(function (k) { q[k] = unq_(r[k]); });
    r = q;
    if (kind === 'submission') {
      subject = '[HOMES/BKK] New home submitted · ' + r.where + ' · ' + ref;
      lines = ['From: ' + r.role + ' · ' + r.name, 'Contact: ' + r.contact + (r.email ? ' · ' + r.email : ''),
               'Looking to: ' + r.intent, 'Home: ' + r.type + ' · ' + r.where,
               'Bedrooms / size: ' + (r.beds || '-') + ' / ' + (r.size || '-') + ' sqm',
               'Price: ' + (r.price || '-'), 'Pets allowed: ' + (r.pets || '-'),
               'Story: ' + (r.story || '-')];
    } else {
      subject = '[HOMES/BKK] Viewing request · ' + r.home + ' · ' + ref;
      lines = ['Home: ' + r.home, 'When: ' + r.date + ' · ' + r.time, 'Format: ' + r.format,
               'Name: ' + r.name, 'Phone or Line: ' + r.phone, 'Note: ' + (r.note || '-')];
    }
    lines.push('', 'Language: ' + m.lang, 'Ref: ' + ref, 'Open the sheet to set the status.');
    MailApp.sendEmail({ to: to, subject: subject, body: lines.join('\n'), name: 'HOMES/BKK intake' });
  } catch (err) {
    console.error('notify failed: ' + err);
  }
}

/** Undo the formula-guard apostrophe for display outside the sheet. */
function unq_(s) {
  return String(s).replace(/^'(?=[=+\-@\t\r])/, '');
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
