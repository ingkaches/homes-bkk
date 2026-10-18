// Run with:  node test.js   (no dependencies)
const { createEnv } = require('./mocks');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const sub = (o = {}) => ({ kind: 'submission', lang: 'th', page: 'the-home-edit.html', data: { role: 'Owner', name: 'Somchai', contact: '+00 000 000 0000', email: '', intent: 'Sell', type: 'Condo', where: 'Nye by Sansiri', beds: '1', size: '45', price: '4,990,000', unit: '', pets: false, story: 'High floor, lovely view.', auth: true, ...o } });
const view = (o = {}) => ({ kind: 'viewing', lang: 'en', page: 'book-viewing.html', data: { homeId: 'tristan', home: 'Tristan Condo', date: 'Thursday 22 October', time: '13:00', format: 'Meet at the building', name: 'Anna', phone: 'TEST-PHONE', note: '', consent: true, ...o } });

(() => { const e = createEnv(); e.setup();
  ok(e.sheets['Submissions'] && e.sheets['Viewing requests'], 'setup creates both sheets');
  ok(e.get().ok === true, 'doGet health'); })();

(() => { const e = createEnv(); e.setup();
  const r = e.post(sub()); ok(r.ok && /^HB-S-\d{6}-[A-Z2-9]{4}$/.test(r.ref), 'valid submission returns ref ' + JSON.stringify(r));
  const row = e.sheets['Submissions'][1]; ok(row && row[4] === 'Somchai' && row[2] === 'new', 'row saved with status new');
  ok(row[5] === "'+00 000 000 0000", 'phone starting with + is stored as text');
  ok(e.mails.length === 1 && /Nye by Sansiri/.test(e.mails[0].subject), 'notification sent');
  ok(!/'\+00/.test(e.mails[0].body) && /\+00 000 000 0000/.test(e.mails[0].body), 'mail shows the phone without the guard apostrophe'); })();

(() => { const e = createEnv(); e.setup();
  const r = e.post(view()); ok(r.ok && /^HB-V-/.test(r.ref), 'valid viewing');
  ok(e.sheets['Viewing requests'][1][4] === 'Tristan Condo', 'viewing row saved'); })();

(() => { const e = createEnv(); e.setup();
  let r = e.post(sub({ name: '', contact: '', where: '', auth: false }));
  ok(!r.ok && r.error === 'validation' && r.fields.name && r.fields.contact && r.fields.where && r.fields.auth, 'missing fields are reported');
  r = e.post(sub({ auth: 'true' })); ok(!r.ok && r.fields.auth, 'auth must be boolean true');
  r = e.post(sub({ email: 'not-an-email' })); ok(!r.ok && r.fields.email === 'invalid', 'bad email rejected');
  r = e.post(sub({ beds: 'lots' })); ok(!r.ok && r.fields.beds, 'bad bedrooms rejected');
  r = e.post(view({ consent: false })); ok(!r.ok && r.fields.consent, 'viewing needs consent');
  ok(e.sheets['Submissions'].length === 1 && e.sheets['Viewing requests'].length === 1, 'nothing stored for invalid posts'); })();

(() => { const e = createEnv(); e.setup();
  ok(e.post('not json').error === 'bad_request', 'bad json');
  ok(e.post({ kind: 'submission' }).error === 'bad_request', 'missing data');
  ok(e.post({ kind: 'drop table', data: {} }).error === 'unknown_kind', 'unknown kind');
  const r = e.post({ ...sub(), hp: 'http://spam' }); ok(r.ok && e.sheets['Submissions'].length === 1 && e.mails.length === 0, 'honeypot is silently dropped'); })();

(() => { const e = createEnv(); e.setup();
  e.post(sub({ name: '=HYPERLINK("http://x","hi")', story: '@SUM(1)' }));
  const row = e.sheets['Submissions'][1]; ok(row[4].startsWith("'="), 'formula in name defused'); ok(row[15].startsWith("'@"), 'formula in story defused');
  e.post(sub({ story: 'x'.repeat(9000), name: 'N\u0000ame' }));
  const r2 = e.sheets['Submissions'][2]; ok(r2[15].length === 4000, 'story capped at 4000'); ok(r2[4] === 'Name', 'control characters removed'); })();

(() => { const e = createEnv(); e.setup(); let last;
  for (let i = 0; i < 7; i++) last = e.post(sub());
  ok(last.error === 'rate_limited', 'per-contact limit after 5 posts');
  ok(e.sheets['Submissions'].length === 6, 'only 5 stored'); })();

(() => { const e = createEnv({ mailFails: true }); e.setup();
  const r = e.post(sub()); ok(r.ok && e.sheets['Submissions'].length === 2, 'mail failure does not lose the submission');
  ok(e.logs.some((l) => /notify failed/.test(l)), 'mail failure is logged'); })();

(() => { const e = createEnv({ notify: '' }); e.setup(); delete e.props.NOTIFY_EMAIL;
  const r = e.post(sub()); ok(r.ok && e.mails.length === 0, 'no email configured is fine'); })();

console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
