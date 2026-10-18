/**
 * HOMES/BKK listing system (Google Apps Script). Lives next to Code.gs in the same project.
 *
 * Everything arrives as POST {action, email, token, ...} (text/plain JSON, like the forms) except the two public
 * reads, which are GET ?action=listings and GET ?action=listing&id=...
 *
 * Sheets: "Users" and "Listings" (created by setup()). Photos go to a Drive folder.
 * Design and rationale: ../SYSTEM-DESIGN-TH.md
 */

var P = {
  USERS: 'Users',
  LISTINGS: 'Listings',
  ROLES: ['admin', 'partner', 'agent'],
  STATUSES: ['draft', 'pending', 'published', 'rejected', 'archived'],
  AREAS: ['sukhumvit', 'sathorn', 'thonglor', 'thonburi', 'saimai', 'rama9', 'ari', 'bangna', 'other'],
  TYPES: ['Condo', 'House', 'Townhome', 'Duplex', 'Penthouse', 'Villa', 'Other'],
  TAGS: ['pet-friendly', 'work-from-home', 'quiet', 'city-view', 'family', 'bts', 'riverside', 'central', 'low-rise', 'high-rise'],
  FURNISHED: ['fully', 'partly', 'none'],
  MIN_PHOTOS: 3,
  MAX_PHOTOS: 30,
  MAX_PHOTO_BYTES: 3 * 1024 * 1024,
  MAX_LISTINGS_PER_USER: 100,
  TOKEN_DAYS: 14,
  OTP_MINUTES: 10,
  OTP_TRIES: 5,
  OTP_PER_HOUR: 5,         // code requests per email
  OTP_GLOBAL_PER_HOUR: 40, // code mails for the whole site
  UPLOADS_PER_HOUR: 80,    // per user
  REMIND_DAYS: 30,
  ARCHIVE_DAYS: 60,
  FUZZ_M: 200,             // public map centre is moved up to this far from the true point (per axis)
  CHUNK: 30000,            // characters per cache chunk (CacheService: 100 KB per value, Thai text is 3 bytes a char)
  BKK: { latMin: 13.3, latMax: 14.3, lngMin: 100.2, lngMax: 101.1 }
};

var P_HEADERS = {
  'Users': ['email', 'name', 'role', 'trusted', 'status', 'company', 'phone', 'line', 'invited_by', 'created_at', 'last_login'],
  'Listings': ['id', 'status', 'owner_email', 'owner_name', 'created_at', 'updated_at', 'submitted_at', 'published_at', 'confirmed_at',
               'reject_reason', 'title', 'project', 'area', 'intents', 'price_sale', 'price_rent', 'photos', 'data']
};

/* ---------- one-time setup, called by setup() in Code.gs ---------- */

function portalSetup_(ss, props) {
  Object.keys(P_HEADERS).forEach(function (name) {
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    var h = P_HEADERS[name];
    sh.getRange(1, 1, 1, h.length).setValues([h]).setFontWeight('bold').setBackground('#e6e2d6');
    sh.setFrozenRows(1);
    sh.getRange(2, 1, 2000, h.length).setNumberFormat('@'); // keep dates and ids as text
  });
  if (!props.getProperty('TOKEN_SECRET')) {
    props.setProperty('TOKEN_SECRET', Utilities.getUuid() + Utilities.getUuid() + Utilities.getUuid());
  }
  if (!props.getProperty('PHOTO_FOLDER_ID')) {
    props.setProperty('PHOTO_FOLDER_ID', DriveApp.createFolder('HOMES-BKK photos').getId());
  }
  var me = normEmail_(Session.getEffectiveUser().getEmail());
  if (me && !findUser_(me)) {
    appendObj_(P.USERS, { email: me, name: me.split('@')[0], role: 'admin', trusted: true, status: 'active',
                          invited_by: 'setup', created_at: now_() });
  }
  try {
    var has = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'dailyMaintenance'; });
    if (!has) ScriptApp.newTrigger('dailyMaintenance').timeBased().everyDays(1).atHour(8).create();
  } catch (err) { console.error('trigger failed: ' + err); }
}

/* ---------- entry points (called from Code.gs) ---------- */

function portalGet_(e) {
  var a = e && e.parameter && e.parameter.action;
  if (a === 'listings') return json_({ ok: true, listings: publicList_() });
  if (a === 'listing') {
    var id = String(e.parameter.id || '');
    var one = publicList_().filter(function (x) { return x.id === id; })[0];
    return one ? json_({ ok: true, listing: one }) : json_({ ok: false, error: 'not_found' });
  }
  return null;
}

function portalPost_(body) {
  try {
    var a = String(body.action || '');
    if (a === 'login_request') return json_(loginRequest_(body));
    if (a === 'login_verify') return json_(loginVerify_(body));
    var h = HANDLERS_[a];
    if (!h) return json_({ ok: false, error: 'unknown_action' });
    var u = authUser_(body);
    if (!u) return json_({ ok: false, error: 'unauthorized' });
    if (h.admin && u.role !== 'admin') return json_({ ok: false, error: 'forbidden' });
    var out;
    if (h.write) {
      var lock = LockService.getScriptLock();
      lock.waitLock(20000);
      try { out = h.fn(u, body); } finally { lock.releaseLock(); }
    } else {
      out = h.fn(u, body);
    }
    return json_(out);
  } catch (err) {
    console.error('portal error: ' + err + (err && err.stack ? ' ' + err.stack : ''));
    return json_({ ok: false, error: 'server' });
  }
}

