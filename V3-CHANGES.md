# HOMES/BKK v3 — what changed from v2

v2 (the folder one level up) is untouched. Open `v3/index.html` to see this version.

## Structure and navigation
- **One menu on every public page:** Collections · Homes · Spaces · Projects · Journal · Submit a home. The current page is underlined.
- **"Homes" and "Marketplace" were the same thing** — now just *Homes* (`marketplace.html`). `homes.html` redirects there, and its invented "verified owner · confirmed today" listings are gone.
- **The mobile MENU button now opens a real menu** (it used to open a placeholder popup).
- Fixed the dead `collections.html#quiet-city` anchor and the dead `index.html#journal` link.

## Home page (magazine order)
Hero → **search bar** → **category shelf** → The Bangkok Edit (cover story) → journal → *Homes just added* → owner CTA → footer.
- Removed the duplicated "More ways into a home" row and the internal "how the prototype is becoming a marketplace" block (the partner walkthrough is now a small link in the footer).
- Hero headline tracking loosened so letters no longer touch.

## Categories
Categories come from **tags in `homes-data.js`**. Each home lists the tags it earns; shelves, counts, filters and the search bar all read from that one file.
- Axes: *How you live* (pet-friendly, work-from-home, quiet, city views, family) · *Where it sits* (near BTS, riverside, central) · *The building* (low-rise, high-rise).
- A category with homes becomes an image tile. A category with none shows as a dashed "Collecting next" chip that links to Submit a home. Nothing is invented to fill a shelf.
- **To add a home:** add one object to `HB.HOMES`. To tag it, add the tag only if the fact is supplied or verified.
- Sponsored placement has its own labelled section on `collections.html` and is deliberately empty today.

## Search bar
One component (`HB.finder` in `shared.js`) used on Home and Homes: Where · Looking to · A home that is. Option counts come from the data. On Homes it filters live, shows removable filter pills, supports links like `marketplace.html?tag=pet-friendly&intent=buy`, and the sidebar only holds what the bar doesn't (bedrooms, setting, building type).

## Honesty fixes
- Illustrative records now say "Illustrative record · Not a live listing" instead of "Verified source · Confirmed today".
- The Quiet City page no longer claims "Eight homes" — the count is computed (currently 4) and its stock photos were replaced with the supplied property photos.
- The Ramada photo used as the journal backdrop is credited on the page.

## Not changed
`agent-maya.html` still uses Unsplash stock photos. Budget filtering is not built (listings have no numeric price field yet).
