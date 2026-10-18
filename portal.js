/* HOMES/BKK portal: sign in, post and manage listings, review, team. Talks to Portal.gs (live) or the in-browser copy (demo). */
(function () {
  'use strict';
  const C = window.HB_CONFIG || {}, HB = window.HB;
  const LIVE = !!(C.endpoint && /^https:\/\//.test(C.endpoint));
  const esc = HB.esc, app = document.getElementById('app');
  const t = (en, th) => HB.th ? th : en;
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  /* ---------- session + API ---------- */
  const SKEY = 'hb-session';
  const session = {
    get() { try { return JSON.parse(localStorage.getItem(SKEY)); } catch (e) { return null; } },
    set(s) { try { localStorage.setItem(SKEY, JSON.stringify(s)); } catch (e) { /* ignore */ } },
    clear() { try { localStorage.removeItem(SKEY); } catch (e) { /* ignore */ } }
  };
  const demo = LIVE ? null : window.HB_DEMO.create();
  async function api(action, body) {
    const s = session.get(), payload = Object.assign({}, body || {}, { action });
    if (s) { payload.who = s.email; payload.token = s.token; }
    let res;
    if (demo) { await sleep(90); res = demo.post(payload); }
    else {
      try {
        const r = await fetch(C.endpoint, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(payload) });
        res = await r.json();
      } catch (e) { return { ok: false, error: 'network' }; }
    }
    if (res && res.error === 'unauthorized' && s) { session.clear(); S.user = null; route(); toast(t('Your session ended. Please sign in again.', 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง'), true); }
    return res;
  }
  const ERR = {
    network: ['Cannot reach the server. Check your connection and try again.', 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่'],
    rate_limited: ['Too many tries. Please wait a little and try again.', 'ลองบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่'],
    forbidden: ['You do not have permission to do that.', 'คุณไม่มีสิทธิ์ทำรายการนี้'],
    not_found: ['That item no longer exists.', 'ไม่พบรายการนี้แล้ว'],
    archived: ['This listing is archived. Restore it first.', 'ประกาศนี้ถูกเก็บเข้าคลังแล้ว กรุณากู้คืนก่อน'],
    validation: ['Some fields need a look.', 'มีบางช่องที่ต้องตรวจสอบ'],
    not_ready: ['The listing is not complete yet.', 'ประกาศยังไม่ครบถ้วน'],
    bad_image: ['That file is not a JPG, PNG or WebP image.', 'ไฟล์นี้ไม่ใช่รูป JPG, PNG หรือ WebP'],
    too_large: ['That photo is too large.', 'รูปนี้ใหญ่เกินไป'],
    too_many_photos: ['A listing can have at most 30 photos.', 'หนึ่งประกาศใส่รูปได้สูงสุด 30 รูป'],
    last_admin: ['There must always be at least one active admin.', 'ต้องมีแอดมินที่ใช้งานอยู่อย่างน้อยหนึ่งคน'],
    exists: ['That email is already in the team.', 'อีเมลนี้อยู่ในทีมแล้ว'],
    limit: ['You have reached the limit of listings.', 'จำนวนประกาศถึงขีดจำกัดแล้ว'],
    server: ['Something went wrong on our side. Try again in a moment.', 'เกิดข้อผิดพลาดฝั่งเรา ลองใหม่อีกครั้งในอีกสักครู่']
  };
  const errText = r => { const e = ERR[r && r.error] || ERR.server; return t(e[0], e[1]); };

  function toast(msg, bad) {
    const el = $('#toast'); el.textContent = msg; el.className = 'toast' + (bad ? ' err' : ''); el.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; }, 4200);
  }

  /* ---------- state + vocab ---------- */
  const S = { user: null, mine: null, queue: null, all: null, users: null, allFilter: '' };
  const STATUS = { draft: ['Draft', 'ฉบับร่าง'], pending: ['In review', 'รอตรวจสอบ'], published: ['Live', 'ขึ้นเว็บแล้ว'], rejected: ['Needs changes', 'ต้องแก้ไข'], archived: ['Archived', 'เก็บเข้าคลัง'] };
  const ROLE = { admin: ['Admin', 'แอดมิน'], partner: ['Partner', 'พาร์ทเนอร์'], agent: ['Agent', 'เอเจนต์'] };
  const TYPES = { Condo: 'คอนโด', House: 'บ้านเดี่ยว', Townhome: 'ทาวน์โฮม', Duplex: 'ดูเพล็กซ์', Penthouse: 'เพนต์เฮาส์', Villa: 'วิลล่า', Other: 'อื่นๆ' };
  const FURN = [['', 'Not specified', 'ไม่ระบุ'], ['fully', 'Fully furnished', 'เฟอร์นิเจอร์ครบ'], ['partly', 'Partly furnished', 'เฟอร์นิเจอร์บางส่วน'], ['none', 'Unfurnished', 'ไม่มีเฟอร์นิเจอร์']];
  const areas = () => Object.assign({}, HB.AREAS, HB.extraAreas);
  const areaLabel = k => (HB.th && HB.extraAreasTh[k]) || areas()[k] || '';
  const stLabel = s => t(STATUS[s][0], STATUS[s][1]);
  const num = n => Number(n).toLocaleString('en-US');
  const money = d => { const a = []; if (d.price_sale) a.push('฿' + (d.price_sale >= 1e6 ? +(d.price_sale / 1e6).toFixed(2) + 'M' : num(d.price_sale)) + t(' sale', ' ขาย')); if (d.price_rent) a.push('฿' + num(d.price_rent) + t(' / month', ' / เดือน')); return a.join('  ·  '); };
  const BKK = { latMin: 13.3, latMax: 14.3, lngMin: 100.2, lngMax: 101.1 };

  /* readiness: the same rules as the server (readyErrors_), so the checklist never disagrees with a real submit */
  function readiness(d) {
    const has = v => v !== null && v !== undefined && v !== '';
    const buy = (d.intents || []).includes('buy'), rent = (d.intents || []).includes('rent');
    return [
      ['title', t('A title', 'ชื่อประกาศ'), !!d.title],
      ['project', t('Project or building name', 'ชื่อโครงการ/อาคาร'), !!d.project],
      ['area', t('Area', 'พื้นที่'), !!d.area],
      ['type', t('Type of home', 'ประเภทที่พัก'), !!d.type],
      ['intents', t('Rent, buy or both', 'เช่า ขาย หรือทั้งสองอย่าง'), (d.intents || []).length > 0],
      ['price', t('Price for what you chose', 'ราคาตามที่เลือก'), (d.intents || []).length > 0 && (!buy || has(d.price_sale)) && (!rent || has(d.price_rent))],
      ['size', t('Size in sqm', 'ขนาด (ตร.ม.)'), has(d.size)],
      ['photos', t('At least 3 photos', 'รูปอย่างน้อย 3 รูป'), (d.photos || []).length >= 3],
      ['lat', t('Pin on the map', 'ปักหมุดบนแผนที่'), typeof d.lat === 'number' && typeof d.lng === 'number']
    ];
  }

  /* ---------- routing ---------- */
  let pickMap = null;
  function route() {
    if (pickMap) { pickMap.remove(); pickMap = null; }
    const h = location.hash.replace(/^#/, '');
    renderWho();
    if (!S.user) return renderLogin();
    const [view, arg] = h.split('/');
    if (view === 'new') return renderEditor(null);
    if (view === 'edit' && arg) return openEditor(arg);
    if (view === 'queue' && S.user.role === 'admin') return viewQueue();
    if (view === 'all' && S.user.role === 'admin') return viewAll();
    if (view === 'team' && S.user.role === 'admin') return viewTeam();
    if (view === 'profile') return viewProfile();
    return viewMine();
  }
  window.addEventListener('hashchange', route);
  function go(h) { if (location.hash === '#' + h) route(); else location.hash = h; }

  function renderWho() {
    const el = $('#who');
    el.innerHTML = S.user ? `<b>${esc(S.user.name)}</b><span class="role ${esc(S.user.role)}">${esc(t(ROLE[S.user.role][0], ROLE[S.user.role][1]))}</span><button class="b ghost sm" type="button" data-act="signout">${t('Sign out', 'ออกจากระบบ')}</button>` : '';
    HB.translate(el);
  }

  /* ---------- sign in ---------- */
  function demoInboxCode(email) {
    const m = demo && demo.mails().find(x => x.to === email && /sign-in code/.test(x.subject));
    const c = m && /(\d{6})/.exec(m.subject);
    return c ? c[1] : '';
  }
  function renderLogin(step, email, msg) {
    step = step || 'email'; email = email || '';
    const quick = demo ? `<div class="quick">${['admin', 'agent', 'partner'].map(r => `<button class="b ghost sm" type="button" data-act="quick" data-email="${r}@homes-bkk.test">${t('Try as', 'ลองในฐานะ')} ${esc(t(ROLE[r][0], ROLE[r][1]))}</button>`).join('')}</div>` : '';
    app.innerHTML = `<div class="login">
      <div class="eyebrow">${t('For agents, partners and the team', 'สำหรับเอเจนต์ พาร์ทเนอร์ และทีมงาน')}</div>
      <h1>${t('Post and manage homes.', 'ลงและจัดการประกาศบ้าน')}</h1>
      <p class="text" style="margin:0 0 22px">${t('No password. We email you a 6-digit code each time you sign in. Access is by invitation.', 'ไม่มีรหัสผ่าน เราส่งรหัส 6 หลักไปทางอีเมลทุกครั้งที่เข้าสู่ระบบ ใช้ได้เฉพาะผู้ที่ได้รับเชิญ')}</p>
      ${msg ? `<div class="note ${msg.bad ? 'err' : 'ok'}">${esc(msg.text)}</div>` : ''}
      ${step === 'email' ? `${quick}<form id="fEmail" novalidate>
        <label class="fld"><span>${t('Email', 'อีเมล')}</span><input type="email" id="lgEmail" autocomplete="email" inputmode="email" required value="${esc(email)}"></label>
        <button class="b" type="submit">${t('Send me a code', 'ส่งรหัสให้ฉัน')}</button></form>`
      : `${demo ? `<div class="demo-code">${t('Demo: the code that would be emailed to', 'เดโม: รหัสที่จะถูกส่งทางอีเมลถึง')} ${esc(email)} <b>${esc(demoInboxCode(email) || '—')}</b><button class="b sand sm" type="button" data-act="fillcode">${t('Fill it in', 'ใส่ให้เลย')}</button></div>` : ''}
        <form id="fCode" novalidate><input type="hidden" id="lgEmail" value="${esc(email)}">
        <label class="fld"><span>${t('6-digit code sent to', 'รหัส 6 หลักที่ส่งไปที่')} ${esc(email)}</span><input type="text" id="lgCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]*" required></label>
        <div class="row-actions"><button class="b" type="submit">${t('Sign in', 'เข้าสู่ระบบ')}</button><button class="b ghost" type="button" data-act="back">${t('Use another email', 'ใช้อีเมลอื่น')}</button></div></form>`}
    </div>`;
    HB.translate(app);
    const f = $('#lgEmail') && $('#lgEmail').type !== 'hidden' ? $('#lgEmail') : $('#lgCode'); if (f) f.focus();
  }
  async function sendCode(email) {
    const b = $('#fEmail button'); b.disabled = true;
    const r = await api('login_request', { email });
    if (!r.ok) { b.disabled = false; return renderLogin('email', email, { bad: true, text: r.error === 'validation' ? t('That does not look like an email address.', 'อีเมลไม่ถูกต้อง') : errText(r) }); }
    renderLogin('code', email, { text: t('If that email is on the team, a code is on its way. It works for 10 minutes.', 'หากอีเมลนี้อยู่ในทีม รหัสกำลังถูกส่งไป ใช้ได้ 10 นาที') });
  }
  async function verify(email, code) {
    const b = $('#fCode button[type=submit]'); b.disabled = true;
    const r = await api('login_verify', { email, code });
    if (!r.ok) { b.disabled = false; $('#lgCode').value = ''; return renderLogin('code', email, { bad: true, text: r.error === 'invalid_code' ? t('That code is wrong or expired.', 'รหัสไม่ถูกต้องหรือหมดอายุ') : errText(r) }); }
    session.set({ email, token: r.token, expires: r.expires });
    S.user = r.user; S.mine = S.queue = S.all = S.users = null;
    location.hash = ''; route();
  }

  /* ---------- layout ---------- */
  function shell(active, title, extra, body) {
    const admin = S.user.role === 'admin';
    const tabs = [['mine', t('My listings', 'ประกาศของฉัน'), 0]];
    if (admin) tabs.push(['queue', t('Review', 'รอตรวจสอบ'), (S.queue || []).length], ['all', t('All listings', 'ประกาศทั้งหมด'), 0], ['team', t('Team', 'ทีม'), 0]);
    tabs.push(['profile', t('Profile', 'โปรไฟล์'), 0]);
    app.innerHTML = `<div class="p-title"><div><div class="eyebrow">${esc(S.user.name)}</div><h1>${title}</h1></div><div class="row-actions">${extra || ''}</div></div>
      <nav class="p-tabs" aria-label="${t('Portal', 'พอร์ทัล')}">${tabs.map(x => `<a href="#${x[0] === 'mine' ? '' : x[0]}"${x[0] === active ? ' aria-current="page"' : ''}>${x[1]}${x[2] ? `<span class="n">${x[2]}</span>` : ''}</a>`).join('')}</nav>
      <div id="view">${body}</div>`;
    HB.translate(app);
  }
  const thumb = L => {
    const id = (L.data.photos || [])[0];
    return id ? `<img class="th" alt="" src="${esc(HB.photo(id, 400))}">` : `<div class="th empty">${t('No photo', 'ไม่มีรูป')}</div>`;
  };
  function listRow(L, opts) {
    const d = L.data, age = HB.agoDays ? 0 : 0;
    const stale = L.status === 'published' && daysAgo(L.confirmed_at) >= 25;
    const act = [];
    act.push(`<a class="b ghost sm" href="#edit/${esc(L.id)}">${t('Edit', 'แก้ไข')}</a>`);
    if (L.status === 'published') act.push(`<a class="b ghost sm" href="listing.html?id=${encodeURIComponent(L.id)}" target="_blank" rel="noopener">${t('View on site', 'ดูบนเว็บ')}</a>`);
    if (L.status === 'published') act.push(`<button class="b ${stale ? 'sand' : 'ghost'} sm" type="button" data-act="confirm" data-id="${esc(L.id)}">${t('Still available', 'ยังว่างอยู่')}</button>`);
    if (L.status === 'archived') act.push(`<button class="b ghost sm" type="button" data-act="restore" data-id="${esc(L.id)}">${t('Restore', 'กู้คืน')}</button>`);
    else act.push(`<button class="b ghost sm" type="button" data-act="archive" data-id="${esc(L.id)}">${t('Archive', 'เก็บเข้าคลัง')}</button>`);
    if (opts && opts.owner) act.push(`<select class="in" style="width:auto;padding:6px" data-act="owner" data-id="${esc(L.id)}" aria-label="${t('Owner', 'เจ้าของ')}">${(S.users || []).filter(u => u.status === 'active').map(u => `<option value="${esc(u.email)}"${u.email === L.owner_email ? ' selected' : ''}>${esc(u.name)}</option>`).join('')}</select>`);
    return `<div class="lrow">${thumb(L)}<div><h3>${esc(d.title || d.project || t('Untitled', 'ไม่มีชื่อ'))}</h3>
      <div class="sub"><span class="pill ${esc(L.status)}">${esc(stLabel(L.status))}</span>${esc(d.project || '')}${d.area ? ' · ' + esc(areaLabel(d.area)) : ''}${money(d) ? ' · ' + esc(money(d)) : ''}</div>
      <div class="sub">${opts && opts.owner ? esc(L.owner_name) + ' · ' : ''}${t('Updated', 'อัปเดต')} ${esc(HB.ago(L.updated_at))}${L.status === 'published' ? ` · ${t('confirmed', 'ยืนยันเมื่อ')} ${esc(HB.ago(L.confirmed_at))}` : ''}${stale ? ` <span class="stale">· ${t('please confirm it is still available', 'กรุณายืนยันว่ายังว่างอยู่')}</span>` : ''}</div>
      ${L.status === 'rejected' && L.reject_reason ? `<div class="reason"><b>${t('Why it was sent back:', 'เหตุผลที่ส่งกลับ:')}</b> ${esc(L.reject_reason)}</div>` : ''}
      ${L.status === 'pending' ? `<div class="sub">${t('The team is checking this. You will get an email.', 'ทีมกำลังตรวจสอบ คุณจะได้รับอีเมล')}</div>` : ''}</div>
      <div class="row-actions">${act.join('')}</div></div>`;
  }
  function daysAgo(ts) {
    const m = /^(\d{4})-(\d\d)-(\d\d) (\d\d):(\d\d):(\d\d)$/.exec(String(ts || ''));
    return m ? (Date.now() - Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] - 7, +m[5], +m[6])) / 86400000 : 0;
  }

  /* ---------- my listings ---------- */
  async function viewMine() {
    shell('mine', t('My listings', 'ประกาศของฉัน'), `<a class="b" href="#new">${t('+ New listing', '+ ลงประกาศใหม่')}</a>`, `<p class="p-loading">${t('Loading…', 'กำลังโหลด…')}</p>`);
    if (S.user.role === 'admin' && !S.queue) loadQueueCount();
    const r = await api('my_listings'); if (!r.ok) return fail(r);
    S.mine = r.listings;
    const live = r.listings.filter(l => l.status === 'published').length, pend = r.listings.filter(l => l.status === 'pending').length;
    $('#view').innerHTML = r.listings.length
      ? `<p class="sub" style="color:var(--fog);margin:0 0 14px">${live} ${t('live', 'ขึ้นเว็บ')} · ${pend} ${t('in review', 'รอตรวจสอบ')} · ${r.listings.length} ${t('total', 'ทั้งหมด')}</p>` + r.listings.map(l => listRow(l)).join('')
      : `<div class="empty-state"><h3>${t('No listings yet.', 'ยังไม่มีประกาศ')}</h3><p>${t('Start with the basics. You can save a draft and come back.', 'เริ่มจากข้อมูลพื้นฐาน บันทึกเป็นฉบับร่างแล้วกลับมาทำต่อได้')}</p><a class="b" href="#new">${t('+ New listing', '+ ลงประกาศใหม่')}</a></div>`;
    HB.translate($('#view'));
  }
  async function loadQueueCount() {
    const r = await api('review_queue'); if (r.ok) { S.queue = r.listings; const n = $('.p-tabs a[href="#queue"]'); if (n && r.listings.length && !n.querySelector('.n')) n.insertAdjacentHTML('beforeend', `<span class="n">${r.listings.length}</span>`); }
  }
  function fail(r) { $('#view').innerHTML = `<div class="note err">${esc(errText(r))}</div>`; }

  /* ---------- editor ---------- */
  let E = null;       // {id, status, data, reject_reason}
  async function openEditor(id) {
    shell('mine', t('Edit listing', 'แก้ไขประกาศ'), '', `<p class="p-loading">${t('Loading…', 'กำลังโหลด…')}</p>`);
    const r = await api('get_listing', { id });
    if (!r.ok) { go(''); return toast(errText(r), true); }
    renderEditor(r.listing);
  }
  function renderEditor(L) {
    E = L ? { id: L.id, status: L.status, data: L.data, reject_reason: L.reject_reason, owner_email: L.owner_email } : { id: '', status: 'draft', data: { photos: [], intents: ['rent'] }, reject_reason: '' };
    const d = E.data, trusted = S.user.role === 'admin' || S.user.trusted;
    const live = E.status === 'published';
    const sel = (name, opts, cur) => `<select id="f_${name}" name="${name}">${opts.map(o => `<option value="${esc(o[0])}"${String(cur || '') === String(o[0]) ? ' selected' : ''}>${esc(o[1])}</option>`).join('')}</select>`;
    const fld = (name, label, input, help) => `<label class="fld" data-f="${name}"><span>${label}</span>${input}<small class="help">${help || ''}</small><span class="msg" data-msg></span></label>`;
    const inp = (name, type, extra) => `<input id="f_${name}" name="${name}" type="${type}" value="${esc(d[name] === null || d[name] === undefined ? '' : d[name])}" ${extra || ''}>`;
    const typeOpts = [['', t('Choose…', 'เลือก…')]].concat(Object.keys(TYPES).map(k => [k, t(k, TYPES[k])]));
    const areaOpts = [['', t('Choose…', 'เลือก…')]].concat(Object.keys(areas()).map(k => [k, areaLabel(k)]));
    shell('mine', E.id ? t('Edit listing', 'แก้ไขประกาศ') : t('New listing', 'ลงประกาศใหม่'), '', `
    <form id="ed" class="ed" novalidate autocomplete="off">
      <div>
        ${E.status === 'rejected' && E.reject_reason ? `<div class="reason" style="margin:0 0 18px"><b>${t('Sent back by the team:', 'ทีมส่งกลับมา:')}</b> ${esc(E.reject_reason)}</div>` : ''}
        ${live && !trusted ? `<div class="note">${t('This listing is live. Changing the price keeps it live; any other change sends it back for a quick check and takes it off the site until approved.', 'ประกาศนี้ขึ้นเว็บอยู่ การแก้ราคายังขึ้นเว็บต่อได้ แต่การแก้ส่วนอื่นจะส่งกลับให้ทีมตรวจและถอดจากเว็บชั่วคราวจนกว่าจะอนุมัติ')}</div>` : ''}
        <section class="card"><h2>${t('The home', 'ตัวบ้าน')}</h2><p class="lead">${t('What a buyer or renter needs to decide whether to look closer.', 'ข้อมูลที่ผู้ซื้อ/ผู้เช่าต้องใช้ตัดสินใจว่าจะดูต่อไหม')}</p>
          ${fld('title', t('Title', 'ชื่อประกาศ'), inp('title', 'text', 'maxlength="120" placeholder="' + esc(t('A quiet two-bedroom beside the BTS', 'คอนโด 2 ห้องนอนเงียบสงบ ใกล้ BTS')) + '"'), t('One line, written for a person, not a keyword list.', 'หนึ่งบรรทัด เขียนให้คนอ่าน ไม่ใช่รวมคีย์เวิร์ด'))}
          ${fld('title_th', t('Title in Thai <i>(optional)</i>', 'ชื่อภาษาไทย <i>(ไม่บังคับ)</i>'), inp('title_th', 'text', 'maxlength="120"'))}
          <div class="grid2">${fld('project', t('Project or building', 'ชื่อโครงการ/อาคาร'), inp('project', 'text', 'maxlength="100"'))}
          ${fld('area', t('Area', 'พื้นที่'), sel('area', areaOpts, d.area))}</div>
          <div class="grid2">${fld('type', t('Type', 'ประเภท'), sel('type', typeOpts, d.type))}
          ${fld('furnished', t('Furnishing', 'เฟอร์นิเจอร์'), sel('furnished', FURN.map(o => [o[0], t(o[1], o[2])]), d.furnished))}</div>
          <div class="fld" data-f="intents"><span>${t('This home is for', 'ประกาศนี้สำหรับ')}</span><div class="checks chip-checks">
            <label><input type="checkbox" name="intent" value="rent"${(d.intents || []).includes('rent') ? ' checked' : ''}> ${t('Rent', 'เช่า')}</label>
            <label><input type="checkbox" name="intent" value="buy"${(d.intents || []).includes('buy') ? ' checked' : ''}> ${t('Sale', 'ขาย')}</label></div><span class="msg" data-msg></span></div>
          <div class="grid2">${fld('price_sale', t('Sale price (฿)', 'ราคาขาย (฿)'), inp('price_sale', 'text', 'inputmode="numeric" placeholder="9,890,000"'))}
          ${fld('price_rent', t('Rent per month (฿)', 'ค่าเช่าต่อเดือน (฿)'), inp('price_rent', 'text', 'inputmode="numeric" placeholder="45,000"'))}</div>
          <div class="grid4">${fld('beds', t('Bedrooms', 'ห้องนอน'), inp('beds', 'text', 'inputmode="numeric"'), t('0 = studio', '0 = สตูดิโอ'))}
          ${fld('baths', t('Bathrooms', 'ห้องน้ำ'), inp('baths', 'text', 'inputmode="numeric"'))}
          ${fld('size', t('Size (sqm)', 'ขนาด (ตร.ม.)'), inp('size', 'text', 'inputmode="decimal"'))}
          ${fld('floor', t('Floor', 'ชั้น'), inp('floor', 'text', 'maxlength="10"'))}</div>
          <div class="fld"><span>${t('Good to know', 'จุดเด่น')}</span><div class="checks chip-checks">
            <label><input type="checkbox" name="pets"${d.pets ? ' checked' : ''}> ${t('Pets welcome', 'เลี้ยงสัตว์ได้')}</label>
            ${Object.keys(HB.TAGS).filter(k => HB.TAGS[k].group !== 'life' || k !== 'pet-friendly').map(k => `<label><input type="checkbox" name="tag" value="${k}"${(d.tags || []).includes(k) ? ' checked' : ''}> ${esc(HB.TAGS[k].short)}</label>`).join('')}</div>
            <small class="help">${t('These put the home in the matching collections.', 'ตัวเลือกเหล่านี้ทำให้บ้านไปอยู่ในคอลเลกชันที่ตรงกัน')}</small></div>
        </section>

        <section class="card"><h2>${t('Photos', 'รูปภาพ')}</h2><p class="lead">${t('At least 3. The first is the cover. Use real photos of this home; you must have the right to use them.', 'อย่างน้อย 3 รูป รูปแรกคือภาพปก ใช้รูปจริงของบ้านหลังนี้ และต้องมีสิทธิ์ใช้รูปนั้น')}</p>
          <div class="drop" id="drop" tabindex="0" role="button">${t('<b>Choose photos</b> or drop them here', '<b>เลือกรูป</b> หรือลากมาวางที่นี่')}<br><small>${t('JPG, PNG or WebP. We shrink them for you.', 'JPG, PNG หรือ WebP เราย่อขนาดให้อัตโนมัติ')}</small></div>
          <input type="file" id="fileIn" accept="image/jpeg,image/png,image/webp" multiple hidden>
          <div class="prog" id="prog" hidden></div><div class="photos" id="photos"></div><div class="fld err" data-f="photos"><span class="msg" data-msg style="display:none"></span></div>
        </section>

        <section class="card"><h2>${t('Location', 'ที่ตั้ง')}</h2><p class="lead">${t('Place the pin on the building. Only you and the HOMES/BKK team see it. The public map shows a circle of about 500 m instead.', 'ปักหมุดที่ตัวอาคาร เห็นเฉพาะคุณและทีม HOMES/BKK แผนที่สาธารณะจะแสดงเป็นวงกลมประมาณ 500 ม. แทน')}</p>
          ${C.placeSearch ? `<div class="row-actions" style="margin-bottom:6px"><input class="in" id="q" type="search" placeholder="${esc(t('Search a place or project name', 'ค้นหาสถานที่หรือชื่อโครงการ'))}" style="flex:1;min-width:200px"><button class="b ghost" type="button" data-act="search">${t('Search', 'ค้นหา')}</button><button class="b ghost" type="button" data-act="locate">${t('Use my location', 'ใช้ตำแหน่งของฉัน')}</button></div><ul class="found" id="found" hidden></ul>` : ''}
          <div id="pick" role="application" aria-label="${t('Map to place the pin', 'แผนที่สำหรับปักหมุด')}"></div>
          <div class="grid2">${fld('lat', t('Latitude', 'ละติจูด'), inp('lat', 'text', 'inputmode="decimal" placeholder="13.7367"'))}
          ${fld('lng', t('Longitude', 'ลองจิจูด'), inp('lng', 'text', 'inputmode="decimal" placeholder="100.5601"'))}</div>
          ${fld('address_private', t('Unit or address <i>(private)</i>', 'เลขห้อง/ที่อยู่ <i>(ไม่เผยแพร่)</i>'), inp('address_private', 'text', 'maxlength="200"'), t('Never shown on the site. Shared only after a viewing is booked.', 'ไม่แสดงบนเว็บ แจ้งให้เมื่อมีการนัดชม'))}
        </section>

        <section class="card"><h2>${t('The story', 'เรื่องราวของบ้าน')}</h2><p class="lead">${t('Why this home is worth seeing. Plain, specific and honest beats long.', 'ทำไมบ้านนี้น่าดู เขียนตรงๆ เจาะจง และจริงใจ ดีกว่ายาว')}</p>
          ${fld('story', t('Story', 'เรื่องราว'), `<textarea id="f_story" name="story" maxlength="3000">${esc(d.story || '')}</textarea>`)}
          ${fld('story_th', t('Story in Thai <i>(optional)</i>', 'เรื่องราวภาษาไทย <i>(ไม่บังคับ)</i>'), `<textarea id="f_story_th" name="story_th" maxlength="3000">${esc(d.story_th || '')}</textarea>`)}
        </section>
        <div class="ed-actions"><button class="b ghost" type="button" data-act="save">${t('Save', 'บันทึก')}</button>
          ${E.status === 'published' ? '' : `<button class="b" type="button" data-act="submit">${trusted ? t('Publish', 'เผยแพร่') : t('Send for review', 'ส่งให้ทีมตรวจ')}</button>`}
          <span class="grow"></span><a class="b ghost" href="#">${t('Back to my listings', 'กลับไปประกาศของฉัน')}</a></div>
      </div>
      <aside class="ed-side card"><div class="eyebrow">${t('Before it can go up', 'ก่อนขึ้นเว็บ')}</div><div class="bar"><i id="barI" style="width:0"></i></div><div id="barT" class="sub" style="font-size:13px;color:var(--fog)"></div><ul class="check" id="check"></ul>
        <p class="sub" style="font-size:12px;color:var(--fog);margin:14px 0 0;line-height:1.5">${trusted ? t('You can publish straight away. The team may still ask you to fix something later.', 'คุณเผยแพร่ได้ทันที ทีมอาจขอให้แก้ไขภายหลัง') : t('New listings are checked by the team, usually within a day. You will get an email.', 'ประกาศใหม่ทีมจะตรวจ ปกติภายใน 1 วัน และส่งอีเมลแจ้งผล')}</p></aside>
    </form>`);
    paintPhotos(); paintCheck(); initPicker(); bindEditor();
  }

  function collect() {
    const f = $('#ed'), v = n => (f.elements[n] ? f.elements[n].value : '');
    return {
      title: v('title'), title_th: v('title_th'), project: v('project'), area: v('area'), type: v('type'), furnished: v('furnished'),
      intents: $$('input[name=intent]:checked', f).map(x => x.value), price_sale: v('price_sale'), price_rent: v('price_rent'),
      beds: v('beds'), baths: v('baths'), size: v('size'), floor: v('floor'), pets: !!f.elements.pets.checked,
      tags: $$('input[name=tag]:checked', f).map(x => x.value), story: v('story'), story_th: v('story_th'),
      address_private: v('address_private'), lat: v('lat'), lng: v('lng')
    };
  }
  const toNum = s => { const n = Number(String(s).replace(/,/g, '')); return String(s).trim() === '' || !isFinite(n) ? null : n; };
  function liveData() { // the form as the readiness rules see it
    const c = collect(), la = toNum(c.lat), ln = toNum(c.lng);
    return Object.assign({}, c, { price_sale: toNum(c.price_sale), price_rent: toNum(c.price_rent), size: toNum(c.size), lat: la, lng: ln, photos: E.data.photos || [] });
  }
  function paintCheck() {
    const items = readiness(liveData()), done = items.filter(i => i[2]).length;
    $('#check').innerHTML = items.map(i => `<li class="${i[2] ? 'done' : ''}">${esc(i[1])}</li>`).join('');
    $('#barI').style.width = Math.round(done / items.length * 100) + '%';
    $('#barT').textContent = done + ' / ' + items.length + ' ' + t('done', 'เสร็จแล้ว');
  }
  function paintPhotos() {
    const ps = E.data.photos || [];
    const pe = $('.fld[data-f="photos"]'); if (pe && ps.length >= 3) pe.classList.remove('err');
    $('#photos').innerHTML = ps.map((id, i) => `<div class="ph" data-id="${esc(id)}"><img alt="" src="${esc(HB.photo(id, 500))}">${i === 0 ? `<span class="cover">${t('Cover', 'ภาพปก')}</span>` : ''}
      <div class="tools"><span><button type="button" data-act="mv" data-d="-1" aria-label="${t('Move earlier', 'เลื่อนไปก่อน')}"${i === 0 ? ' disabled' : ''}>‹</button><button type="button" data-act="mv" data-d="1" aria-label="${t('Move later', 'เลื่อนไปหลัง')}"${i === ps.length - 1 ? ' disabled' : ''}>›</button></span><button class="rm" type="button" data-act="rmphoto">${t('Remove', 'ลบ')}</button></div></div>`).join('');
  }
  function fieldErrors(fields) {
    $$('.fld.err').forEach(x => { if (x.dataset.f !== 'photos') x.classList.remove('err'); });
    const L = { title: ['title'], project: ['project'], area: ['area'], type: ['type'], intents: ['intents'], price_sale: ['price_sale'], price_rent: ['price_rent'], size: ['size'], lat: ['lat'], beds: ['beds'], baths: ['baths'], photos: ['photos'] };
    Object.keys(fields || {}).forEach(k => {
      const el = $(`.fld[data-f="${(L[k] || [k])[0]}"]`); if (!el) return;
      const m = $('[data-msg]', el);
      const why = fields[k] === 'outside_bangkok' ? t('That point is outside Bangkok. Check the numbers.', 'จุดนี้อยู่นอกกรุงเทพฯ ตรวจสอบตัวเลขอีกครั้ง') : fields[k] === 'required' ? t('Needed', 'จำเป็นต้องกรอก') : String(fields[k]).startsWith('min_') ? t('Add at least 3 photos', 'เพิ่มรูปอย่างน้อย 3 รูป') : t('Please check this', 'กรุณาตรวจสอบ');
      el.classList.add('err'); if (m) { m.textContent = why; m.style.display = 'block'; }
    });
    const first = $('.fld.err'); if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  async function save(quiet) {
    const c = collect();
    const r = await api('save_listing', { listing: Object.assign({ id: E.id || undefined, photos: E.data.photos }, c) });
    if (!r.ok) { if (r.error === 'validation') { fieldErrors(r.fields); toast(t('Please fix the highlighted fields.', 'กรุณาแก้ช่องที่ไฮไลต์'), true); } else toast(errText(r), true); return null; }
    const first = !E.id;
    E.id = r.listing.id; E.status = r.listing.status; E.data = r.listing.data; E.reject_reason = r.listing.reject_reason;
    if (first) history.replaceState(null, '', '#edit/' + E.id);
    if (!quiet) toast(r.listing.status === 'pending' && c ? t('Saved. It is back in review.', 'บันทึกแล้ว ประกาศกลับไปรอตรวจสอบ') : t('Saved.', 'บันทึกแล้ว'));
    paintPhotos(); paintCheck();
    return r.listing;
  }
  async function ensureSaved() {
    if (E.id) return true;
    const c = collect();
    if (!c.title && !c.project) { fieldErrors({ title: 'required' }); toast(t('Add a title or project name first, then add photos.', 'ใส่ชื่อประกาศหรือชื่อโครงการก่อน แล้วจึงเพิ่มรูป'), true); return false; }
    return !!(await save(true));
  }

  /* photos: shrink in the browser, send one at a time */
  function toB64(blob) { return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1]); fr.onerror = rej; fr.readAsDataURL(blob); }); }
  async function shrink(file) {
    const max = LIVE ? 2000 : 900, q = LIVE ? .82 : .7, url = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('decode')); i.src = url; });
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight)), w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h; cv.getContext('2d').drawImage(img, 0, 0, w, h);
      return await toB64(await new Promise(r => cv.toBlob(r, 'image/jpeg', q)));
    } finally { URL.revokeObjectURL(url); }
  }
  let uploading = false;
  async function addFiles(files) {
    files = [...files].filter(f => /^image\//.test(f.type));
    if (!files.length || uploading) return;
    if (!(await ensureSaved())) return;
    uploading = true; const pr = $('#prog'); pr.hidden = false;
    let ok = 0;
    for (let i = 0; i < files.length; i++) {
      pr.textContent = t('Uploading ', 'กำลังอัปโหลด ') + (i + 1) + ' / ' + files.length + '…';
      let b64;
      try { b64 = await shrink(files[i]); } catch (e) { toast(t('Could not read ', 'อ่านไฟล์ไม่ได้: ') + files[i].name + t('. Try a JPG or PNG.', ' ลองใช้ JPG หรือ PNG'), true); continue; }
      const r = await api('upload_photo', { id: E.id, data: b64 });
      if (!r.ok) { toast(errText(r), true); if (r.error === 'too_many_photos' || r.error === 'rate_limited') break; continue; }
      E.data.photos = r.photos; E.status = r.status; ok++; paintPhotos(); paintCheck();
    }
    pr.hidden = true; uploading = false;
    if (ok) toast(ok + t(' photo(s) added.', ' รูปถูกเพิ่มแล้ว'));
  }

  /* map picker */
  function initPicker() {
    const d = E.data, la = Number(d.lat), ln = Number(d.lng), has = typeof d.lat === 'number' && typeof d.lng === 'number';
    pickMap = L.map('pick', { scrollWheelZoom: false }).setView(has ? [la, ln] : C.mapCenter, has ? 16 : 12);
    L.tileLayer(C.mapTiles, { attribution: C.mapAttribution, maxZoom: 19 }).addTo(pickMap);
    let mk = null;
    function put(lat, lng, pan) {
      lat = Math.round(lat * 1e6) / 1e6; lng = Math.round(lng * 1e6) / 1e6;
      $('#f_lat').value = lat; $('#f_lng').value = lng;
      if (!mk) { mk = L.marker([lat, lng], { draggable: true }).addTo(pickMap); mk.on('dragend', () => { const p = mk.getLatLng(); put(p.lat, p.lng); }); } else mk.setLatLng([lat, lng]);
      if (pan) pickMap.setView([lat, lng], Math.max(pickMap.getZoom(), 16));
      paintCheck();
    }
    if (has) put(la, ln);
    pickMap.on('click', e => put(e.latlng.lat, e.latlng.lng));
    const sync = () => { const a = toNum($('#f_lat').value), b = toNum($('#f_lng').value); if (a !== null && b !== null) put(a, b, true); else paintCheck(); };
    $('#f_lat').addEventListener('change', sync); $('#f_lng').addEventListener('change', sync);
    pickMap._put = put;
    setTimeout(() => pickMap && pickMap.invalidateSize(), 200);
  }
  async function placeSearch() {
    const q = $('#q').value.trim(), ul = $('#found'); if (!q) return;
    ul.hidden = false; ul.innerHTML = `<li><button type="button" disabled>${t('Searching…', 'กำลังค้นหา…')}</button></li>`;
    try {
      const r = await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&countrycodes=th&accept-language=' + HB.lang + '&viewbox=100.3,13.95,100.95,13.5&q=' + encodeURIComponent(q));
      const j = await r.json();
      ul.innerHTML = j.length ? j.map((x, i) => `<li><button type="button" data-act="pickres" data-lat="${esc(x.lat)}" data-lng="${esc(x.lon)}">${esc(x.display_name)}</button></li>`).join('') : `<li><button type="button" disabled>${t('Nothing found. Try another spelling, or click the map.', 'ไม่พบ ลองสะกดอย่างอื่น หรือคลิกบนแผนที่')}</button></li>`;
    } catch (e) { ul.innerHTML = `<li><button type="button" disabled>${t('Search is not available here. Click the map or type the latitude and longitude.', 'ค้นหาไม่ได้ในที่นี้ คลิกบนแผนที่หรือกรอกละติจูด/ลองจิจูดเอง')}</button></li>`; }
  }

  function bindEditor() {
    const f = $('#ed');
    f.addEventListener('input', e => { const fl = e.target.closest && e.target.closest('.fld.err'); if (fl && fl.dataset.f !== 'photos') fl.classList.remove('err'); paintCheck(); });
    f.addEventListener('submit', e => e.preventDefault());
    const drop = $('#drop'), fi = $('#fileIn');
    drop.addEventListener('click', () => fi.click());
    drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fi.click(); } });
    fi.addEventListener('change', () => { addFiles(fi.files); fi.value = ''; });
    ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', e => addFiles(e.dataTransfer.files));
    const q = $('#q'); if (q) q.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); placeSearch(); } });
  }

  /* ---------- review queue ---------- */
  async function viewQueue() {
    shell('queue', t('Review', 'รอตรวจสอบ'), '', `<p class="p-loading">${t('Loading…', 'กำลังโหลด…')}</p>`);
    const r = await api('review_queue'); if (!r.ok) return fail(r);
    S.queue = r.listings; paintQueue();
  }
  function osm(d) { return `https://www.openstreetmap.org/?mlat=${d.lat}&mlon=${d.lng}#map=17/${d.lat}/${d.lng}`; }
  function paintQueue() {
    const n = $('.p-tabs a[href="#queue"] .n'); if (n) { if (S.queue.length) n.textContent = S.queue.length; else n.remove(); }
    $('#view').innerHTML = S.queue.length ? S.queue.map(L => {
      const d = L.data, ready = readiness(d).filter(x => !x[2]);
      return `<article class="card rv" data-id="${esc(L.id)}"><div class="eyebrow">${esc(L.owner_name)} · ${esc(L.owner_email)} · ${t('sent', 'ส่งเมื่อ')} ${esc(HB.ago(L.submitted_at))}</div>
        <h3>${esc(d.title || d.project)}</h3>
        <div class="facts"><span><b>${esc(d.project || '')}</b> · ${esc(areaLabel(d.area))}</span><span>${esc(t(d.type || '', TYPES[d.type] || ''))}</span><span>${esc((d.intents || []).map(x => x === 'buy' ? t('Sale', 'ขาย') : t('Rent', 'เช่า')).join(' + '))}</span><span>${esc(money(d))}</span>${d.beds !== null && d.beds !== undefined ? `<span>${d.beds} ${t('bed', 'นอน')}</span>` : ''}${d.size ? `<span>${esc(d.size)} ${t('sqm', 'ตร.ม.')}</span>` : ''}</div>
        <div class="rv-photos">${(d.photos || []).map(id => `<img alt="" loading="lazy" src="${esc(HB.photo(id, 400))}">`).join('')}</div>
        ${d.story ? `<div class="story">${esc(d.story)}</div>` : ''}
        <div class="facts"><span><b>${t('Pin', 'หมุด')}:</b> ${typeof d.lat === 'number' ? `<a href="${esc(osm(d))}" target="_blank" rel="noopener">${d.lat}, ${d.lng}</a>` : t('missing', 'ไม่มี')}</span>${d.address_private ? `<span><b>${t('Private address', 'ที่อยู่ส่วนตัว')}:</b> ${esc(d.address_private)}</span>` : ''}</div>
        ${ready.length ? `<div class="note err">${t('Still missing:', 'ยังขาด:')} ${esc(ready.map(x => x[1]).join(', '))}</div>` : ''}
        <div class="row-actions"><button class="b" type="button" data-act="approve" data-id="${esc(L.id)}"${ready.length ? ' disabled' : ''}>${t('Approve and publish', 'อนุมัติและเผยแพร่')}</button>
          <button class="b ghost" type="button" data-act="rejopen" data-id="${esc(L.id)}">${t('Ask for changes', 'ขอให้แก้ไข')}</button><a class="b ghost" href="#edit/${esc(L.id)}">${t('Edit it myself', 'แก้เอง')}</a></div>
        <div class="rj" hidden style="margin-top:12px"><label class="fld"><span>${t('What should they change? They will see this.', 'ต้องการให้แก้อะไร เจ้าของจะเห็นข้อความนี้')}</span><textarea class="in" maxlength="500"></textarea></label><button class="b warn sm" type="button" data-act="rejsend" data-id="${esc(L.id)}">${t('Send back', 'ส่งกลับ')}</button></div>
      </article>`;
    }).join('') : `<div class="empty-state"><h3>${t('Nothing waiting.', 'ไม่มีอะไรค้าง')}</h3><p>${t('New submissions from agents and partners appear here.', 'ประกาศใหม่จากเอเจนต์และพาร์ทเนอร์จะมาแสดงที่นี่')}</p></div>`;
    HB.translate($('#view'));
  }

  /* ---------- all listings ---------- */
  async function viewAll() {
    shell('all', t('All listings', 'ประกาศทั้งหมด'), `<select class="in" id="stF" style="width:auto" aria-label="${t('Filter by status', 'กรองตามสถานะ')}"><option value="">${t('Any status', 'ทุกสถานะ')}</option>${Object.keys(STATUS).map(k => `<option value="${k}"${S.allFilter === k ? ' selected' : ''}>${esc(stLabel(k))}</option>`).join('')}</select>`, `<p class="p-loading">${t('Loading…', 'กำลังโหลด…')}</p>`);
    const [r, u] = await Promise.all([api('all_listings', { status: S.allFilter }), api('users')]);
    if (!r.ok) return fail(r);
    S.all = r.listings; S.users = u.ok ? u.users : [];
    $('#view').innerHTML = r.listings.length ? r.listings.map(l => listRow(l, { owner: true })).join('') : `<div class="empty-state"><h3>${t('No listings match.', 'ไม่พบประกาศ')}</h3></div>`;
    HB.translate($('#view'));
  }

  /* ---------- team ---------- */
  async function viewTeam() {
    shell('team', t('Team', 'ทีม'), '', `<p class="p-loading">${t('Loading…', 'กำลังโหลด…')}</p>`);
    const r = await api('users'); if (!r.ok) return fail(r);
    S.users = r.users; paintTeam();
  }
  function paintTeam() {
    const me = S.user.email;
    $('#view').innerHTML = `<section class="card" style="margin-bottom:24px"><h2 style="font:500 24px 'Playfair Display',serif;margin:0 0 4px">${t('Invite someone', 'เชิญสมาชิก')}</h2>
      <p class="sub" style="color:var(--fog);font-size:14px;margin:0 0 14px">${t('They get an email with the sign-in link. Only invited people can sign in.', 'เขาจะได้รับอีเมลพร้อมลิงก์เข้าสู่ระบบ เข้าได้เฉพาะผู้ที่ได้รับเชิญ')}</p>
      <form id="fInv" class="grid4" novalidate style="align-items:end"><label class="fld"><span>${t('Email', 'อีเมล')}</span><input class="in" type="email" name="email" required></label>
      <label class="fld"><span>${t('Name', 'ชื่อ')}</span><input class="in" type="text" name="name" maxlength="80"></label>
      <label class="fld"><span>${t('Role', 'บทบาท')}</span><select class="in" name="role"><option value="agent">${t('Agent', 'เอเจนต์')}</option><option value="partner">${t('Partner', 'พาร์ทเนอร์')}</option><option value="admin">${t('Admin', 'แอดมิน')}</option></select></label>
      <div class="fld"><label class="checks" style="margin-bottom:10px"><span style="display:flex;gap:7px;align-items:center;font-size:13px"><input type="checkbox" name="trusted"> ${t('Trusted (publishes without review)', 'ไว้ใจ (เผยแพร่ได้เลยไม่ต้องรออนุมัติ)')}</span></label><button class="b" type="submit">${t('Send invitation', 'ส่งคำเชิญ')}</button></div></form></section>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>${t('Member', 'สมาชิก')}</th><th>${t('Role', 'บทบาท')}</th><th>${t('Trusted', 'ไว้ใจ')}</th><th>${t('Status', 'สถานะ')}</th><th>${t('Listings', 'ประกาศ')}</th></tr></thead><tbody>
      ${S.users.map(u => { const self = u.email === me, c = u.counts || {}; return `<tr data-email="${esc(u.email)}"><td><b>${esc(u.name)}</b>${self ? ` <span class="dim">(${t('you', 'คุณ')})</span>` : ''}<br><span class="dim">${esc(u.email)}</span></td>
        <td><select data-f="role"${self ? ' disabled' : ''}>${['admin', 'partner', 'agent'].map(r => `<option value="${r}"${u.role === r ? ' selected' : ''}>${esc(t(ROLE[r][0], ROLE[r][1]))}</option>`).join('')}</select></td>
        <td><input type="checkbox" data-f="trusted"${u.trusted ? ' checked' : ''}${u.role === 'admin' ? ' disabled' : ''} aria-label="${t('Trusted', 'ไว้ใจ')}"></td>
        <td><select data-f="status"${self ? ' disabled' : ''}><option value="active"${u.status === 'active' ? ' selected' : ''}>${t('Active', 'ใช้งาน')}</option><option value="disabled"${u.status === 'disabled' ? ' selected' : ''}>${t('Disabled', 'ปิดการใช้งาน')}</option></select></td>
        <td class="dim">${c.published || 0} ${t('live', 'ขึ้นเว็บ')} · ${c.pending || 0} ${t('review', 'รอตรวจ')} · ${c.draft || 0} ${t('draft', 'ร่าง')}</td></tr>`; }).join('')}</tbody></table></div>`;
    HB.translate($('#view'));
  }

  /* ---------- profile ---------- */
  function viewProfile() {
    const u = S.user;
    shell('profile', t('Profile', 'โปรไฟล์'), '', `<form id="fProf" class="card" style="max-width:520px" novalidate>
      <label class="fld"><span>${t('Name shown on your listings', 'ชื่อที่แสดงในประกาศของคุณ')}</span><input class="in" name="name" maxlength="80" value="${esc(u.name)}"></label>
      <label class="fld"><span>${t('Company <i>(optional)</i>', 'บริษัท <i>(ไม่บังคับ)</i>')}</span><input class="in" name="company" maxlength="80" value="${esc(u.company)}"></label>
      <div class="grid2"><label class="fld"><span>${t('Phone', 'เบอร์โทร')}</span><input class="in" name="phone" maxlength="40" value="${esc(u.phone)}"></label>
      <label class="fld"><span>Line</span><input class="in" name="line" maxlength="60" value="${esc(u.line)}"></label></div>
      <p class="sub" style="color:var(--fog);font-size:13px;margin:0 0 14px">${esc(u.email)} · ${esc(t(ROLE[u.role][0], ROLE[u.role][1]))}${u.trusted ? ' · ' + t('trusted', 'ไว้ใจ') : ''}</p>
      <button class="b" type="submit">${t('Save', 'บันทึก')}</button></form>`);
  }

  /* ---------- events ---------- */
  function setRow(L) { const i = (S.mine || []).findIndex(x => x.id === L.id); if (i >= 0) S.mine[i] = L; }
  document.addEventListener('submit', async e => {
    const f = e.target;
    if (f.id === 'fEmail') { e.preventDefault(); await sendCode($('#lgEmail').value.trim()); }
    else if (f.id === 'fCode') { e.preventDefault(); await verify($('#lgEmail').value, $('#lgCode').value.trim()); }
    else if (f.id === 'fInv') {
      e.preventDefault(); const fd = new FormData(f), b = $('button', f); b.disabled = true;
      const r = await api('user_invite', { email: fd.get('email'), name: fd.get('name'), role: fd.get('role'), trusted: !!fd.get('trusted') });
      b.disabled = false;
      if (!r.ok) return toast(r.error === 'validation' ? t('Check the email address.', 'ตรวจสอบอีเมล') : errText(r), true);
      toast(t('Invitation sent.', 'ส่งคำเชิญแล้ว')); viewTeam();
    } else if (f.id === 'fProf') {
      e.preventDefault(); const fd = new FormData(f);
      const r = await api('profile_update', { name: fd.get('name'), company: fd.get('company'), phone: fd.get('phone'), line: fd.get('line') });
      if (!r.ok) return toast(errText(r), true);
      S.user = r.user; renderWho(); toast(t('Profile saved.', 'บันทึกโปรไฟล์แล้ว'));
    }
  });
  document.addEventListener('change', async e => {
    const el = e.target;
    if (el.id === 'stF') { S.allFilter = el.value; return viewAll(); }
    if (el.matches('[data-act=owner]')) {
      const r = await api('set_owner', { id: el.dataset.id, email: el.value }); if (!r.ok) { toast(errText(r), true); return viewAll(); } return toast(t('Owner changed.', 'เปลี่ยนเจ้าของแล้ว'));
    }
    const tr = el.closest('tr[data-email]');
    if (tr && el.dataset.f) {
      const body = { email: tr.dataset.email }; body[el.dataset.f] = el.type === 'checkbox' ? el.checked : el.value;
      const r = await api('user_update', body);
      if (!r.ok) { toast(errText(r), true); return viewTeam(); }
      toast(t('Updated.', 'อัปเดตแล้ว')); viewTeam();
    }
  });
  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-act]'); if (!b || b.tagName === 'SELECT') return;
    const act = b.dataset.act, id = b.dataset.id;
    if (act === 'signout') { session.clear(); S.user = null; S.mine = S.queue = S.all = S.users = null; location.hash = ''; return route(); }
    if (act === 'quick') { b.disabled = true; await api('login_request', { email: b.dataset.email }); return renderLogin('code', b.dataset.email, { text: t('Demo mode: the code is shown below instead of being emailed.', 'โหมดเดโม: แสดงรหัสด้านล่างแทนการส่งอีเมล') }); }
    if (act === 'fillcode') { const c = demoInboxCode($('#lgEmail').value); if (c) { $('#lgCode').value = c; $('#fCode').requestSubmit ? $('#fCode').requestSubmit() : verify($('#lgEmail').value, c); } return; }
    if (act === 'back') return renderLogin('email');
    if (act === 'archive' || act === 'restore' || act === 'confirm') {
      b.disabled = true; const r = await api(act + (act === 'confirm' ? '_listing' : '_listing'), { id });
      if (!r.ok) { b.disabled = false; return toast(errText(r), true); }
      toast(act === 'archive' ? t('Archived.', 'เก็บเข้าคลังแล้ว') : act === 'restore' ? t('Restored as a draft.', 'กู้คืนเป็นฉบับร่างแล้ว') : t('Thanks, confirmed.', 'ขอบคุณ ยืนยันแล้ว'));
      return route();
    }
    if (act === 'save') { b.disabled = true; await save(); b.disabled = false; return; }
    if (act === 'submit') {
      b.disabled = true; const L = await save(true); if (!L) { b.disabled = false; return; }
      const r = await api('submit_listing', { id: E.id }); b.disabled = false;
      if (!r.ok) { if (r.error === 'not_ready') { fieldErrors(r.fields); return toast(t('Almost there. The highlighted parts are still needed.', 'เกือบเสร็จแล้ว ส่วนที่ไฮไลต์ยังต้องกรอก'), true); } return toast(errText(r), true); }
      toast(r.status === 'published' ? t('Published. It is on the site now.', 'เผยแพร่แล้ว ขึ้นเว็บเรียบร้อย') : t('Sent for review. We will email you.', 'ส่งให้ทีมตรวจแล้ว เราจะส่งอีเมลแจ้ง')); S.queue = null; return go('');
    }
    if (act === 'mv') {
      const ph = b.closest('.ph').dataset.id, ps = E.data.photos.slice(), i = ps.indexOf(ph), j = i + Number(b.dataset.d);
      if (j < 0 || j >= ps.length) return; ps.splice(j, 0, ps.splice(i, 1)[0]); E.data.photos = ps; paintPhotos();
      const r = await api('save_listing', { listing: { id: E.id, photos: ps } }); if (!r.ok) toast(errText(r), true); else { E.data.photos = r.listing.data.photos; E.status = r.listing.status; }
      return;
    }
    if (act === 'rmphoto') {
      if (!b.dataset.sure) { b.dataset.sure = '1'; b.textContent = t('Sure?', 'แน่ใจ?'); setTimeout(() => { if (b.isConnected) { delete b.dataset.sure; b.textContent = t('Remove', 'ลบ'); } }, 3000); return; }
      const r = await api('remove_photo', { id: E.id, photo_id: b.closest('.ph').dataset.id }); if (!r.ok) return toast(errText(r), true);
      E.data.photos = r.photos; E.status = r.status; paintPhotos(); paintCheck(); return;
    }
    if (act === 'search') return placeSearch();
    if (act === 'pickres') { pickMap._put(Number(b.dataset.lat), Number(b.dataset.lng), true); $('#found').hidden = true; return; }
    if (act === 'locate') {
      if (!navigator.geolocation) return toast(t('Location is not available in this browser.', 'เบราว์เซอร์นี้ไม่รองรับตำแหน่ง'), true);
      navigator.geolocation.getCurrentPosition(p => pickMap._put(p.coords.latitude, p.coords.longitude, true), () => toast(t('Could not get your location.', 'ไม่สามารถระบุตำแหน่งได้'), true), { enableHighAccuracy: true, timeout: 10000 }); return;
    }
    if (act === 'approve') {
      b.disabled = true; const r = await api('approve_listing', { id });
      if (!r.ok) { b.disabled = false; return toast(r.error === 'not_ready' ? t('It is missing required details.', 'ข้อมูลยังไม่ครบ') : errText(r), true); }
      S.queue = S.queue.filter(x => x.id !== id); toast(t('Published.', 'เผยแพร่แล้ว')); return paintQueue();
    }
    if (act === 'rejopen') { const box = b.closest('.rv').querySelector('.rj'); box.hidden = !box.hidden; if (!box.hidden) box.querySelector('textarea').focus(); return; }
    if (act === 'rejsend') {
      const reason = b.closest('.rj').querySelector('textarea').value.trim();
      if (!reason) return toast(t('Write what they should change.', 'เขียนสิ่งที่ต้องแก้ไข'), true);
      b.disabled = true; const r = await api('reject_listing', { id, reason });
      if (!r.ok) { b.disabled = false; return toast(errText(r), true); }
      S.queue = S.queue.filter(x => x.id !== id); toast(t('Sent back with your note.', 'ส่งกลับพร้อมข้อความแล้ว')); return paintQueue();
    }
    if (act === 'resetdemo') { demo.reset(); session.clear(); location.hash = ''; location.reload(); }
  });

  /* ---------- boot ---------- */
  (async function boot() {
    if (demo) {
      const bar = $('#demoBar'); bar.hidden = false;
      bar.innerHTML = `<b>${t('Demo mode.', 'โหมดเดโม')}</b> <span>${t('Everything here stays in this browser. Nothing is sent or saved on a server.', 'ทุกอย่างเก็บในเบราว์เซอร์นี้เท่านั้น ไม่มีการส่งหรือบันทึกบนเซิร์ฟเวอร์')}</span><button type="button" data-act="resetdemo">${t('Reset demo data', 'ล้างข้อมูลเดโม')}</button>`;
    }
    const s = session.get();
    if (s) { const r = await api('me'); if (r.ok) S.user = r.user; }
    route();
  })();
})();
