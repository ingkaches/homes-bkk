// Minimal in-memory stand-ins for the Apps Script services Code.gs uses.
// Used by test.js and mock-server.js. Not part of the deployed script.
const vm = require('vm'), fs = require('fs'), path = require('path'), crypto = require('crypto');

function createEnv(opts = {}) {
  const sheets = {};   // name -> array of rows (row 0 = headers)
  const mails = [];
  const props = { SHEET_ID: 'mock', NOTIFY_EMAIL: opts.notify === undefined ? 'owner@example.com' : opts.notify };
  const cache = {};
  const logs = [];
  const triggers = [];
  const mkSheet = (name) => (sheets[name] = sheets[name] || [[]]);
  const sheetObj = (name) => ({
    appendRow: (row) => { sheets[name].push(row); },
    getDataRange: () => ({ getValues: () => sheets[name].map((r) => r.slice()) }),
    getLastRow: () => sheets[name].length,
    getRange: (r, c, nr, nc) => ({
      setValues(vals) { vals.forEach((row, i) => { const t = (sheets[name][r - 1 + i] = sheets[name][r - 1 + i] || []); row.forEach((v, j) => { t[c - 1 + j] = v; }); }); return this; },
      setFontWeight() { return this; }, setBackground() { return this; }, setDataValidation() { return this; }, setNumberFormat() { return this; }
    }),
    setFrozenRows() {}
  });
  const drive = { files: {}, folders: {} };
  let fileSeq = 0;
  const ss = {
    getSheetByName: (n) => (sheets[n] ? sheetObj(n) : null),
    insertSheet: (n) => { mkSheet(n); return sheetObj(n); },
    getId: () => 'mock', getUrl: () => 'https://docs.google.com/spreadsheets/d/mock'
  };
  const out = (text) => ({ text, mime: null, setMimeType(m) { this.mime = m; return this; }, getContent() { return this.text; } });
  const ctx = {
    console: { log() {}, error: (...a) => logs.push(a.join(' ')) },
    Logger: { log() {} },
    SpreadsheetApp: {
      getActive: () => ss, openById: () => ss,
      newDataValidation: () => ({ requireValueInList() { return this; }, setAllowInvalid() { return this; }, build() { return {}; } })
    },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props[k] || null, setProperty: (k, v) => { props[k] = v; } }) },
    CacheService: { getScriptCache: () => ({ get: (k) => (k in cache ? cache[k] : null), put: (k, v) => { if (String(v).length > 100000) throw new Error('cache value too large'); cache[k] = v; }, remove: (k) => { delete cache[k]; }, removeAll: (ks) => ks.forEach((k) => delete cache[k]) }) },
    ScriptApp: { getProjectTriggers: () => triggers, newTrigger: (fn) => ({ timeBased() { return this; }, everyDays() { return this; }, atHour() { return this; }, create() { triggers.push({ getHandlerFunction: () => fn }); } }) },
    DriveApp: {
      Access: { ANYONE_WITH_LINK: 'link' }, Permission: { VIEW: 'view' },
      createFolder: (n) => { const id = 'folder' + (++fileSeq); drive.folders[id] = n; return { getId: () => id }; },
      getFolderById: (id) => ({ createFile: (blob) => { const fid = 'FILE' + String(++fileSeq).padStart(12, 'x'); drive.files[fid] = { blob, shared: null, trashed: false }; return { getId: () => fid, setSharing: (a, p) => { drive.files[fid].shared = a + ':' + p; } }; } }),
      getFileById: (id) => ({ setTrashed: (t) => { if (!drive.files[id]) throw new Error('no file'); drive.files[id].trashed = t; } })
    },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    MailApp: { sendEmail: (m) => { if (opts.mailFails) throw new Error('mail down'); mails.push(m); } },
    Session: { getEffectiveUser: () => ({ getEmail: () => 'owner@example.com' }) },
    ContentService: { createTextOutput: out, MimeType: { JSON: 'json' } },
    Utilities: {
      formatDate: (d, tz, f) => {
        const p = new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).formatToParts(d).reduce((a, x) => (a[x.type] = x.value, a), {});
        return f === 'yyMMdd' ? p.year.slice(2) + p.month + p.day : `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
      },
      DigestAlgorithm: { SHA_256: 'sha256' },
      computeDigest: (alg, s) => [...crypto.createHash(alg).update(s).digest()].map((b) => (b > 127 ? b - 256 : b)),
      base64EncodeWebSafe: (x) => (typeof x === 'string' ? Buffer.from(x) : Buffer.from(x.map((b) => (b < 0 ? b + 256 : b)))).toString('base64url') + '=='.slice(0, 0),
      computeHmacSha256Signature: (v, k) => [...crypto.createHmac('sha256', k).update(v).digest()].map((b) => (b > 127 ? b - 256 : b)),
      getUuid: () => crypto.randomUUID(),
      base64Decode: (s) => { if (!/^[A-Za-z0-9+/=\s]*$/.test(s)) throw new Error('bad base64'); return [...Buffer.from(s, 'base64')].map((b) => (b > 127 ? b - 256 : b)); },
      newBlob: (bytes, mime, name) => ({ bytes, mime, name })
    }
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'Code.gs'), 'utf8') + '\n' + fs.readFileSync(path.join(__dirname, 'Portal.gs'), 'utf8') + '\nthis.__api={doPost,doGet,setup,dailyMaintenance,publicList_};', ctx);
  return {
    sheets, mails, props, logs, drive, cache, triggers,
    daily: () => ctx.__api.dailyMaintenance(),
    setup: () => ctx.__api.setup(),
    post: (obj) => JSON.parse(ctx.__api.doPost({ postData: { contents: typeof obj === 'string' ? obj : JSON.stringify(obj) } }).getContent()),
    get: (parameter) => JSON.parse(ctx.__api.doGet({ parameter: parameter || {} }).getContent())
  };
}
module.exports = { createEnv };