var HANDLERS_ = {
  me:              { fn: apiMe_ },
  profile_update:  { fn: apiProfile_, write: true },
  my_listings:     { fn: apiMine_ },
  get_listing:     { fn: apiGet_ },
  save_listing:    { fn: apiSave_, write: true },
  submit_listing:  { fn: apiSubmit_, write: true },
  confirm_listing: { fn: apiConfirm_, write: true },
  archive_listing: { fn: apiArchive_, write: true },
  restore_listing: { fn: apiRestore_, write: true },
  upload_photo:    { fn: apiUpload_, write: true },
  remove_photo:    { fn: apiRemovePhoto_, write: true },
  // admin only
  review_queue:    { fn: apiQueue_, admin: true },
  all_listings:    { fn: apiAll_, admin: true },
  approve_listing: { fn: apiApprove_, admin: true, write: true },
  reject_listing:  { fn: apiReject_, admin: true, write: true },
  set_owner:       { fn: apiSetOwner_, admin: true, write: true },
  users:           { fn: apiUsers_, admin: true },
  user_invite:     { fn: apiInvite_, admin: true, write: true },
  user_update:     { fn: apiUserUpdate_, admin: true, write: true }
};

/* ---------- small helpers ---------- */

function str_(v, max) {
  if (v === null || v === undefined || typeof v === 'object') return '';
  var s = String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  return s.length > max ? s.slice(0, max) : s;
}
function normEmail_(v) {
  var s = str_(v, 160).toLowerCase();
  return /^[a-z0-9._%+\-]+@[a-z0-9\-]+(\.[a-z0-9\-]+)*\.[a-z]{2,}$/.test(s) ? s : '';
}
function truthy_(v) { return v === true || String(v).toUpperCase() === 'TRUE' || String(v).toLowerCase() === 'yes'; }
function hash_(s) {
  return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s)).replace(/=+$/, '');
}
function secret_() {
  var s = PropertiesService.getScriptProperties().getProperty('TOKEN_SECRET');
  if (!s) throw new Error('TOKEN_SECRET missing. Run setup().');
  return s;
}
function hmac_(s) {
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(s, secret_())).replace(/=+$/, '');
}
function safeEq_(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  var d = 0;
  for (var i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
function parseTs_(v) {
  if (v instanceof Date) return v.getTime();
  var m = /^(\d{4})-(\d\d)-(\d\d) (\d\d):(\d\d):(\d\d)$/.exec(String(v || ''));
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] - 7, +m[5], +m[6]) : 0;
}
function daysSince_(v) { var t = parseTs_(v); return t ? (Date.now() - t) / 86400000 : 0; }
function siteUrl_() { return (PropertiesService.getScriptProperties().getProperty('SITE_URL') || '').replace(/\/+$/, ''); }
function portalLink_() { var s = siteUrl_(); return s ? s + '/portal.html' : '(ask the HOMES/BKK team for the portal address)'; }
function mail_(to, subject, lines) {
  try { MailApp.sendEmail({ to: to, subject: subject, body: lines.join('\n'), name: 'HOMES/BKK' }); }
  catch (err) { console.error('mail failed: ' + err); }
}

/* sheet rows as objects */
function readAll_(name) {
  var sh = sheet_(name), vals = sh.getDataRange().getValues(), head = vals[0] || P_HEADERS[name], rows = [];
  for (var i = 1; i < vals.length; i++) {
    if (!vals[i][0]) continue;
    var o = {};
    for (var c = 0; c < head.length; c++) o[head[c]] = vals[i][c];
    rows.push({ n: i + 1, o: o });
  }
  return { sh: sh, head: head, rows: rows };
}
function writeObj_(name, n, o) {
  var sh = sheet_(name), head = P_HEADERS[name];
  sh.getRange(n, 1, 1, head.length).setValues([head.map(function (h) { return o[h] === undefined ? '' : o[h]; })]);
}
function appendObj_(name, o) {
  var head = P_HEADERS[name];
  sheet_(name).appendRow(head.map(function (h) { return o[h] === undefined ? '' : o[h]; }));
}
function guard_(s) { s = String(s === undefined || s === null ? '' : s); return /^[=+\-@\t\r]/.test(s) ? "'" + s : s; }

/* ---------- users ---------- */

function userObj_(o) {
  return {
    email: String(o.email), name: unq_(o.name || ''), role: String(o.role), trusted: truthy_(o.trusted), status: String(o.status || 'active'),
    company: unq_(o.company || ''), phone: unq_(o.phone || ''), line: unq_(o.line || ''),
    invited_by: String(o.invited_by || ''), created_at: String(o.created_at || ''), last_login: String(o.last_login || '')
  };
}
function findUser_(email) {
  var t = readAll_(P.USERS);
  for (var i = 0; i < t.rows.length; i++) if (String(t.rows[i].o.email).toLowerCase() === email) return t.rows[i];
  return null;
}
function authUser_(b) {
  var email = normEmail_(b.who), token = String(b.token || ''); // b.who = the signed-in member (b.email is a target, e.g. when inviting)
  if (!email || !token) return null;
  var dot = token.indexOf('.');
  if (dot < 1) return null;
  var exp = parseInt(token.slice(0, dot), 36);
  if (!exp || exp < Date.now()) return null;
  if (!safeEq_(hmac_(email + '|' + exp), token.slice(dot + 1))) return null;
  var r = findUser_(email);
  if (!r || String(r.o.status) !== 'active') return null;
  var u = userObj_(r.o);
  u._n = r.n;
  return u;
}

