/* Sends the Submit and Book-a-viewing forms to the intake backend (backend/Code.gs).
   Without an endpoint in config.js the forms stay in prototype mode and HB.send is not called. */
(function () {
  const HB = (window.HB = window.HB || {});
  const C = window.HB_CONFIG || {};
  HB.live = !!(C.endpoint && /^https:\/\//.test(C.endpoint));

  /* kind: 'submission' | 'viewing'. Resolves to {ok, ref} or {ok:false, error, fields?}. Never rejects. */
  HB.send = async function (kind, data, honeypot) {
    if (!HB.live) return { ok: false, error: 'not_live' };
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    try {
      const res = await fetch(C.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },   // simple request: no CORS preflight
        body: JSON.stringify({
          kind, data, hp: honeypot || '',
          lang: document.documentElement.lang === 'th' ? 'th' : 'en',
          page: location.pathname.split('/').pop()
        }),
        signal: ctrl.signal
      });
      const out = await res.json();
      return out && typeof out === 'object' ? out : { ok: false, error: 'network' };
    } catch (e) {
      return { ok: false, error: e && e.name === 'AbortError' ? 'timeout' : 'network' };
    } finally {
      clearTimeout(timer);
    }
  };

  /* Plain-English message for a failed result. HB.translate turns it into Thai when needed. */
  HB.sendError = function (res) {
    if (res && res.error === 'rate_limited') return 'You have sent several requests in a short time. Please try again later.';
    if (res && res.error === 'validation') return 'Please check the highlighted fields and try again.';
    return 'We could not send this just now. Your details are still on this page. Please try again in a moment.';
  };
})();
