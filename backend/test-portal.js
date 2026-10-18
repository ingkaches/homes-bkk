// Run with:  node test-portal.js   (no dependencies)
const { createEnv } = require('./mocks');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(40, 1)]).toString('base64');

function fresh() {
  const e = createEnv(); e.setup();
  const call = (who, action, extra = {}) => e.post({ ...extra, action, who: who && who.email, token: who && who.token });
  const code = (email) => { const m = e.mails.filter((x) => x.to === email && /sign-in code/.test(x.subject)).pop(); return m && /code: (\d{6})/.exec(m.subject)[1]; };
  const login = (email) => { e.post({ action: 'login_request', email }); const r = e.post({ action: 'login_verify', email, code: code(email) }); return r.ok ? { email, token: r.token, user: r.user } : null; };
  return { e, call, login, code };
}
const good = (o = {}) => ({ title: 'Quiet 2-bed near BTS', project: 'Test Residence', area: 'sukhumvit', type: 'Condo', intents: ['rent'], price_rent: 45000, size: 62, beds: 2, baths: 2, lat: 13.7367, lng: 100.5601, ...o });
async function mkListing(call, who, extra = {}, photos = 3) {
  const s = call(who, 'save_listing', { listing: good(extra) });
  for (let i = 0; i < photos; i++) call(who, 'upload_photo', { id: s.listing.id, data: JPG });
  return s.listing.id;
}

// ---- setup + first admin
(() => { const { e } = fresh();
  ok(e.sheets.Users[0].includes('role') && e.sheets.Listings[0].includes('data'), 'setup creates Users and Listings');
  ok(e.sheets.Users[1][0] === 'owner@example.com' && e.sheets.Users[1][2] === 'admin', 'effective user is the first admin');
  ok(e.props.TOKEN_SECRET && e.props.TOKEN_SECRET.length > 40 && e.props.PHOTO_FOLDER_ID, 'secret and photo folder created');
  ok(e.triggers.length === 1, 'daily trigger created');
  e.setup(); ok(e.sheets.Users.length === 2 && e.triggers.length === 1, 'setup is idempotent'); })();

// ---- login
(() => { const { e, call, login, code } = fresh();
  let r = e.post({ action: 'login_request', email: 'stranger@example.com' });
  ok(r.ok === true && !e.mails.length, 'unknown email: same answer, no mail');
  r = e.post({ action: 'login_request', email: 'nope' }); ok(!r.ok && r.error === 'validation', 'bad email shape');
  e.post({ action: 'login_request', email: 'owner@example.com' });
  ok(e.mails.length === 1 && /sign-in code: \d{6}/.test(e.mails[0].subject), 'code mailed');
  const c = code('owner@example.com');
  ok(!e.post({ action: 'login_verify', email: 'owner@example.com', code: c === '000000' ? '000001' : '000000' }).ok, 'wrong code rejected');
  const v = e.post({ action: 'login_verify', email: 'owner@example.com', code: c });
  ok(v.ok && v.token && v.user.role === 'admin', 'right code logs in');
  ok(!e.post({ action: 'login_verify', email: 'owner@example.com', code: c }).ok, 'a code works once');
  ok(call({ email: 'owner@example.com', token: v.token }, 'me').user.email === 'owner@example.com', 'token works');
  ok(call({ email: 'owner@example.com', token: v.token + 'x' }, 'me').error === 'unauthorized', 'tampered token fails');
  ok(call({ email: 'other@example.com', token: v.token }, 'me').error === 'unauthorized', 'token is bound to the email');
  ok(call(null, 'me').error === 'unauthorized', 'no token fails');
  const old = (Date.now() - 1000).toString(36) + '.' + v.token.split('.')[1];
  ok(call({ email: 'owner@example.com', token: old }, 'me').error === 'unauthorized', 'expired / forged expiry fails'); })();