function loginRequest_(b) {
  var email = normEmail_(b.email);
  if (!email) return { ok: false, error: 'validation' };
  var cache = CacheService.getScriptCache();
  var k = 'lr:' + hash_(email), g = 'lr:all';
  var n = Number(cache.get(k) || 0), all = Number(cache.get(g) || 0);
  if (n >= P.OTP_PER_HOUR || all >= P.OTP_GLOBAL_PER_HOUR) return { ok: false, error: 'rate_limited' };
  cache.put(k, String(n + 1), 3600);
  var r = findUser_(email);
  if (r && String(r.o.status) === 'active') {
    cache.put(g, String(all + 1), 3600);
    var code = ('000000' + (parseInt(Utilities.getUuid().replace(/-/g, '').slice(0, 8), 16) % 1000000)).slice(-6);
    cache.put('otp:' + hash_(email), JSON.stringify({ h: hash_(code + '|' + email + '|' + secret_()), n: 0 }), P.OTP_MINUTES * 60);
    mail_(email, 'HOMES/BKK sign-in code: ' + code, [
      'Your sign-in code is ' + code, '',
      'It works for ' + P.OTP_MINUTES + ' minutes. If you did not ask for it, ignore this email; nothing happens.', '',
      'Portal: ' + portalLink_()]);
  }
  return { ok: true }; // same answer whether or not the email is a member
}

function loginVerify_(b) {
  var email = normEmail_(b.email), code = str_(b.code, 12).replace(/\s+/g, '');
  if (!email || !/^\d{6}$/.test(code)) return { ok: false, error: 'invalid_code' };
  var cache = CacheService.getScriptCache(), key = 'otp:' + hash_(email);
  var raw = cache.get(key);
  if (!raw) return { ok: false, error: 'invalid_code' };
  var st = JSON.parse(raw);
  if (st.n >= P.OTP_TRIES) return { ok: false, error: 'invalid_code' };
  if (!safeEq_(st.h, hash_(code + '|' + email + '|' + secret_()))) {
    st.n++; cache.put(key, JSON.stringify(st), P.OTP_MINUTES * 60);
    return { ok: false, error: 'invalid_code' };
  }
  cache.remove(key);
  var r = findUser_(email);
  if (!r || String(r.o.status) !== 'active') return { ok: false, error: 'invalid_code' };
  r.o.last_login = now_();
  writeObj_(P.USERS, r.n, r.o);
  var exp = Date.now() + P.TOKEN_DAYS * 86400000;
  return { ok: true, token: exp.toString(36) + '.' + hmac_(email + '|' + exp), expires: exp, user: userObj_(r.o) };
}

function apiMe_(u) { return { ok: true, user: publicUser_(u) }; }
function publicUser_(u) { var c = {}; Object.keys(u).forEach(function (k) { if (k.charAt(0) !== '_') c[k] = u[k]; }); return c; }

function apiProfile_(u, b) {
  var r = findUser_(u.email);
  r.o.name = guard_(str_(b.name, 80) || u.name);
  r.o.company = guard_(str_(b.company, 80));
  r.o.phone = guard_(str_(b.phone, 40));
  r.o.line = guard_(str_(b.line, 60));
  writeObj_(P.USERS, r.n, r.o);
  return { ok: true, user: userObj_(r.o) };
}

