# HOMES/BKK v4 — what changed from v3

v3 is untouched; open `v4/index.html` to compare.

## New homes (all real supplied photography, each a magazine spread like Tristan)
| Page | Home | Price shown |
|---|---|---|
| `property-mandarin-oriental-residences.html` | The Residences at Mandarin Oriental, Unit 289/21 | ฿70M |
| `property-nye-by-sansiri.html` | Nye by Sansiri, high floor | ฿4.99M (read from "4.99MB") |
| `property-w8-thonglor-88-88.html` | W8 Thonglor 88/88, floors 6–7, 221.59 sqm | ฿25M sale · rent ฿65,000 (fl. 6) / ฿80,000 (fl. 7) |
| `property-w8-thonglor-88-86.html` | W8 Thonglor 88/86, floors 4–5, 180.49 sqm | ฿16M, sale only |
| `property-lumpini-24.html` | The Lumpini 24 | ฿9.99M (read from "9.99MB") |
| `property-burasiri-watcharapol.html` | Burasiri Watcharapol, house 55/71 | ฿22.5M |

- All six share `listing.css`. To make another spread, copy one page's structure.
- Unknown facts are marked **pending** (88/86 bedrooms, which W8 88/88 floor is the 3-bed, Lumpini and Nye size/layout). Owner or developer claims are attributed ("by the owner's account"). The Burasiri owner's reason for moving was not supplied and is not stated.
- Every story carries a "not yet reviewed by the owner" note and an empty "In the owner's own words" block.

## Site-wide
- **Lightbox**: clicking any gallery photo opens a full-screen viewer with arrows, swipe, keyboard (← → Esc), counter and close button. No more new tabs.
- **Sticky menu**: a slim bar slides in when you scroll up (any page that loads `shared.js`), including a MENU button on mobile.
- **Home hero** is now the Mandarin Oriental living room (brighter, with the river). The old dark Sukhothai hero was replaced.
- **Ramada Plaza** cover fixed: the old cover was actually a W8 Thonglor 88/86 room. It is no longer used on the Ramada page.
- **Submit a home** rebuilt as a working prototype form (validates, shows a summary to copy; nothing is sent or stored).
- **Spaces, Projects, Journal** rewritten with real content from the supplied homes. Projects only states facts found in public project information, and marks the rest "pending".
- Removed all illustrative homes (Sukhumvit 31, Atelia, Ekkamai, Asoke). They reused real photos from other homes with invented prices.
- Removed the stock-photo portrait on Maya's profile and other Unsplash images. One consistent host name (Maya Lertchai).
- Booking page reads `?home=` and shows the chosen home.
- Marketplace: the decorative fake map is replaced by an areas list.
- `property-sukhumvit.html` and `project-atelia.html` are now redirect stubs (safe to delete).

## Images
- Everything is compressed (JPEG, max 2200 px wide). Originals of the first batch are in `assets-original/` (not deployed, see `.vercelignore`).

## Before deploying
- Owner approval for each story. Mandarin Oriental is now 2 bed / 151 sqm as supplied; bathroom count still to confirm. W8 88/88 rents are read as per month.
- Confirm Nye's floor and view, and do not advertise short-term rental without checking building rules and Thai law.
- `partner-demo.html` and `agent-workspace.html` are internal; consider excluding them from the public deploy.

## Prices and language (latest)

