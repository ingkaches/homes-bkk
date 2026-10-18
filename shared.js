/* HOMES/BKK shared behaviour: nav state, mobile drawer, finder (search bar), cards, shelves, footer. */
window.HB = window.HB || {};
(function () {
  const HB = window.HB;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked: ignore */ } }
  };

  /* ---------- language: EN (default) or TH ---------- */
  HB.lang = (function () {
    let l = null;
    try {
      const q = new URLSearchParams(location.search).get('lang');
      if (q === 'th' || q === 'en') localStorage.setItem('hb-lang', q);
      l = localStorage.getItem('hb-lang');
    } catch (e) {
      const m = location.search.match(/[?&]lang=(th|en)/); l = m ? m[1] : null;
    }
    if (!l) { const m = location.search.match(/[?&]lang=(th|en)/); l = m ? m[1] : null; }
    return l === 'th' ? 'th' : 'en';
  })();
  HB.th = HB.lang === 'th';
  document.documentElement.lang = HB.lang;

  /* Exact-match dictionary (i18n-th.js). Anything without an entry stays in English. */
  const SKIP = /^(SCRIPT|STYLE|TEXTAREA|NOSCRIPT)$/;
  function trNode(n) {
    const D = window.HB_TH; if (!D) return;
    const raw = n.nodeValue, k = raw.replace(/\s+/g, ' ').trim();
    if (!k) return;
    let v = Object.prototype.hasOwnProperty.call(D.dict, k) ? D.dict[k] : undefined;
    if (v === undefined) for (const r of D.rules) { if (r[0].test(k)) { v = k.replace(r[0], r[1]); break; } }
    if (v !== undefined && v !== k) {
      n.nodeValue = raw.match(/^\s*/)[0] + v + raw.match(/\s*$/)[0];
      const h = n.parentElement && n.parentElement.closest('h1,h2,h3,.display,.title');
      if (h) h.classList.add('th-h');
    }
  }
  function trAttrs(root) {
    const D = window.HB_TH; if (!D) return;
    const has = (v) => v && Object.prototype.hasOwnProperty.call(D.dict, v);
    (root.querySelectorAll ? [root].concat([...root.querySelectorAll('[data-credit],[placeholder]')]) : []).forEach(el => {
      if (!el.getAttribute) return;
      ['data-credit', 'placeholder'].forEach(a => {
        const v = el.getAttribute(a);
        if (has(v)) el.setAttribute(a, D.dict[v]);
      });
    });
    // text that pages draw with CSS (hero badge, portrait label...): read it, translate it, override it once
    if (!HB._pseudoDone) {
      HB._pseudoDone = true;
      let css = '';
      [['.property-hero', ':before', '::before'], ['.profile-photo', ':before', '::before'], ['.sidebar-image', ':after', '::after']].forEach(([sel, pc, pe]) => {
        const el = document.querySelector(sel); if (!el) return;
        const c = (getComputedStyle(el, pe).content || '').replace(/^["']|["']$/g, '');
        if (has(c)) css += 'html[lang=th] ' + sel + pc + '{content:"' + D.dict[c].replace(/"/g, '\\"') + '" !important}';
      });
      if (css) { const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st); }
    }
  }
  HB.translate = function (root) {
    if (!HB.th || !window.HB_TH) return;
    root = root || document.body;
    if (root.nodeType === 3) { trNode(root); return; }
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => {
      const p = n.parentElement;
      return (!p || SKIP.test(p.tagName) || p.closest('[data-no-i18n]')) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
    } });
    const list = []; while (w.nextNode()) list.push(w.currentNode);
    list.forEach(trNode);
    trAttrs(root);
  };
  HB.watchTranslate = function () {
    if (!HB.th || !window.HB_TH) return;
    new MutationObserver(ms => {
      for (const m of ms) {
        if (m.type === 'characterData') trNode(m.target);
        else m.addedNodes.forEach(a => { if (a.nodeType === 3) trNode(a); else if (a.nodeType === 1) HB.translate(a); });
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  };
  HB.langSwitch = function () {
    const d = document.createElement('span');
    d.className = 'lang'; d.setAttribute('role', 'group'); d.setAttribute('aria-label', 'Language');
    d.setAttribute('data-no-i18n', '');
    d.innerHTML = '<button type="button" data-lang="en" aria-pressed="' + (HB.lang === 'en') + '">EN</button><button type="button" data-lang="th" aria-pressed="' + (HB.lang === 'th') + '">ไทย</button>';
    return d;
  };
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-lang]');
    if (!b || b.dataset.lang === HB.lang) return;
    try { localStorage.setItem('hb-lang', b.dataset.lang); } catch (err) { /* ignore */ }
    const u = new URL(location.href); u.searchParams.set('lang', b.dataset.lang); location.href = u.href;
  });

  /* ---------- one navigation, everywhere ---------- */
  HB.NAV = [
    ['collections.html', 'Collections'],
    ['marketplace.html', 'Homes'],
    ['map.html', 'Map'],
    ['spaces.html', 'Spaces'],
    ['projects.html', 'Projects'],
    ['journal.html', 'Journal']
  ];
  HB.CTA = ['the-home-edit.html', 'Submit a home'];

  const SECTION = {
    'collection-quiet-city.html': 'collections.html',
    'book-viewing.html': 'marketplace.html',
    'agent-maya.html': 'marketplace.html',
    'project-atelia.html': 'projects.html'
  };
  function currentSection() {
    const file = (location.pathname.split('/').pop() || 'index.html');
    if (file.startsWith('property-')) return 'marketplace.html';
    return SECTION[file] || file;
  }

  /* ---------- helpers on the home data ---------- */
  HB.count = (tag) => HB.HOMES.filter(h => h.tags.includes(tag)).length;
  HB.plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);

  HB.filter = function (f) {
    f = f || {};
    return HB.HOMES.filter(h => {
      if (f.intent && f.intent !== 'all' && !h.intents.includes(f.intent)) return false;
      if (f.area && f.area !== 'all' && h.area !== f.area) return false;
      if (f.life && f.life !== 'all' && !h.tags.includes(f.life)) return false;
      if (f.beds && f.beds.length) {
        const ok = f.beds.some(b => b === '1' ? h.beds === 1 : (h.beds !== null && h.beds >= 2));
        if (!ok) return false;
      }
      if (f.setting && f.setting.length && !f.setting.some(t => h.tags.includes(t))) return false;
      if (f.building && f.building.length && !f.building.some(t => h.tags.includes(t))) return false;
      return true;
    });
  };

  /* ---------- listing card (same card on Home and Homes) ---------- */
  HB.priceHTML = function (s, notes) {
    if (!s) return '';
    const unit = HB.th ? 'ล้าน' : 'M';
    const word = t => HB.th ? t.replace(/for sale/g, 'ขาย').replace(/\bsale\b/g, 'ขาย').replace(/\/ month rent/g, '/ เดือน เช่า').replace(/\/ month/g, '/ เดือน').replace(/\brent\b/g, 'เช่า')
      .replace(/Terms pending verification/g, 'เงื่อนไขรอตรวจสอบ') : t;
    const money = t => String(t).split(/(฿\s?\d[\d.,]*M?)/).map(seg => {
      const m = seg.match(/^฿\s?(\d[\d.,]*)(M)?$/);
      return m ? '<span class="px"><span class="px-c">฿</span><span class="px-n">' + m[1] + '</span>' + (m[2] ? '<span class="px-u">' + unit + '</span>' : '') + '</span>' : word(seg);
    }).join('');
    if (notes === false) return money(s);
    const parts = String(s).split(' · ');
    let out = money(parts[0]);
    if (parts.length > 1) out += '<span class="px-note">' + money(parts.slice(1).join(' · ')) + '</span>';
    return out;
  };
  HB.prettyPrices = function (root) {
    (root || document).querySelectorAll('.price-big, .price, .price-card strong, .unit h4').forEach(el => {
      if (el.dataset.px || !el.textContent.includes('฿')) return;
      el.dataset.px = '1';
      el.innerHTML = HB.priceHTML(el.innerHTML, el.classList.contains('price-big'));
    });
  };

  HB.cardHTML = function (h) {
    const T = (HB.th && window.HB_TH && window.HB_TH.homes && window.HB_TH.homes[h.id]) || {};
    h = Object.assign({}, h, T);
    const saved = store.get('hb-saved', []).includes(h.id);
    return `<article class="hcard${h.concept ? ' is-concept' : ''}" data-id="${h.id}">
      <a class="hcard-img" href="${h.href}"><img loading="lazy" alt="${h.alt}" src="${h.img}"><span class="hcard-badge">${h.badge}</span></a>
      <button class="hcard-save${saved ? ' saved' : ''}" type="button" aria-pressed="${saved}" aria-label="${saved ? 'Remove from saved' : 'Save this home'}">${saved ? '♥' : '♡'}</button>
      <div class="hcard-body">
        <div class="hcard-price">${HB.priceHTML(h.price)}</div>
        <h3 class="hcard-title"><a href="${h.href}">${h.title}</a></h3>
        <p class="hcard-meta">${h.meta[0]}<br>${h.meta[1]}</p>
        <div class="hcard-trust">${h.trust.map(t => `<span>${t}</span>`).join('')}</div>
      </div>
    </article>`;
  };
  document.addEventListener('click', e => {
    const b = e.target.closest('.hcard-save');
    if (!b) return;
    const id = b.closest('.hcard').dataset.id;
    let list = store.get('hb-saved', []);
    list = list.includes(id) ? list.filter(x => x !== id) : list.concat(id);
    store.set('hb-saved', list);
    const on = list.includes(id);
    b.classList.toggle('saved', on); b.textContent = on ? '♥' : '♡';
    b.setAttribute('aria-pressed', on); b.setAttribute('aria-label', on ? 'Remove from saved' : 'Save this home');
  });

  /* ---------- category tile + shelves ---------- */
  const KICKER = { life: 'Lifestyle', setting: 'Setting', building: 'Building' };
  HB.tileHTML = function (key) {
    const t = HB.TAGS[key], n = HB.count(key);
    return `<a class="tile" href="marketplace.html?tag=${key}"><img loading="lazy" src="${t.img}" alt="${t.alt || ''}"><span class="tile-kicker">${KICKER[t.group]}</span><span class="tile-count">${HB.plural(n, 'home', 'homes')}</span><span class="tile-title">${t.label}</span><span class="tile-go" aria-hidden="true">↗</span></a>`;
  };
  /* Categories with homes become image tiles; categories still being collected become honest "ghost" chips. */
  HB.renderShelves = function () {
    $$('[data-shelf]').forEach(el => {
      const groups = el.dataset.shelf === 'all' ? Object.keys(HB.GROUPS) : el.dataset.shelf.split(',');
      const keys = Object.keys(HB.TAGS).filter(k => groups.includes(HB.TAGS[k].group));
      const live = keys.filter(k => HB.count(k) > 0 && HB.TAGS[k].img), soon = keys.filter(k => !live.includes(k));
      el.innerHTML = live.map(HB.tileHTML).join('');
      const g = $(`[data-ghosts="${el.id}"]`);
      if (g) g.innerHTML = soon.length
        ? `<span class="mono">Collecting next</span>${soon.map(k => `<a class="ghost" href="the-home-edit.html">${HB.TAGS[k].label}</a>`).join('')}<a class="link" href="the-home-edit.html">Know a home like this? Submit it ↗</a>`
        : '';
    });
    $$('[data-count-tag]').forEach(el => { el.textContent = HB.plural(HB.count(el.dataset.countTag), 'home', 'homes'); });
    $$('[data-homes-tag]').forEach(el => { el.innerHTML = HB.HOMES.filter(h => h.tags.includes(el.dataset.homesTag)).map(HB.cardHTML).join(''); });
    $$('[data-related]').forEach(el => {
      const me = HB.HOMES.find(h => h.id === el.dataset.related);
      const score = h => (me ? h.tags.filter(t => me.tags.includes(t)).length : 0);
      el.innerHTML = HB.HOMES.filter(h => !h.concept && h.id !== el.dataset.related)
        .map((h, i) => [h, score(h), i]).sort((a, b) => b[1] - a[1] || a[2] - b[2]).slice(0, 3).map(x => HB.cardHTML(x[0])).join('');
    });
    $$('[data-new]').forEach(el => {
      const n = +el.dataset.new || 3;
      el.innerHTML = HB.HOMES.filter(h => !h.concept).slice(0, n).map(HB.cardHTML).join('');
    });
  };

  /* ---------- the finder (search bar) — one component, every page ---------- */
  const CHEVRON = '<svg class="finder-chev" width="12" height="8" viewBox="0 0 12 8" aria-hidden="true"><path d="M1 1.5l5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
  const ARROW = '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 11L11 3M5 3h6v6" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';

  function finderFields() {
    const lifeKeys = Object.keys(HB.TAGS).filter(k => HB.TAGS[k].group === 'life');
    return [
      { key: 'area', label: 'Where', options: [['all', 'Anywhere in Bangkok', HB.HOMES.length]]
          .concat(Object.entries(HB.AREAS).map(([k, v]) => [k, v, HB.filter({ area: k }).length])) },
      { key: 'intent', label: 'Looking to', options: [['all', 'Rent or buy', HB.HOMES.length], ['rent', 'Rent', HB.filter({ intent: 'rent' }).length], ['buy', 'Buy', HB.filter({ intent: 'buy' }).length]] },
      { key: 'life', label: 'A home that is', options: [['all', 'Any kind of life', HB.HOMES.length]]
          .concat(lifeKeys.map(k => [k, HB.TAGS[k].short, HB.count(k)])) }
    ];
  }

  HB.finder = function (host, opts) {
    opts = opts || {};
    const state = Object.assign({ area: 'all', intent: 'all', life: 'all' }, opts.state || {});
    const fields = finderFields();
    host.innerHTML = `<form class="finder" role="search" aria-label="Find a home">
      ${fields.map(f => `<div class="finder-field" data-key="${f.key}">
        <button type="button" class="finder-trigger" aria-haspopup="listbox" aria-expanded="false">
          <span class="finder-label">${f.label}</span>
          <span class="finder-value"><span class="finder-text"></span>${CHEVRON}</span>
        </button>
        <ul class="finder-menu" role="listbox" aria-label="${f.label}">
          ${f.options.map(o => `<li><button type="button" role="option" data-value="${o[0]}"${o[0] !== 'all' && o[2] === 0 ? ' disabled' : ''}><span>${o[1]}</span><small>${o[0] !== 'all' && o[2] === 0 ? 'soon' : o[2]}</small></button></li>`).join('')}
        </ul>
      </div>`).join('')}
      <button class="finder-go" type="submit"><span>Show homes</span>${ARROW}</button>
    </form>`;
    const form = $('form', host);

    function paint() {
      fields.forEach(f => {
        const el = $(`[data-key="${f.key}"]`, form);
        const cur = f.options.find(o => o[0] === state[f.key]) || f.options[0];
        $('.finder-text', el).textContent = cur[1];
        el.classList.toggle('is-set', state[f.key] !== 'all');
        $$('[role=option]', el).forEach(b => b.setAttribute('aria-selected', b.dataset.value === state[f.key]));
      });
    }
    function closeAll(except) {
      $$('.finder-field', form).forEach(x => {
        if (x === except) return;
        x.classList.remove('open'); $('.finder-trigger', x).setAttribute('aria-expanded', 'false');
      });
    }
    form.addEventListener('click', e => {
      const trig = e.target.closest('.finder-trigger');
      if (trig) {
        const field = trig.closest('.finder-field'), open = !field.classList.contains('open');
        closeAll(field); field.classList.toggle('open', open); trig.setAttribute('aria-expanded', open);
        return;
      }
      const opt = e.target.closest('[role=option]');
      if (opt && !opt.disabled) {
        const field = opt.closest('.finder-field');
        state[field.dataset.key] = opt.dataset.value;
        paint(); closeAll(); if (opts.onChange) opts.onChange(Object.assign({}, state));
      }
    });
    document.addEventListener('click', e => { if (!form.contains(e.target)) closeAll(); });
    form.addEventListener('keydown', e => { if (e.key === 'Escape') { closeAll(); } });
    form.addEventListener('submit', e => {
      e.preventDefault();
      if (opts.onSubmit) return opts.onSubmit(Object.assign({}, state));
      const p = new URLSearchParams();
      if (state.area !== 'all') p.set('area', state.area);
      if (state.intent !== 'all') p.set('intent', state.intent);
      if (state.life !== 'all') p.set('tag', state.life);
      location.href = 'marketplace.html' + (p.toString() ? '?' + p : '');
    });
    paint();
    return {
      set(k, v) { state[k] = v; paint(); },
      get() { return Object.assign({}, state); }
    };
  };

  /* ---------- footer ---------- */
  HB.footerHTML = `<div class="shell foot">
      <div class="foot-brand"><a class="brand" href="index.html">HOMES/<i>BKK</i></a><p>Curated Bangkok homes, with a small team that checks every home before you travel to see it.</p></div>
      <nav class="foot-nav" aria-label="Footer">${HB.NAV.map(n => `<a href="${n[0]}">${n[1]}</a>`).join('')}<a href="${HB.CTA[0]}">${HB.CTA[1]}</a><a href="agent-maya.html">Meet Maya</a><a href="portal.html">Agent portal</a></nav>
      <p class="foot-note">Concept prototype, 2026. Prices, availability and source rights are illustrative until verified. Selected pages use real supplied photography, labelled where it appears. <a href="partner-demo.html">Partner walkthrough ↗</a></p>
    </div>`;

  /* ---------- mobile drawer (replaces the old placeholder modal) ---------- */
  function buildDrawer() {
    const d = document.createElement('div');
    d.className = 'drawer'; d.hidden = true; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-label', 'Menu');
    d.innerHTML = `<div class="drawer-top"><a class="brand" href="index.html">HOMES/<i>BKK</i></a><button type="button" class="drawer-close" aria-label="Close menu">CLOSE ×</button></div>
      <nav>${HB.NAV.map(n => `<a href="${n[0]}">${n[1]}</a>`).join('')}</nav>
      <a class="btn sand drawer-cta" href="${HB.CTA[0]}">${HB.CTA[1]}</a>`;
    document.body.appendChild(d);
    const close = () => { d.hidden = true; document.body.classList.remove('no-scroll'); };
    d.addEventListener('click', e => { if (e.target.closest('.drawer-close') || e.target.closest('a')) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    return { open() { d.hidden = false; document.body.classList.add('no-scroll'); $('.drawer-close', d).focus(); } };
  }


  /* ---------- lightbox: full-size overlay, arrows / swipe / keys, closable ---------- */
  HB.lightbox = (function () {
    const SEL = 'main figure img, .sheet a, .lb-item';
    let items = [], idx = 0, root = null, imgEl, capEl, cntEl, lastFocus = null;
    function srcOf(el) { const r = el.tagName === 'A' ? el.getAttribute('href') : (el.dataset.full || el.getAttribute('src')); try { return new URL(r, location.href).href; } catch (e) { return r; } }
    function altOf(el) { const i = el.tagName === 'A' ? $('img', el) : el; return (i && i.alt) || ''; }
    function capOf(el) { const f = el.closest('figure'); const c = f && $('figcaption', f); return c ? c.textContent.trim() : altOf(el); }
    function collect() {
      const seen = new Set(), out = [];
      $$(SEL).forEach(el => {
        if (el.closest('.hcard, .tile, .toc-item')) return;
        const s = srcOf(el); if (!s || seen.has(s)) return;
        seen.add(s); out.push({ el, src: s, alt: altOf(el), cap: capOf(el) });
      });
      return out;
    }
    function build() {
      root = document.createElement('div');
      root.className = 'lb'; root.hidden = true; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Photo viewer');
      root.innerHTML = '<div class="lb-top"><span class="lb-count"></span><button type="button" class="lb-close" aria-label="Close photo viewer">CLOSE ×</button></div>' +
        '<button type="button" class="lb-nav lb-prev" aria-label="Previous photo">‹</button>' +
        '<figure class="lb-stage"><img alt=""><figcaption class="lb-cap"></figcaption></figure>' +
        '<button type="button" class="lb-nav lb-next" aria-label="Next photo">›</button>';
      document.body.appendChild(root);
      imgEl = $('.lb-stage img', root); capEl = $('.lb-cap', root); cntEl = $('.lb-count', root);
      root.addEventListener('click', e => {
        if (e.target.closest('.lb-close') || e.target === root || e.target.classList.contains('lb-stage')) close();
        else if (e.target.closest('.lb-prev')) go(-1);
        else if (e.target.closest('.lb-next')) go(1);
      });
      let x0 = null, y0 = 0;
      root.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
      root.addEventListener('touchend', e => {
        if (x0 === null) return;
        const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3) go(dx < 0 ? 1 : -1);
        else if (dy > 90 && Math.abs(dy) > Math.abs(dx) * 1.5) close();
      }, { passive: true });
      document.addEventListener('keydown', e => {
        if (root.hidden) return;
        if (e.key === 'Escape') close(); else if (e.key === 'ArrowRight') go(1); else if (e.key === 'ArrowLeft') go(-1);
      });
    }
    function show() {
      const it = items[idx];
      root.classList.add('is-loading');
      imgEl.onload = () => root.classList.remove('is-loading');
      imgEl.src = it.src; imgEl.alt = it.alt;
      capEl.textContent = it.cap; cntEl.textContent = (idx + 1) + ' / ' + items.length;
      [1, -1].forEach(d => { const n = items[(idx + d + items.length) % items.length]; if (n) { const p = new Image(); p.src = n.src; } });
      const one = items.length < 2; $$('.lb-nav', root).forEach(b => { b.hidden = one; });
    }
    function go(d) { idx = (idx + d + items.length) % items.length; show(); }
    function open(el) {
      if (!root) build();
      items = collect(); const s = srcOf(el); idx = Math.max(0, items.findIndex(i => i.src === s));
      if (!items.length) return;
      lastFocus = document.activeElement; root.hidden = false; document.body.classList.add('no-scroll'); show(); $('.lb-close', root).focus();
    }
    function close() { if (!root || root.hidden) return; root.hidden = true; document.body.classList.remove('no-scroll'); imgEl.removeAttribute('src'); if (lastFocus) lastFocus.focus(); }
    document.addEventListener('click', e => {
      const el = e.target.closest(SEL); if (!el || el.closest('.hcard, .tile, .toc-item')) return;
      e.preventDefault(); open(el);
    });
    return { open, close };
  })();

  /* ---------- sticky navigation: slides in when the reader scrolls up ---------- */
  function buildStickyNav(drawer) {
    const bar = document.createElement('header');
    bar.className = 'sn'; bar.setAttribute('aria-label', 'Site');
    const sec = currentSection();
    bar.innerHTML = `<div class="shell sn-in"><a class="brand" href="index.html">HOMES/<i>BKK</i></a>
      <nav class="sn-links">${HB.NAV.map(n => `<a href="${n[0]}"${n[0] === sec ? ' aria-current="page"' : ''}>${n[1]}</a>`).join('')}<a class="button" href="${HB.CTA[0]}">${HB.CTA[1]}</a></nav>
      <button type="button" class="sn-menu">MENU +</button></div>`;
    document.body.appendChild(bar);
    $('.sn-menu', bar).addEventListener('click', () => drawer.open());
    let last = window.scrollY, ticking = false;
    function update() {
      const y = window.scrollY, d = y - last;
      if (y < 260) bar.classList.remove('show');
      else if (d < -6) bar.classList.add('show');
      else if (d > 6) bar.classList.remove('show');
      if (Math.abs(d) > 6 || y < 260) last = y;
      ticking = false;
    }
    window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  }

  function init() {
    /* active nav link */
    const sec = currentSection();
    $$('.nav a:not(.button)').forEach(a => { if (a.getAttribute('href') === sec) a.setAttribute('aria-current', 'page'); });

    /* menu button -> drawer; other [data-modal] still open the legacy modal */
    const drawer = buildDrawer();
    buildStickyNav(drawer);
    const modal = $('.modal');
    $$('[data-modal]').forEach(x => x.addEventListener('click', e => {
      e.preventDefault();
      if (x.classList.contains('menu')) drawer.open(); else if (modal) modal.classList.add('open');
    }));
    $$('[data-close]').forEach(x => x.addEventListener('click', () => modal && modal.classList.remove('open')));
    if (modal) {
      modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('open'); });
      document.addEventListener('keydown', e => { if (e.key === 'Escape') modal.classList.remove('open'); });
    }

    $$('[data-site-footer]').forEach(f => { f.className = 'site-footer'; f.innerHTML = HB.footerHTML; });
    HB.renderShelves();
    HB.prettyPrices();
    $$('.topbar .nav').forEach(n => n.insertBefore(HB.langSwitch(), n.querySelector('.button')));
    $$('.sn-links').forEach(n => n.insertBefore(HB.langSwitch(), n.querySelector('.button')));
    $$('.drawer-top').forEach(n => n.insertBefore(HB.langSwitch(), n.querySelector('.drawer-close')));
    HB.translate();
    HB.watchTranslate();
    $$('[data-finder]').forEach(h => {
      if (!h.dataset.manual) HB.finder(h);
    });
    document.dispatchEvent(new CustomEvent('hb-ready'));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