function adminCount_() {
  return readAll_(P.USERS).rows.filter(function (r) { return r.o.role === 'admin' && String(r.o.status) === 'active'; }).length;
}
function apiUsers_() {
  var t = readAll_(P.USERS), ls = readAll_(P.LISTINGS).rows, counts = {};
  ls.forEach(function (r) { var e = String(r.o.owner_email); (counts[e] = counts[e] || {})[r.o.status] = ((counts[e] || {})[r.o.status] || 0) + 1; });
  return { ok: true, users: t.rows.map(function (r) { var x = userObj_(r.o); x.counts = counts[x.email] || {}; return x; }) };
}
function apiInvite_(u, b) {
  var email = normEmail_(b.email), role = String(b.role || 'agent');
  if (!email) return { ok: false, error: 'validation', fields: { email: 'invalid' } };
  if (P.ROLES.indexOf(role) < 0) return { ok: false, error: 'validation', fields: { role: 'invalid' } };
  if (findUser_(email)) return { ok: false, error: 'exists' };
  var name = str_(b.name, 80) || email.split('@')[0];
  appendObj_(P.USERS, { email: email, name: guard_(name), role: role, trusted: role === 'admin' ? true : b.trusted === true, status: 'active',
                        company: guard_(str_(b.company, 80)), invited_by: u.email, created_at: now_() });
  mail_(email, 'You are invited to HOMES/BKK', [
    'Hi ' + name + ',', '',
    u.name + ' invited you to list homes on HOMES/BKK as ' + (role === 'admin' ? 'an admin' : 'a ' + role) + '.', '',
    '1. Open ' + portalLink_(), '2. Enter this email address', '3. Type the 6-digit code we send you', '',
    role === 'admin' || b.trusted === true ? 'Your listings go live as soon as you submit them.' : 'New listings are checked by the team before they go live.']);
  return { ok: true };
}
function apiUserUpdate_(u, b) {
  var email = normEmail_(b.email), r = email && findUser_(email);
  if (!r) return { ok: false, error: 'not_found' };
  var was = userObj_(r.o);
  var role = b.role === undefined ? was.role : String(b.role), status = b.status === undefined ? was.status : String(b.status);
  if (P.ROLES.indexOf(role) < 0 || ['active', 'disabled'].indexOf(status) < 0) return { ok: false, error: 'validation' };
  var losesAdmin = was.role === 'admin' && was.status === 'active' && (role !== 'admin' || status !== 'active');
  if (losesAdmin && adminCount_() <= 1) return { ok: false, error: 'last_admin' };
  r.o.role = role; r.o.status = status;
  if (b.trusted !== undefined) r.o.trusted = b.trusted === true;
  if (b.name !== undefined) r.o.name = guard_(str_(b.name, 80) || was.name);
  if (b.company !== undefined) r.o.company = guard_(str_(b.company, 80));
  writeObj_(P.USERS, r.n, r.o);
  if (status === 'disabled') {
    // a disabled member must not stay on the site: archive their live listings so nothing is orphaned
    var ls = readAll_(P.LISTINGS), changed = false;
    ls.rows.forEach(function (x) {
      if (String(x.o.owner_email) === email && x.o.status === 'published') { x.o.status = 'archived'; x.o.updated_at = now_(); writeObj_(P.LISTINGS, x.n, x.o); changed = true; }
    });
    if (changed) clearPublic_();
  }
  return { ok: true, user: userObj_(r.o) };
}

/* ---------- listing data ---------- */

function num_(v, min, max, int) {
  if (v === '' || v === null || v === undefined) return { v: null };
  var n = Number(String(v).replace(/,/g, ''));
  if (!isFinite(n) || n < min || n > max) return { err: true };
  return { v: int ? Math.round(n) : Math.round(n * 100) / 100 };
}

/** Normalise the fields the client sent. Only keys present in d are touched. Returns {data, errors}. */
function cleanListing_(d) {
  var out = {}, errors = {};
  function has(k) { return Object.prototype.hasOwnProperty.call(d, k); }
  function text(k, max) { if (has(k)) out[k] = str_(d[k], max); }
  text('title', 120); text('title_th', 120); text('project', 100); text('address_private', 200);
  text('story', 3000); text('story_th', 3000); text('floor', 10);
  if (has('area')) { var a = String(d.area || ''); if (!a || P.AREAS.indexOf(a) >= 0) out.area = a; else errors.area = 'invalid'; }
  if (has('type')) { var t = String(d.type || ''); if (!t || P.TYPES.indexOf(t) >= 0) out.type = t; else errors.type = 'invalid'; }
  if (has('furnished')) { var f = String(d.furnished || ''); if (!f || P.FURNISHED.indexOf(f) >= 0) out.furnished = f; else errors.furnished = 'invalid'; }
  if (has('intents')) {
    var arr = Array.isArray(d.intents) ? d.intents : [];
    out.intents = ['rent', 'buy'].filter(function (x) { return arr.indexOf(x) >= 0; });
  }
  if (has('tags')) {
    var tg = Array.isArray(d.tags) ? d.tags : [];
    out.tags = P.TAGS.filter(function (x) { return tg.indexOf(x) >= 0; });
  }
  if (has('pets')) out.pets = d.pets === true;
  [['beds', 0, 20, true], ['baths', 0, 20, true], ['size', 1, 99999, false], ['price_sale', 1, 9999999999, true], ['price_rent', 1, 99999999, true]].forEach(function (s) {
    if (!has(s[0])) return;
    var r = num_(d[s[0]], s[1], s[2], s[3]);
    if (r.err) errors[s[0]] = 'invalid'; else out[s[0]] = r.v;
  });
  if (has('lat') || has('lng')) {
    var la = num_(d.lat, -90, 90), ln = num_(d.lng, -180, 180);
    if (la.err || ln.err) errors.lat = 'invalid';
    else if (la.v === null && ln.v === null) { out.lat = null; out.lng = null; }
    else if (la.v === null || ln.v === null) errors.lat = 'invalid';
    else {
      var lat = Number(String(d.lat).replace(/,/g, '')), lng = Number(String(d.lng).replace(/,/g, ''));
      if (lat < P.BKK.latMin || lat > P.BKK.latMax || lng < P.BKK.lngMin || lng > P.BKK.lngMax) errors.lat = 'outside_bangkok';
      else { out.lat = Math.round(lat * 1e6) / 1e6; out.lng = Math.round(lng * 1e6) / 1e6; }
    }
  }
  return { data: out, errors: errors };
}