(() => { const { e, code } = fresh(); const em = 'owner@example.com';
  e.post({ action: 'login_request', email: em }); const c = code(em); const bad = c === '123456' ? '654321' : '123456';
  for (let i = 0; i < 5; i++) e.post({ action: 'login_verify', email: em, code: bad });
  ok(!e.post({ action: 'login_verify', email: em, code: c }).ok, 'code locked after 5 wrong tries');
  let last; for (let i = 0; i < 7; i++) last = e.post({ action: 'login_request', email: em });
  ok(last.error === 'rate_limited', 'code requests are rate limited'); })();

// ---- invite and roles
(() => { const { e, call, login, code } = fresh();
  const admin = login('owner@example.com');
  ok(call(admin, 'user_invite', { email: 'agent@example.com', name: 'Ann', role: 'agent' }).ok, 'admin invites');
  ok(e.mails.some((m) => m.to === 'agent@example.com' && /invited/.test(m.subject)), 'invite mailed');
  ok(call(admin, 'user_invite', { email: 'agent@example.com', role: 'agent' }).error === 'exists', 'duplicate invite refused');
  ok(call(admin, 'user_invite', { email: 'x@example.com', role: 'king' }).error === 'validation', 'bad role refused');
  const agent = login('agent@example.com');
  ok(agent && agent.user.role === 'agent' && agent.user.trusted === false, 'invited agent logs in, not trusted');
  ok(call(agent, 'users').error === 'forbidden' && call(agent, 'user_invite', { email: 'z@example.com' }).error === 'forbidden' && call(agent, 'review_queue').error === 'forbidden', 'agent cannot use admin actions');
  ok(call(admin, 'user_update', { email: 'owner@example.com', role: 'agent' }).error === 'last_admin', 'cannot demote the last admin');
  ok(call(admin, 'user_update', { email: 'owner@example.com', status: 'disabled' }).error === 'last_admin', 'cannot disable the last admin');
  ok(call(admin, 'user_update', { email: 'agent@example.com', trusted: true }).user.trusted === true, 'trust flag set');
  ok(call(agent, 'me').user.trusted === true, 'new rights apply on the very next request');
  ok(call(admin, 'user_update', { email: 'agent@example.com', status: 'disabled' }).ok, 'disable user');
  ok(call(agent, 'me').error === 'unauthorized', 'disabled user is locked out at once, token or not');
  e.mails.length = 0; e.post({ action: 'login_request', email: 'agent@example.com' }); ok(!code('agent@example.com'), 'disabled user gets no code');
  ok(call(admin, 'users').users.length === 2, 'users list'); })();

