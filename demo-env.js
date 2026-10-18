/* HOMES/BKK demo mode: runs the real backend code (demo-backend.js) against fake Google services kept in localStorage.
   Nothing leaves the browser. Used only when config.js has no endpoint. */
(function () {
  'use strict';
  var LS = null; try { LS = window.localStorage; } catch (e) { LS = null; }
  var mem = {};
  function lsGet(k) { try { return LS ? LS.getItem(k) : (mem[k] || null); } catch (e) { return mem[k] || null; } }
  function lsSet(k, v) { try { if (LS) LS.setItem(k, v); else mem[k] = v; } catch (e) { mem[k] = v; } }

  /* ---- synchronous SHA-256 / HMAC (Apps Script's Utilities is synchronous, the browser's crypto.subtle is not) ---- */
  var K = [], H0 = [];
  (function () {
    var primes = [], n = 2;
    while (primes.length < 64) { var ok = true; for (var i = 0; i < primes.length; i++) if (n % primes[i] === 0) { ok = false; break; } if (ok) primes.push(n); n++; }
    function frac(x) { return Math.floor((x - Math.floor(x)) * 4294967296); }
    primes.forEach(function (p) { K.push(frac(Math.cbrt(p))); });
    primes.slice(0, 8).forEach(function (p) { H0.push(frac(Math.sqrt(p))); });
  })();
  function sha256(bytes) {
    var l = bytes.length, total = (((l + 9 + 63) >> 6) << 6), m = new Uint8Array(total);
    m.set(bytes); m[l] = 0x80;
    var bits = l * 8; m[total - 4] = (bits >>> 24) & 255; m[total - 3] = (bits >>> 16) & 255; m[total - 2] = (bits >>> 8) & 255; m[total - 1] = bits & 255;
    m[total - 8] = Math.floor(l / 536870912) & 255; // high word for very long inputs
    var h = H0.slice(), w = new Array(64);
    for (var off = 0; off < total; off += 64) {
      for (var i = 0; i < 16; i++) w[i] = (m[off + 4 * i] << 24) | (m[off + 4 * i + 1] << 16) | (m[off + 4 * i + 2] << 8) | m[off + 4 * i + 3];
      for (i = 16; i < 64; i++) {
        var a = w[i - 15], b = w[i - 2];
        var s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
        var s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      var A = h[0], B = h[1], C = h[2], D = h[3], E = h[4], F = h[5], G = h[6], Hh = h[7];
      for (i = 0; i < 64; i++) {
        var S1 = ((E >>> 6) | (E << 26)) ^ ((E >>> 11) | (E << 21)) ^ ((E >>> 25) | (E << 7));
        var ch = (E & F) ^ (~E & G);
        var t1 = (Hh + S1 + ch + K[i] + w[i]) | 0;
        var S0 = ((A >>> 2) | (A << 30)) ^ ((A >>> 13) | (A << 19)) ^ ((A >>> 22) | (A << 10));
        var mj = (A & B) ^ (A & C) ^ (B & C);
        var t2 = (S0 + mj) | 0;
        Hh = G; G = F; F = E; E = (D + t1) | 0; D = C; C = B; B = A; A = (t1 + t2) | 0;
      }
      h[0] = (h[0] + A) | 0; h[1] = (h[1] + B) | 0; h[2] = (h[2] + C) | 0; h[3] = (h[3] + D) | 0;
      h[4] = (h[4] + E) | 0; h[5] = (h[5] + F) | 0; h[6] = (h[6] + G) | 0; h[7] = (h[7] + Hh) | 0;
    }
    var out = new Uint8Array(32);
    for (i = 0; i < 8; i++) { out[4 * i] = h[i] >>> 24; out[4 * i + 1] = (h[i] >>> 16) & 255; out[4 * i + 2] = (h[i] >>> 8) & 255; out[4 * i + 3] = h[i] & 255; }
    return out;
  }
  function hmac(keyBytes, msgBytes) {
    var k = keyBytes.length > 64 ? sha256(keyBytes) : keyBytes, ip = new Uint8Array(64 + msgBytes.length), op = new Uint8Array(96);
    for (var i = 0; i < 64; i++) { var kb = i < k.length ? k[i] : 0; ip[i] = kb ^ 0x36; op[i] = kb ^ 0x5c; }
    ip.set(msgBytes, 64); op.set(sha256(ip), 64);
    return sha256(op);
  }
  function utf8(s) { return new TextEncoder().encode(String(s)); }
  function signed(u8) { return Array.prototype.map.call(u8, function (b) { return b > 127 ? b - 256 : b; }); }
  function unsigned(a) { return Uint8Array.from(a, function (b) { return b < 0 ? b + 256 : b; }); }
  function b64(u8) { var s = ''; for (var i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return btoa(s); }
  function b64url(u8) { return b64(u8).replace(/\+/g, '-').replace(/\//g, '_'); }
  function ubytes(x) { return typeof x === 'string' ? utf8(x) : unsigned(x); }

  /* ---- the fake Google services ---- */
  function create(opts) {
    opts = opts || {};
    var pre = opts.prefix || 'hb-demo-';
    var sheets = {};
    try { sheets = JSON.parse(lsGet(pre + 'sheets') || '{}'); } catch (e) { sheets = {}; }
    var props = {};
    try { props = JSON.parse(lsGet(pre + 'props') || '{}'); } catch (e) { props = {}; }
    var files = {};
    try { files = JSON.parse(lsGet(pre + 'files') || '{}'); } catch (e) { files = {}; }
    var mails = [];
    try { mails = JSON.parse(lsGet(pre + 'mail') || '[]'); } catch (e) { mails = []; }
    var cache = {};
    function saveSheets() { lsSet(pre + 'sheets', JSON.stringify(sheets)); }
    function saveProps() { lsSet(pre + 'props', JSON.stringify(props)); }
    function saveFiles() { lsSet(pre + 'files', JSON.stringify(files)); }
    function sheetObj(name) {
      return {
        appendRow: function (row) { sheets[name].push(row); saveSheets(); },
        getDataRange: function () { return { getValues: function () { return sheets[name].map(function (r) { return r.slice(); }); } }; },
        getLastRow: function () { return sheets[name].length; },
        getRange: function (r, c) {
          return {
            setValues: function (vals) {
              vals.forEach(function (row, i) { var t = (sheets[name][r - 1 + i] = sheets[name][r - 1 + i] || []); row.forEach(function (v, j) { t[c - 1 + j] = v; }); });
              saveSheets(); return this;
            },
            setFontWeight: function () { return this; }, setBackground: function () { return this; },
            setDataValidation: function () { return this; }, setNumberFormat: function () { return this; }
          };
        },
        setFrozenRows: function () {}
      };
    }
    var ss = {
      getSheetByName: function (n) { return sheets[n] ? sheetObj(n) : null; },
      insertSheet: function (n) { sheets[n] = [[]]; saveSheets(); return sheetObj(n); },
      getId: function () { return 'demo'; }, getUrl: function () { return 'demo'; }
    };
    var seq = 0;
    var env = {
      console: { log: function () {}, error: function () { try { console.warn.apply(console, arguments); } catch (e) { /* ignore */ } } },
      Logger: { log: function () {} },
      SpreadsheetApp: {
        getActive: function () { return ss; }, openById: function () { return ss; },
        newDataValidation: function () { return { requireValueInList: function () { return this; }, setAllowInvalid: function () { return this; }, build: function () { return {}; } }; }
      },
      PropertiesService: { getScriptProperties: function () { return {
        getProperty: function (k) { return Object.prototype.hasOwnProperty.call(props, k) ? props[k] : null; },
        setProperty: function (k, v) { props[k] = v; saveProps(); } }; } },
      CacheService: { getScriptCache: function () { return {
        get: function (k) { return Object.prototype.hasOwnProperty.call(cache, k) ? cache[k] : null; },
        put: function (k, v) { cache[k] = v; }, remove: function (k) { delete cache[k]; },
        removeAll: function (ks) { ks.forEach(function (k) { delete cache[k]; }); } }; } },
      LockService: { getScriptLock: function () { return { waitLock: function () {}, releaseLock: function () {} }; } },
      MailApp: { sendEmail: function (m) {
        mails.unshift({ to: m.to, subject: m.subject, body: m.body, at: Date.now() }); mails = mails.slice(0, 30);
        lsSet(pre + 'mail', JSON.stringify(mails));
      } },
      Session: { getEffectiveUser: function () { return { getEmail: function () { return opts.admin || 'admin@homes-bkk.test'; } }; } },
      ContentService: { MimeType: { JSON: 'json' }, createTextOutput: function (text) { return { text: text, setMimeType: function () { return this; }, getContent: function () { return text; } }; } },
      ScriptApp: { getProjectTriggers: function () { return []; }, newTrigger: function () { var t = { timeBased: function () { return t; }, everyDays: function () { return t; }, atHour: function () { return t; }, create: function () {} }; return t; } },
      DriveApp: {
        Access: { ANYONE_WITH_LINK: 'link' }, Permission: { VIEW: 'view' },
        createFolder: function () { return { getId: function () { return 'folder'; } }; },
        getFolderById: function () { return { createFile: function (blob) {
          var id = 'DEMO' + Date.now().toString(36) + (++seq) + Math.random().toString(36).slice(2, 8);
          files[id] = 'data:' + blob.mime + ';base64,' + b64(unsigned(blob.bytes)); saveFiles();
          return { getId: function () { return id; }, setSharing: function () {} };
        } }; },
        getFileById: function (id) { return { setTrashed: function () { delete files[id]; saveFiles(); } }; }
      },
      Utilities: {
        formatDate: function (d, tz, f) {
          var p = {}; new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
            .formatToParts(d).forEach(function (x) { p[x.type] = x.value; });
          if (p.hour === '24') p.hour = '00';
          return f === 'yyMMdd' ? p.year.slice(2) + p.month + p.day : p.year + '-' + p.month + '-' + p.day + ' ' + p.hour + ':' + p.minute + ':' + p.second;
        },
        DigestAlgorithm: { SHA_256: 'sha256' },
        computeDigest: function (alg, s) { return signed(sha256(ubytes(s))); },
        computeHmacSha256Signature: function (v, k) { return signed(hmac(ubytes(k), ubytes(v))); },
        base64EncodeWebSafe: function (x) { return b64url(ubytes(x)); },
        base64Decode: function (s) { if (!/^[A-Za-z0-9+\/=\s]*$/.test(s)) throw new Error('bad base64'); return signed(Uint8Array.from(atob(s.replace(/\s+/g, '')), function (c) { return c.charCodeAt(0); })); },
        getUuid: function () { return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }); },
        newBlob: function (bytes, mime, name) { return { bytes: bytes, mime: mime, name: name }; }
      }
    };
    var gas = window.HB_GAS(env.SpreadsheetApp, env.PropertiesService, env.CacheService, env.LockService, env.MailApp, env.Session, env.ContentService, env.Utilities, env.DriveApp, env.ScriptApp, env.console, env.Logger);

    if (!props.SHEET_ID) { // first run: build the sheets and the demo team
      props.SHEET_ID = 'demo'; saveProps();
      gas.setup();
      [['agent@homes-bkk.test', 'Demo Agent', 'agent', false], ['partner@homes-bkk.test', 'Demo Partner', 'partner', true]].forEach(function (u) {
        gas.appendObj_('Users', { email: u[0], name: u[1], role: u[2], trusted: u[3], status: 'active', invited_by: 'demo', created_at: '2026-01-01 00:00:00' });
      });
      mails = []; lsSet(pre + 'mail', '[]');
    }

    function publish() { // what live.js/map/listing read in demo mode
      var r = JSON.parse(gas.doGet({ parameter: { action: 'listings' } }).getContent());
      lsSet(pre + 'pub', JSON.stringify(r.listings || []));
    }
    publish();
    return {
      post: function (body) { var r = JSON.parse(gas.doPost({ postData: { contents: JSON.stringify(body) } }).getContent()); publish(); return r; },
      get: function (parameter) { return JSON.parse(gas.doGet({ parameter: parameter || {} }).getContent()); },
      mails: function () { return mails.slice(); },
      files: files,
      reset: function () { ['sheets', 'props', 'files', 'mail', 'pub'].forEach(function (k) { try { LS && LS.removeItem(pre + k); } catch (e) { /* ignore */ } }); },
      daily: function () { gas.dailyMaintenance(); publish(); },
      _sha256: function (s) { return Array.prototype.map.call(sha256(utf8(s)), function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); },
      _hmac: function (k, s) { return Array.prototype.map.call(hmac(utf8(k), utf8(s)), function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }
    };
  }
  window.HB_DEMO = { create: create };
})();