function readyErrors_(d) {
  var e = {};
  if (!d.title) e.title = 'required';
  if (!d.project) e.project = 'required';
  if (!d.area) e.area = 'required';
  if (!d.type) e.type = 'required';
  if (!d.intents || !d.intents.length) e.intents = 'required';
  else {
    if (d.intents.indexOf('buy') >= 0 && !d.price_sale) e.price_sale = 'required';
    if (d.intents.indexOf('rent') >= 0 && !d.price_rent) e.price_rent = 'required';
  }
  if (!d.size) e.size = 'required';
  if (!d.photos || d.photos.length < P.MIN_PHOTOS) e.photos = 'min_' + P.MIN_PHOTOS;
  if (typeof d.lat !== 'number' || typeof d.lng !== 'number') e.lat = 'required';
  return e;
}

function listingObj_(r) {
  var o = r.o, d = {};
  try { d = JSON.parse(o.data || '{}'); } catch (err) { d = {}; }
  return {
    id: String(o.id), status: String(o.status), owner_email: String(o.owner_email), owner_name: unq_(o.owner_name || ''),
    created_at: String(o.created_at), updated_at: String(o.updated_at), submitted_at: String(o.submitted_at || ''),
    published_at: String(o.published_at || ''), confirmed_at: String(o.confirmed_at || ''), reject_reason: unq_(o.reject_reason || ''),
    data: d
  };
}
function saveListing_(r, L) {
  var d = L.data, o = r.o;
  o.status = L.status; o.owner_email = L.owner_email; o.owner_name = guard_(L.owner_name);
  o.created_at = L.created_at; o.updated_at = L.updated_at; o.submitted_at = L.submitted_at; o.published_at = L.published_at;
  o.confirmed_at = L.confirmed_at; o.reject_reason = guard_(L.reject_reason);
  o.title = guard_(d.title || ''); o.project = guard_(d.project || ''); o.area = d.area || '';
  o.intents = (d.intents || []).join('+'); o.price_sale = d.price_sale || ''; o.price_rent = d.price_rent || '';
  o.photos = (d.photos || []).length; o.data = JSON.stringify(d);
  o.id = L.id;
  if (r.n) writeObj_(P.LISTINGS, r.n, o); else { appendObj_(P.LISTINGS, o); r.n = -1; }
}
function findListing_(id) {
  var t = readAll_(P.LISTINGS);
  for (var i = 0; i < t.rows.length; i++) if (String(t.rows[i].o.id) === id) return t.rows[i];
  return null;
}
function newListingId_() {
  var day = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyMMdd'), chars = 'abcdefghjkmnpqrstuvwxyz23456789', tail = '';
  for (var i = 0; i < 5; i++) tail += chars.charAt(Math.floor(Math.random() * chars.length));
  return 'l' + day + tail;
}
function mayEdit_(u, L) { return u.role === 'admin' || L.owner_email === u.email; }
function openListing_(u, id) {
  var r = findListing_(str_(id, 40));
  if (!r) return { err: { ok: false, error: 'not_found' } };
  var L = listingObj_(r);
  if (!mayEdit_(u, L)) return { err: { ok: false, error: 'forbidden' } };
  return { r: r, L: L };
}

/** Fields a non-trusted member may change on a live listing without sending it back to review. */
var LIGHT_FIELDS_ = ['price_sale', 'price_rent'];
function onlyLightChange_(before, after) {
  var keys = {}; Object.keys(before).concat(Object.keys(after)).forEach(function (k) { keys[k] = 1; });
  return Object.keys(keys).every(function (k) {
    return LIGHT_FIELDS_.indexOf(k) >= 0 || JSON.stringify(before[k]) === JSON.stringify(after[k]);
  });
}
/** Status after an edit. */
function statusAfterEdit_(u, L, before) {
  if (L.status === 'rejected') return 'draft';
  if (L.status === 'published' && u.role !== 'admin' && !u.trusted && !onlyLightChange_(before, L.data)) return 'pending';
  return L.status;
}

function apiMine_(u) {
  var t = readAll_(P.LISTINGS).rows.map(listingObj_).filter(function (L) { return L.owner_email === u.email; });
  t.sort(function (a, b) { return a.updated_at < b.updated_at ? 1 : -1; });
  return { ok: true, listings: t };
}
function apiGet_(u, b) { var x = openListing_(u, b.id); return x.err || { ok: true, listing: x.L }; }

function apiSave_(u, b) {
  var d = b.listing;
  if (!d || typeof d !== 'object') return { ok: false, error: 'bad_request' };
  var c = cleanListing_(d);
  if (Object.keys(c.errors).length) return { ok: false, error: 'validation', fields: c.errors };
  var r, L, before, prev;
  if (d.id) {
    var x = openListing_(u, d.id);
    if (x.err) return x.err;
    r = x.r; L = x.L;
    if (L.status === 'archived') return { ok: false, error: 'archived' };
    before = JSON.parse(JSON.stringify(L.data)); prev = L.status;
  } else {
    var mine = readAll_(P.LISTINGS).rows.filter(function (q) { return String(q.o.owner_email) === u.email; }).length;
    if (u.role !== 'admin' && mine >= P.MAX_LISTINGS_PER_USER) return { ok: false, error: 'limit' };
    var t = now_();
    L = { id: newListingId_(), status: 'draft', owner_email: u.email, owner_name: u.name, created_at: t, updated_at: t,
          submitted_at: '', published_at: '', confirmed_at: '', reject_reason: '', data: { photos: [] } };
    r = { n: 0, o: {} };
    before = JSON.parse(JSON.stringify(L.data)); prev = 'draft';
  }
  Object.keys(c.data).forEach(function (k) { L.data[k] = c.data[k]; });
  if (Array.isArray(d.photos)) { // reorder only; never adds or removes
    var have = L.data.photos || [], order = d.photos.filter(function (p) { return have.indexOf(p) >= 0; });
    L.data.photos = order.concat(have.filter(function (p) { return order.indexOf(p) < 0; }));
  }
  if (!L.data.title && !L.data.project) return { ok: false, error: 'validation', fields: { title: 'required' } };
  L.status = statusAfterEdit_(u, L, before);
  L.updated_at = now_();
  saveListing_(r, L);
  if (L.status === 'published' || prev === 'published') clearPublic_();
  return { ok: true, listing: L };
}