- **Prices**: one price component site-wide (small ฿, large lining figures, small unit, muted note). ฿ is supplied by a tiny font file (`assets/fonts/baht-*.woff2`) because Playfair and DM Sans have no ฿ glyph. Figures are lining, not old-style.
- **EN | ไทย switch** in the header, sticky nav and mobile menu. Choice is remembered (or use `?lang=th`).
- **Thai is a dictionary layer** (`i18n-th.js`): exact English text → Thai. Anything without an entry stays English. Fully translated so far: home, Homes page, all home cards, the shared nav/footer/finder, and the Mandarin Oriental page. The home headline ("Find a place worth coming home to.") is intentionally kept in English.
- **Thai typography** lives at the end of `shared.css`: Noto Serif Thai (headings) and IBM Plex Sans Thai (text), no letter-spaced uppercase labels, taller line-height, drop cap off. Thai font files (`assets/fonts/th-*.woff2`, ~65 KB) are only fetched when a page shows Thai.
- Thai copy is a draft and needs a native read before launch.
- To add a page: add its English strings and Thai to `i18n-th.js` (generated from `gen/i18n.py` in the working copy).

## Thai: every page translated (second pass)
- `i18n-th.js` now holds ~870 Thai strings covering all public pages: all 10 listing pages and stories, Collections (+ The Quiet City), Journal, Spaces, Projects (+ Atelia), Submit form (The Home Edit), Book viewing flow and Maya's profile.
- Placeholders in forms and text drawn by CSS (hero badge, portrait label, sidebar photo label) are translated too (`shared.js`).
- Proper names (project names, Maya Lertchai, listing IDs) intentionally stay in English. Hero H1 on Home stays English.
- Internal pages `partner-demo.html` and `agent-workspace.html` are not translated; `property-sukhumvit.html` is an old stray file.
- All Thai copy is a draft and needs a native read before launch.

## Forms that really send (backend, off by default)
- `backend/Code.gs` is a Google Apps Script web app that files "Submit a home" and "Book a viewing" into a Google Sheet and emails a notification. Setup steps in Thai: `backend/README-TH.md`.
- `config.js` holds the endpoint. Empty = prototype behaviour exactly as before. With a URL the forms switch to live mode: honest wording, sending state, error handling that keeps what the visitor typed, reference number on the thank-you screen, consent checkbox on the viewing form.
- `forms.js` does the sending (`HB.send`). Live/prototype wording is switched with `data-live` / `data-proto` attributes.
- `node backend/test.js` runs 28 tests on the backend logic with in-memory stand-ins for Google services.
- Photos are not uploaded through the form; the live wording says they can be sent after we reply.
- Before going live: a privacy notice (PDPA), and decide who can open the sheet.

## Listing system: post from the website, roles, review, map

Full design and reasoning in `SYSTEM-DESIGN-TH.md`. In short:

- **Who can post:** by invitation only, three roles (admin / partner / agent) plus a per-person "trusted" flag that lets someone publish without review. Sign-in is an emailed 6-digit code, no passwords.
- **Flow:** draft → in review → live (or sent back with a reason) → archived. Editing a live listing sends it back to review unless the editor is trusted, or only the price changed. Listings not reconfirmed in 30 days get a reminder, in 60 days they are archived.
- **Backend:** `backend/Portal.gs` next to `Code.gs`. Public API sends only whitelisted fields. Exact pin, unit/address and owner contact never leave the server. Public map point is moved up to 200 m by a secret, stable offset and drawn as a ~500 m circle.
- **Pages:** `portal.html` (sign in, my listings, editor with photo upload and map picker, review queue, all listings, team, profile), `map.html`, `listing.html` (generic detail page for portal listings), `live.js` (puts published listings into the existing cards, Homes page and home page), Leaflet vendored in `assets/vendor/leaflet/`.
- **Demo mode:** with no `endpoint` in `config.js`, the portal runs the *real* backend code inside the browser (`demo-backend.js` is generated from `Code.gs` + `Portal.gs` by `gen/build_demo.py`), data in localStorage.
- **Map points for the ten existing homes** are area-level only (larger circles where I am less sure). Tristan Condo and Ramada Plaza have none yet. Confirm with the owners.
- **Tests:** `node backend/test-portal.js` (102 cases) and browser tests in both demo mode and against the real backend code.
- **Thai:** all new pages translated (portal strings are inline, map/listing strings are in `th2k`).