// ---- listing lifecycle
(() => { const { e, call, login } = fresh();
  const admin = login('owner@example.com');
  call(admin, 'user_invite', { email: 'a@example.com', name: 'Ann', role: 'agent' });
  call(admin, 'user_invite', { email: 'b@example.com', name: 'Bob', role: 'partner' });
  const a = login('a@example.com'), b = login('b@example.com');
  let s = call(a, 'save_listing', { listing: { title: 'Draft', project: 'X' } });
  ok(s.ok && s.listing.status === 'draft' && s.listing.owner_email === 'a@example.com', 'draft created');
  const id = s.listing.id;
  ok(call(a, 'submit_listing', { id }).error === 'not_ready', 'incomplete listing cannot be submitted');
  ok(call(b, 'get_listing', { id }).error === 'forbidden', 'other agent cannot read it');
  ok(call(b, 'save_listing', { listing: { id, title: 'hack' } }).error === 'forbidden', 'other agent cannot edit it');
  ok(call(b, 'upload_photo', { id, data: JPG }).error === 'forbidden', 'other agent cannot upload');
  ok(call(admin, 'get_listing', { id }).ok, 'admin can read any');
  ok(call(a, 'save_listing', { listing: { id, ...good(), area: 'moon' } }).error === 'validation', 'bad area refused');
  ok(call(a, 'save_listing', { listing: { id, lat: 51.5, lng: -0.1 } }).fields.lat === 'outside_bangkok', 'pin outside Bangkok refused');
  ok(call(a, 'save_listing', { listing: { id, price_rent: -5 } }).fields.price_rent === 'invalid', 'negative price refused');
  ok(call(a, 'save_listing', { listing: { id, ...good() } }).ok, 'full details saved');
  ok(call(a, 'submit_listing', { id }).fields.photos === 'min_3', 'needs 3 photos');
  ok(call(a, 'upload_photo', { id, data: Buffer.from('not an image at all, plain text').toString('base64') }).error === 'bad_image', 'non-image refused');
  ok(call(a, 'upload_photo', { id, data: '!!!' }).error === 'bad_image', 'garbage base64 refused');
  const ph = [1, 2, 3].map(() => call(a, 'upload_photo', { id, data: JPG }));
  ok(ph.every((p) => p.ok) && ph[2].photos.length === 3, 'three photos uploaded');
  ok(Object.values(e.drive.files).every((f) => f.shared === 'link:view'), 'photos are link-shared (view only)');
  ok(call(a, 'upload_photo', { id, data: Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(3 * 1024 * 1024)]).toString('base64') }).error === 'too_large', 'oversize refused');
  s = call(a, 'submit_listing', { id });
  ok(s.ok && s.status === 'pending', 'submit goes to pending for a normal agent');
  ok(e.mails.some((m) => m.to === 'owner@example.com' && /to review/.test(m.subject)), 'admin emailed');
  ok(e.get({ action: 'listings' }).listings.length === 0, 'pending is not public');
  ok(call(a, 'review_queue').error === 'forbidden' && call(admin, 'review_queue').listings.length === 1, 'queue is admin only');
  ok(call(admin, 'reject_listing', { id }).error === 'validation', 'rejection needs a reason');
  ok(call(admin, 'reject_listing', { id, reason: 'Photos are blurry' }).listing.status === 'rejected', 'reject');
  ok(e.mails.some((m) => m.to === 'a@example.com' && /Photos are blurry/.test(m.body)), 'owner told why');
  ok(call(a, 'get_listing', { id }).listing.reject_reason === 'Photos are blurry', 'owner sees the reason');
  ok(call(a, 'save_listing', { listing: { id, title: 'Quiet 2-bed, new photos' } }).listing.status === 'draft', 'editing a rejected listing makes it a draft again');
  ok(call(a, 'submit_listing', { id }).status === 'pending', 'resubmit');
  ok(call(a, 'approve_listing', { id }).error === 'forbidden', 'owner cannot approve');
  ok(call(admin, 'approve_listing', { id }).listing.status === 'published', 'admin approves');
  let pub = e.get({ action: 'listings' }).listings;
  ok(pub.length === 1 && pub[0].id === id && pub[0].photos.length === 3 && pub[0].by === 'Ann', 'now public, with the owner name');
  // privacy: nothing private is in the public payload
  const raw = JSON.stringify(e.get({ action: 'listings' })) + JSON.stringify(e.get({ action: 'listing', id }));
  ok(!/a@example\.com|owner@example\.com/.test(raw), 'no email in public data');
  ok(!/address_private|reject_reason|owner_email|13\.7367|100\.5601/.test(raw), 'no private field or exact coordinate in public data');
  ok(pub[0].lat !== 13.7367 && Math.abs(pub[0].lat - 13.7367) < 0.003 && Math.abs(pub[0].lng - 100.5601) < 0.003, 'public pin is moved, but only slightly');
  ok(e.get({ action: 'listings' }).listings[0].lat === pub[0].lat, 'the offset is stable between reads');
  // the same offset survives the cache being cold
  Object.keys(e.cache).forEach((k) => delete e.cache[k]);
  ok(e.get({ action: 'listings' }).listings[0].lat === pub[0].lat, 'offset is stable without cache');
  ok(e.get({ action: 'listing', id }).listing.id === id && e.get({ action: 'listing', id: 'nope' }).error === 'not_found', 'single listing read');
  // exact coords stay available to the owner
  ok(call(a, 'get_listing', { id }).listing.data.lat === 13.7367, 'owner still sees exact pin');
  // a normal agent: price tweak keeps it live, other edits send it back
  ok(call(a, 'save_listing', { listing: { id, price_rent: 47000 } }).listing.status === 'published', 'price change keeps it live');
  ok(e.get({ action: 'listings' }).listings[0].price_rent === 47000, 'and the public cache is refreshed');
  ok(call(a, 'save_listing', { listing: { id, story: 'New story text' } }).listing.status === 'pending', 'other edits return it to review');
  ok(e.get({ action: 'listings' }).listings.length === 0, 'and it leaves the public site meanwhile');
  call(admin, 'approve_listing', { id });
  // photos
  const pid = ph[0].photo_id;
  ok(call(a, 'remove_photo', { id, photo_id: 'FILEnotmine' }).error === 'not_found', 'cannot remove a photo that is not in the listing');
  const rp = call(a, 'remove_photo', { id, photo_id: pid });
  ok(rp.ok && rp.photos.length === 2 && e.drive.files[pid].trashed === true, 'photo removed and trashed');
  ok(rp.status === 'pending', 'removing a photo from a live listing sends it to review');
  const reorder = call(a, 'save_listing', { listing: { id, photos: ['FILEfake', ...rp.photos.slice().reverse()] } });
  ok(reorder.listing.data.photos.join() === rp.photos.slice().reverse().join(), 'reorder ignores unknown ids and never adds');
  // owner change, archive, restore
  ok(call(admin, 'set_owner', { id, email: 'b@example.com' }).listing.owner_email === 'b@example.com', 'admin reassigns owner');
  ok(call(a, 'get_listing', { id }).error === 'forbidden', 'old owner loses access');
  call(admin, 'approve_listing', { id });
  ok(call(b, 'archive_listing', { id }).listing.status === 'archived' && e.get({ action: 'listings' }).listings.length === 0, 'archive removes it from the site');
  ok(call(b, 'save_listing', { listing: { id, title: 'x' } }).error === 'archived', 'archived listings are read-only');
  ok(call(b, 'restore_listing', { id }).listing.status === 'draft', 'restore gives a draft'); })();