function apiSubmit_(u, b) {
  var x = openListing_(u, b.id);
  if (x.err) return x.err;
  var L = x.L;
  if (L.status === 'archived') return { ok: false, error: 'archived' };
  if (L.status === 'published') return { ok: true, listing: L, status: 'published' };
  var errs = readyErrors_(L.data);
  if (Object.keys(errs).length) return { ok: false, error: 'not_ready', fields: errs };
  var t = now_();
  L.submitted_at = t; L.updated_at = t; L.reject_reason = '';
  if (u.role === 'admin' || u.trusted) {
    L.status = 'published'; L.published_at = L.published_at || t; L.confirmed_at = t;
  } else {
    L.status = 'pending';
  }
  saveListing_(x.r, L);
  if (L.status === 'published') clearPublic_(); else notifyAdmins_(L);
  return { ok: true, listing: L, status: L.status };
}

function apiConfirm_(u, b) {
  var x = openListing_(u, b.id);
  if (x.err) return x.err;
  if (x.L.status !== 'published') return { ok: false, error: 'not_published' };
  x.L.confirmed_at = now_(); x.L.data.reminded_at = '';
  saveListing_(x.r, x.L); clearPublic_();
  return { ok: true, listing: x.L };
}
function apiArchive_(u, b) {
  var x = openListing_(u, b.id);
  if (x.err) return x.err;
  var was = x.L.status;
  x.L.status = 'archived'; x.L.updated_at = now_();
  saveListing_(x.r, x.L);
  if (was === 'published') clearPublic_();
  return { ok: true, listing: x.L };
}
function apiRestore_(u, b) {
  var x = openListing_(u, b.id);
  if (x.err) return x.err;
  if (x.L.status !== 'archived') return { ok: false, error: 'bad_state' };
  x.L.status = 'draft'; x.L.updated_at = now_();
  saveListing_(x.r, x.L);
  return { ok: true, listing: x.L };
}

/* ---------- photos ---------- */

function sniffImage_(bytes) {
  function at(i) { return bytes[i] & 255; }
  if (bytes.length < 12) return '';
  if (at(0) === 0xFF && at(1) === 0xD8 && at(2) === 0xFF) return 'image/jpeg';
  if (at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4E && at(3) === 0x47) return 'image/png';
  if (at(0) === 0x52 && at(1) === 0x49 && at(2) === 0x46 && at(3) === 0x46 && at(8) === 0x57 && at(9) === 0x45 && at(10) === 0x42 && at(11) === 0x50) return 'image/webp';
  return '';
}
function apiUpload_(u, b) {
  var x = openListing_(u, b.id);
  if (x.err) return x.err;
  var L = x.L;
  if (L.status === 'archived') return { ok: false, error: 'archived' };
  if ((L.data.photos || []).length >= P.MAX_PHOTOS) return { ok: false, error: 'too_many_photos' };
  var cache = CacheService.getScriptCache(), k = 'up:' + hash_(u.email), n = Number(cache.get(k) || 0);
  if (n >= P.UPLOADS_PER_HOUR) return { ok: false, error: 'rate_limited' };
  var b64 = String(b.data || '');
  if (!b64 || b64.length > P.MAX_PHOTO_BYTES * 1.4) return { ok: false, error: 'too_large' };
  var bytes;
  try { bytes = Utilities.base64Decode(b64); } catch (err) { return { ok: false, error: 'bad_image' }; }
  if (bytes.length > P.MAX_PHOTO_BYTES) return { ok: false, error: 'too_large' };
  var mime = sniffImage_(bytes);
  if (!mime) return { ok: false, error: 'bad_image' };
  cache.put(k, String(n + 1), 3600);
  var folder = DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty('PHOTO_FOLDER_ID'));
  var ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
  var file = folder.createFile(Utilities.newBlob(bytes, mime, L.id + '-' + ((L.data.photos || []).length + 1) + '.' + ext));
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  var before = JSON.parse(JSON.stringify(L.data)), prev = L.status;
  L.data.photos = (L.data.photos || []).concat(file.getId());
  L.status = statusAfterEdit_(u, L, before);
  L.updated_at = now_();
  saveListing_(x.r, L);
  if (L.status === 'published' || prev === 'published') clearPublic_();
  return { ok: true, photo_id: file.getId(), status: L.status, photos: L.data.photos };
}
function apiRemovePhoto_(u, b) {
  var x = openListing_(u, b.id);
  if (x.err) return x.err;
  var L = x.L, pid = String(b.photo_id || ''), i = (L.data.photos || []).indexOf(pid);
  if (i < 0) return { ok: false, error: 'not_found' };
  var before = JSON.parse(JSON.stringify(L.data)), prev = L.status;
  L.data.photos.splice(i, 1);
  try { DriveApp.getFileById(pid).setTrashed(true); } catch (err) { console.error('trash failed: ' + err); }
  L.status = statusAfterEdit_(u, L, before);
  L.updated_at = now_();
  saveListing_(x.r, L);
  if (L.status === 'published' || prev === 'published') clearPublic_();
  return { ok: true, status: L.status, photos: L.data.photos };
}

