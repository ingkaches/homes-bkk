/* HOMES/BKK: published listings from the listing system -> the same HB.HOMES the static homes live in.
   Load after homes-data.js and before shared.js. Reads a cached copy synchronously (so cards render on first paint),
   then refreshes in the background and re-renders if anything changed. */
(function () {
  'use strict';
  const HB = window.HB = window.HB || {};
  const C = window.HB_CONFIG || {};
  const LIVE = !!(C.endpoint && /^https:\/\//.test(C.endpoint));
  const TH = (function () { try { return localStorage.getItem('hb-lang') === 'th' || /[?&]lang=th/.test(location.search); } catch (e) { return /[?&]lang=th/.test(location.search); } })() && !/[?&]lang=en/.test(location.search);
  const KEY = LIVE ? 'hb-pub-cache' : 'hb-demo-pub';
  HB.listingMode = LIVE ? 'live' : 'demo';

  HB.extraAreas = { rama9: 'Rama 9, Ratchada & Huai Khwang', ari: 'Ari & Phaya Thai', bangna: 'Bangna & On Nut', other: 'Elsewhere in Greater Bangkok' };
  HB.extraAreasTh = { rama9: 'พระราม 9 รัชดาฯ ห้วยขวาง', ari: 'อารีย์ พญาไท', bangna: 'บางนา อ่อนนุช', other: 'พื้นที่อื่นในกรุงเทพฯ และปริมณฑล' };

  let demoFiles = null;
  HB.photo = function (id, w) {
    id = String(id || '');
    if (!id) return '';
    if (/^(data:|https?:|assets\/)/.test(id)) return id;
    if (!LIVE) {
      if (!demoFiles || !demoFiles[id]) { try { demoFiles = JSON.parse(localStorage.getItem('hb-demo-files') || '{}'); } catch (e) { demoFiles = {}; } }
      return demoFiles[id] || '';
    }
    return String(C.photoUrl || '').replace('{id}', encodeURIComponent(id)).replace('{w}', w || 900);
  };

  const esc = s => String(s === null || s === undefined ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  HB.esc = HB.esc || esc;
  HB.unesc = HB.unesc || (s => { const t = document.createElement('textarea'); t.innerHTML = String(s === null || s === undefined ? '' : s); return t.value; });
  const num = n => Number(n).toLocaleString('en-US');
  function money(n) { return n >= 1e6 ? '฿' + String(+(n / 1e6).toFixed(2)) + 'M' : '฿' + num(n); }
  function priceText(p) {
    const buy = p.intents.includes('buy') && p.price_sale, rent = p.intents.includes('rent') && p.price_rent;
    const sale = buy ? money(p.price_sale) + ' · for sale' : '', mo = rent ? '฿' + num(p.price_rent) + ' / month' + (buy ? '' : ' · rent') : '';
    return buy && rent ? sale + ' · ' + mo.replace(' · rent', '') + ' rent' : (sale || mo);
  }
  const TYPE_TH = { Condo: 'คอนโด', House: 'บ้านเดี่ยว', Townhome: 'ทาวน์โฮม', Duplex: 'ดูเพล็กซ์', Penthouse: 'เพนต์เฮาส์', Villa: 'วิลล่า', Other: 'อื่นๆ' };
  const FURN = { fully: ['Fully furnished', 'เฟอร์นิเจอร์ครบ'], partly: ['Partly furnished', 'เฟอร์นิเจอร์บางส่วน'], none: ['Unfurnished', 'ไม่มีเฟอร์นิเจอร์'] };
  HB.ago = function (ts) {
    const m = /^(\d{4})-(\d\d)-(\d\d) (\d\d):(\d\d):(\d\d)$/.exec(String(ts || ''));
    if (!m) return '';
    const d = Math.floor((Date.now() - Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] - 7, +m[5], +m[6])) / 86400000);
    if (TH) return d <= 0 ? 'วันนี้' : d + ' วันก่อน';
    return d <= 0 ? 'today' : d === 1 ? 'yesterday' : d + ' days ago';
  };

  function toHome(p) {
    const beds = (p.beds === null || p.beds === undefined) ? null : p.beds;
    const bedsTxt = beds === null ? '' : beds === 0 ? (TH ? 'สตูดิโอ' : 'Studio') : (TH ? beds + ' ห้องนอน' : beds + (beds === 1 ? ' bed' : ' beds'));
    const parts = [bedsTxt, p.size ? p.size + (TH ? ' ตร.ม.' : ' sqm') : '', p.floor ? (TH ? 'ชั้น ' : 'floor ') + p.floor : ''].filter(Boolean);
    const type = TH ? (TYPE_TH[p.type] || p.type) : p.type;
    const fur = p.furnished ? FURN[p.furnished][TH ? 1 : 0] : '';
    const by = esc(p.by || 'HOMES/BKK');
    return {
      id: p.id, concept: false, live: true, href: 'listing.html?id=' + encodeURIComponent(p.id),
      img: esc(HB.photo(p.photos[0], 900) || 'assets/mandarin/mandarin-08.jpg'), alt: esc(p.title),
      title: esc((TH && p.title_th) || p.title), place: esc(p.place),
      badge: TH ? 'ลงโดย ' + by : 'Listed by ' + by,
      price: priceText(p), intents: p.intents.slice(), beds: beds, area: p.area || null,
      meta: [esc(parts.join(' · ')), esc([type, fur, p.pets ? (TH ? 'เลี้ยงสัตว์ได้' : 'Pets welcome') : ''].filter(Boolean).join(' · '))],
      trust: [(TH ? 'ยืนยันล่าสุด ' : 'Confirmed ') + HB.ago(p.confirmed_at || p.published_at)],
      tags: (p.tags || []).filter(t => HB.TAGS[t]),
      geo: typeof p.lat === 'number' ? [p.lat, p.lng] : null, geoApprox: true
    };
  }

  function readCache() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; } }
  HB.listings = readCache();     // raw public records, newest first
  HB.listingsReady = !LIVE;

  function apply(list) {
    HB.listings = list;
    HB.HOMES = list.filter(p => p && p.id && p.photos && p.photos.length).map(toHome).concat(HB.HOMES.filter(h => !h.live));
    list.forEach(p => { if (p.area && !HB.AREAS[p.area] && HB.extraAreas[p.area]) HB.AREAS[p.area] = TH ? HB.extraAreasTh[p.area] : HB.extraAreas[p.area]; });
  }
  apply(HB.listings);

  /* Always hand back a fresh array: used by map.html and listing.html. */
  HB.fetchPublic = function () {
    if (!LIVE) return Promise.resolve(readCache());
    return fetch(C.endpoint + '?action=listings').then(r => r.json()).then(j => {
      if (!j || !j.ok) throw new Error('bad');
      return j.listings;
    });
  };
  HB.refreshListings = function () {
    return HB.fetchPublic().then(list => {
      const before = JSON.stringify(readCache()), after = JSON.stringify(list);
      HB.listingsReady = true;
      if (LIVE) { try { localStorage.setItem(KEY, after); } catch (e) { /* quota: fine */ } }
      if (before !== after) {
        apply(list);
        if (HB.renderShelves && document.readyState !== 'loading') HB.renderShelves();
        document.dispatchEvent(new CustomEvent('hb-listings', { detail: list }));
      }
      return list;
    }).catch(() => { HB.listingsReady = true; return HB.listings; });
  };
  if (LIVE) HB.refreshListings();
})();