// ---- trusted users publish directly; admin too
(() => { const { e, call, login } = fresh();
  const admin = login('owner@example.com');
  call(admin, 'user_invite', { email: 't@example.com', name: 'Tee', role: 'partner', trusted: true });
  const t = login('t@example.com');
  const id = call(t, 'save_listing', { listing: good({ intents: ['buy'], price_sale: 9890000 }) }).listing.id;
  for (let i = 0; i < 3; i++) call(t, 'upload_photo', { id, data: JPG });
  const s = call(t, 'submit_listing', { id });
  ok(s.status === 'published' && e.get({ action: 'listings' }).listings.length === 1, 'trusted partner publishes at once');
  ok(call(t, 'save_listing', { listing: { id, story: 'edited' } }).listing.status === 'published', 'and edits stay live');
  ok(!e.mails.some((m) => /to review/.test(m.subject)), 'no review mail needed');
  const a2 = call(admin, 'save_listing', { listing: good({ title: 'Admin one' }) }).listing.id;
  ok(call(admin, 'submit_listing', { id: a2 }).error === 'not_ready', 'admin also needs the basics (photos)'); })();

// ---- viewing requests reach the owner
(() => { const { e, call, login } = fresh();
  const admin = login('owner@example.com');
  call(admin, 'user_invite', { email: 't@example.com', name: 'Tee', role: 'partner', trusted: true });
  const t = login('t@example.com'); const id = call(t, 'save_listing', { listing: good() }).listing.id;
  for (let i = 0; i < 3; i++) call(t, 'upload_photo', { id, data: JPG }); call(t, 'submit_listing', { id });
  e.mails.length = 0;
  const r = e.post({ kind: 'viewing', lang: 'en', page: 'book-viewing.html', data: { homeId: id, home: 'Quiet 2-bed', date: 'Thu 22 Oct', time: '13:00', format: 'Meet at the building', name: 'Anna', phone: 'TEST-PHONE', consent: true } });
  ok(r.ok, 'viewing accepted');
  ok(e.mails.some((m) => m.to === 't@example.com' && /Anna/.test(m.body) && /TEST-PHONE/.test(m.body)), 'owner gets the viewing request');
  ok(e.mails.some((m) => m.to === 'owner@example.com'), 'and the admin address still gets it');
  e.mails.length = 0; e.post({ kind: 'viewing', lang: 'en', page: 'x', data: { homeId: 'tristan', home: 'Tristan', date: 'a', time: 'b', format: 'c', name: 'n', phone: '1', consent: true } });
  ok(e.mails.length === 1, 'static homes: only the admin address'); })();