/* ---------- review (admin) ---------- */

function apiQueue_() {
  var q = readAll_(P.LISTINGS).rows.map(listingObj_).filter(function (L) { return L.status === 'pending'; });
  q.sort(function (a, b) { return a.submitted_at < b.submitted_at ? -1 : 1; });
  return { ok: true, listings: q };
}
function apiAll_(u, b) {
  var st = String(b.status || '');
  var q = readAll_(P.LISTINGS).rows.map(listingObj_).filter(function (L) { return !st || L.status === st; });
  q.sort(function (a, b2) { return a.updated_at < b2.updated_at ? 1 : -1; });
  return { ok: true, listings: q };
}
function apiApprove_(u, b) {
  var x = openListing_(u, b.id);
  if (x.err) return x.err;
  var L = x.L;
  if (L.status !== 'pending') return { ok: false, error: 'bad_state' };
  var errs = readyErrors_(L.data);
  if (Object.keys(errs).length) return { ok: false, error: 'not_ready', fields: errs };
  var t = now_();
  L.status = 'published'; L.published_at = L.published_at || t; L.confirmed_at = t; L.updated_at = t; L.reject_reason = '';
  saveListing_(x.r, L); clearPublic_();
  mail_(L.owner_email, '[HOMES/BKK] Your listing is live: ' + (L.data.title || L.data.project), [
    'Good news, "' + (L.data.title || L.data.project) + '" has been approved and is now on HOMES/BKK.',
    siteUrl_() ? siteUrl_() + '/listing.html?id=' + L.id : '', '',
    'We will ask you to confirm it is still available after ' + P.REMIND_DAYS + ' days.']);
  return { ok: true, listing: L };
}
function apiReject_(u, b) {
  var reason = str_(b.reason, 500);
  if (!reason) return { ok: false, error: 'validation', fields: { reason: 'required' } };
  var x = openListing_(u, b.id);
  if (x.err) return x.err;
  var L = x.L, was = L.status;
  if (was !== 'pending' && was !== 'published') return { ok: false, error: 'bad_state' };
  L.status = 'rejected'; L.reject_reason = reason; L.updated_at = now_();
  saveListing_(x.r, L);
  if (was === 'published') clearPublic_();
  mail_(L.owner_email, '[HOMES/BKK] Changes needed: ' + (L.data.title || L.data.project), [
    'We could not publish "' + (L.data.title || L.data.project) + '" yet.', '', 'Reason: ' + reason, '',
    'Edit it in the portal and submit again: ' + portalLink_()]);
  return { ok: true, listing: L };
}
function apiSetOwner_(u, b) {
  var email = normEmail_(b.email), owner = email && findUser_(email);
  if (!owner || String(owner.o.status) !== 'active') return { ok: false, error: 'not_found' };
  var x = openListing_(u, b.id);
  if (x.err) return x.err;
  x.L.owner_email = email; x.L.owner_name = unq_(owner.o.name || ''); x.L.updated_at = now_();
  saveListing_(x.r, x.L);
  if (x.L.status === 'published') clearPublic_();
  return { ok: true, listing: x.L };
}
function notifyAdmins_(L) {
  var to = readAll_(P.USERS).rows.filter(function (r) { return r.o.role === 'admin' && String(r.o.status) === 'active'; })
    .map(function (r) { return String(r.o.email); });
  if (!to.length) return;
  mail_(to.join(','), '[HOMES/BKK] Listing to review: ' + (L.data.title || L.data.project), [
    L.owner_name + ' (' + L.owner_email + ') submitted a listing.', '',
    (L.data.title || L.data.project) + ' · ' + (L.data.area || '') + ' · ' + (L.data.intents || []).join('/'),
    'Review it in the portal: ' + portalLink_()]);
}

/* ---------- public API ---------- */

/** Move the map point a stable, secret distance so the public circle cannot be reversed to the exact spot. */
function fuzz_(id, lat, lng) {
  var h = Utilities.computeHmacSha256Signature('geo:' + id, secret_());
  var dx = ((h[0] & 255) / 255 * 2 - 1) * P.FUZZ_M, dy = ((h[1] & 255) / 255 * 2 - 1) * P.FUZZ_M;
  return [Math.round((lat + dy / 111320) * 1e4) / 1e4, Math.round((lng + dx / (111320 * Math.cos(lat * Math.PI / 180))) * 1e4) / 1e4];
}