// ---- staleness
(() => { const { e, call, login } = fresh();
  const admin = login('owner@example.com');
  call(admin, 'user_invite', { email: 't@example.com', name: 'Tee', role: 'agent', trusted: true });
  const t = login('t@example.com'); const id = call(t, 'save_listing', { listing: good() }).listing.id;
  for (let i = 0; i < 3; i++) call(t, 'upload_photo', { id, data: JPG }); call(t, 'submit_listing', { id });
  const fmt = (days) => { const d = new Date(Date.now() - days * 86400000 + 7 * 3600000); return d.toISOString().slice(0, 19).replace('T', ' '); };
  const row = e.sheets.Listings.find((r) => r[0] === id), ci = e.sheets.Listings[0].indexOf('confirmed_at');
  row[ci] = fmt(31); e.mails.length = 0; e.daily();
  ok(e.mails.some((m) => m.to === 't@example.com' && /Still available/.test(m.subject)), 'reminder after 30 days');
  e.mails.length = 0; e.daily(); ok(e.mails.length === 0, 'reminder is not repeated daily');
  ok(e.get({ action: 'listings' }).listings.length === 1, 'still public after reminder');
  ok(call(t, 'confirm_listing', { id }).ok, 'owner confirms'); e.mails.length = 0; e.daily(); ok(e.mails.length === 0, 'confirmed: quiet');
  row[ci] = fmt(61); e.daily();
  ok(call(t, 'get_listing', { id }).listing.status === 'archived' && e.get({ action: 'listings' }).listings.length === 0, 'archived after 60 days and removed from the site'); })();

// ---- cache chunking with a big catalogue, hostile input, sheet safety
(() => { const { e, call, login } = fresh();
  const admin = login('owner@example.com');
  const story = 'บ้านสวยมาก '.repeat(240);
  for (let i = 0; i < 24; i++) {
    const id = call(admin, 'save_listing', { listing: good({ title: 'Home ' + i, story, story_th: story }) }).listing.id;
    for (let k = 0; k < 3; k++) call(admin, 'upload_photo', { id, data: JPG }); call(admin, 'submit_listing', { id });
  }
  const l = e.get({ action: 'listings' }).listings;
  ok(l.length === 24, 'big catalogue served (chunked cache, no value over 100 KB)');
  ok(Number(e.cache['pub:n']) > 1, 'it really needed several chunks');
  const id2 = call(admin, 'save_listing', { listing: { title: '=HYPERLINK("http://evil","x")', project: '@SUM(1)', story: '<script>alert(1)</script>' } }).listing.id;
  const row = e.sheets.Listings.find((r) => r[0] === id2); const h = e.sheets.Listings[0];
  ok(row[h.indexOf('title')].startsWith("'="), 'formula in title is defused in the sheet');
  ok(row[h.indexOf('project')].startsWith("'@"), 'formula in project is defused in the sheet');
  ok(JSON.parse(row[h.indexOf('data')]).story === '<script>alert(1)</script>', 'html is stored as plain text; the pages escape on output');
  ok(e.post({ action: 'bogus', who: 'a@b.co', token: 'x' }).error === 'unknown_action', 'unknown action');
  ok(e.post({ action: 'save_listing' }).error === 'unauthorized', 'unauthenticated write refused'); })();

console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