/** The ONLY place a listing becomes public. Whitelist, never "everything minus a few". */
function toPublic_(L) {
  var d = L.data, g = (typeof d.lat === 'number' && typeof d.lng === 'number') ? fuzz_(L.id, d.lat, d.lng) : [null, null];
  var owner = findUserCached_(L.owner_email);
  return {
    id: L.id, title: d.title || '', title_th: d.title_th || '', place: d.project || '', area: d.area || '', type: d.type || '',
    intents: d.intents || [], beds: d.beds === undefined ? null : d.beds, baths: d.baths === undefined ? null : d.baths,
    size: d.size || null, floor: d.floor || '', furnished: d.furnished || '', pets: d.pets === true,
    price_sale: d.price_sale || null, price_rent: d.price_rent || null, tags: d.tags || [],
    story: d.story || '', story_th: d.story_th || '', photos: d.photos || [],
    lat: g[0], lng: g[1], by: owner ? owner.name : '', by_role: owner ? owner.role : '',
    published_at: L.published_at, confirmed_at: L.confirmed_at
  };
}
var userCache_ = null;
function findUserCached_(email) {
  if (!userCache_) { userCache_ = {}; readAll_(P.USERS).rows.forEach(function (r) { var u = userObj_(r.o); userCache_[u.email] = u; }); }
  return userCache_[email] || null;
}

function publicList_() {
  var cache = CacheService.getScriptCache(), n = Number(cache.get('pub:n') || 0);
  if (n > 0) {
    var parts = [];
    for (var i = 0; i < n; i++) { var p = cache.get('pub:' + i); if (p === null) { parts = null; break; } parts.push(p); }
    if (parts) { try { return JSON.parse(parts.join('')); } catch (err) { /* rebuild */ } }
  }
  userCache_ = null;
  var list = readAll_(P.LISTINGS).rows.map(listingObj_).filter(function (L) { return L.status === 'published'; });
  list.sort(function (a, b) { return a.published_at < b.published_at ? 1 : -1; });
  var out = list.map(toPublic_), s = JSON.stringify(out), chunks = Math.ceil(s.length / P.CHUNK) || 1;
  for (var c = 0; c < chunks; c++) cache.put('pub:' + c, s.slice(c * P.CHUNK, (c + 1) * P.CHUNK), 600);
  cache.put('pub:n', String(chunks), 600);
  return out;
}
function clearPublic_() {
  var cache = CacheService.getScriptCache(), n = Number(cache.get('pub:n') || 0), keys = ['pub:n'];
  for (var i = 0; i < Math.max(n, 1); i++) keys.push('pub:' + i);
  cache.removeAll(keys);
  userCache_ = null;
}

/* ---------- viewing requests also reach the listing owner ---------- */

function notifyOwnerOfViewing_(row, ref) {
  try {
    if (PropertiesService.getScriptProperties().getProperty('VIEWING_TO_OWNER') === 'no') return;
    var id = String(row.homeId || '');
    if (!/^l[0-9a-z]{6,}$/.test(id)) return;
    var r = findListing_(id);
    if (!r || String(r.o.status) !== 'published') return;
    var L = listingObj_(r), q = {};
    Object.keys(row).forEach(function (k) { q[k] = unq_(row[k]); });
    mail_(L.owner_email, '[HOMES/BKK] Viewing request · ' + (L.data.title || L.data.project) + ' · ' + ref, [
      'Someone wants to see "' + (L.data.title || L.data.project) + '".', '',
      'When: ' + q.date + ' · ' + q.time, 'Format: ' + q.format, 'Name: ' + q.name, 'Phone or Line: ' + q.phone, 'Note: ' + (q.note || '-'), '',
      'Please reply to them directly and tell the HOMES/BKK team how it went.', 'Ref: ' + ref]);
  } catch (err) { console.error('owner notify failed: ' + err); }
}

/* ---------- daily: remind owners, archive what nobody confirms ---------- */

function dailyMaintenance() {
  var t = readAll_(P.LISTINGS), changed = false, mails = 0;
  t.rows.forEach(function (r) {
    var L = listingObj_(r);
    if (L.status !== 'published') return;
    var age = daysSince_(L.confirmed_at || L.published_at);
    var title = L.data.title || L.data.project;
    if (age >= P.ARCHIVE_DAYS) {
      L.status = 'archived'; L.updated_at = now_(); saveListing_(r, L); changed = true;
      if (mails++ < 40) mail_(L.owner_email, '[HOMES/BKK] Listing archived: ' + title, [
        '"' + title + '" was not confirmed for ' + P.ARCHIVE_DAYS + ' days, so we took it off the site. Nothing is deleted.',
        'Restore it in the portal: ' + portalLink_()]);
    } else if (age >= P.REMIND_DAYS && (!L.data.reminded_at || daysSince_(L.data.reminded_at) >= 7)) {
      L.data.reminded_at = now_(); saveListing_(r, L);
      if (mails++ < 40) mail_(L.owner_email, '[HOMES/BKK] Still available? ' + title, [
        'Please confirm "' + title + '" is still available (one click in the portal). Without it we will take it off the site in ' +
        Math.max(1, Math.round(P.ARCHIVE_DAYS - age)) + ' days.', portalLink_()]);
    }
  });
  if (changed) clearPublic_();
}
