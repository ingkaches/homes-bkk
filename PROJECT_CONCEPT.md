# HOMES/BKK — Project Concept

## One-line definition

**HOMES/BKK is a Bangkok-first curated property marketplace with a small expert-agent/concierge layer: a place to discover homes through strong photography and editorial judgement, then make a practical decision through clear facts, availability checks and viewing support.**

It should feel like **“a warm city magazine you can act on”** — not a generic classifieds portal and not a brokerage landing page.

---

## Why it exists

Bangkok already has large property portals with extensive inventory. HOMES/BKK does **not** try to win by publishing the most listings.

It aims to win through:

- **Curation:** fewer homes, selected for genuine quality, character and relevance.
- **Presentation:** real, well-considered photography and editorial framing.
- **Trust:** price, availability, source and unit facts are visibly separated into confirmed vs. still-to-check information.
- **Useful discovery:** people can browse by practical needs and lifestyle — e.g. pet-friendly, work-from-home, quieter living, light, views — as well as normal search filters.
- **Human service:** a small team helps confirm availability and coordinate viewings rather than asking a visitor to chase unreliable listing contacts.

The initial market is **Bangkok**, beginning with high-quality residential listings and project areas where a small team can personally maintain quality and freshness.

---

## Product model

### 1. Marketplace

The Marketplace is the practical browse-and-compare layer.

Each listing should eventually expose:

- property/project identity and listing ID;
- sale or rental asking terms;
- bedroom count, size, floor and furnishing state where supplied and verified;
- availability freshness;
- source/right-to-market status;
- real supplied photography or verified professional photography;
- a route to request a private viewing.

This is where users make a decision with facts. It must not disguise unknown data as verified information.

### 2. Collections

Collections are editorial groupings, not renamed filters and not paid placement.

Examples:

- Pet-friendly city homes
- Work-from-home ready
- The Quiet City
- Homes with a View
- Move-in ready rentals

A collection should explain **why** a home belongs, show the selection criteria, and lead into the named listing records. It creates desirability and context; Marketplace remains the place for detailed comparison.

### 3. Spaces

Spaces is visual discovery. A visitor can start with light, material, balcony life, calm, views or day-to-day feeling before they know a specific project name.

It should always lead back to a real listing or marketplace result rather than becoming a moodboard with no product action.

### 4. Project guides

A project guide helps a visitor understand a building before choosing a unit.

When data is available, it should include building facts, facilities, setting, policies, current units and clear distinction between editorial commentary and verified information.

### 5. Viewing and concierge layer

The agent/concierge layer is a trust and coordination service, not the main visual product.

Before a viewing is confirmed, the team should re-check:

- asking price and transaction terms;
- current availability;
- source/right-to-market;
- practical viewing constraints;
- any important claim such as pet policy.

The intended service promise is: **no one should travel to see a home before the unit has been rechecked.**

### 6. Owner / agent supply flow

Owners and agents can submit homes, but publishing is review-gated.

The long-term quality ladder is:

1. Submit Listing
2. Verified Listing
3. Curated Feature
4. Optional Media Package
5. Future Concierge support

Editorial selection must remain independent. A paid production or visibility service cannot buy entry into an Editor’s Pick or Collection. Any future sponsored placement must be visibly labelled.

---

## Current prototype

This repository contains a clickable partner-facing prototype, not a deployed live marketplace.

Location:

`design-prototypes/homes-bkk-v2/`

Key routes:

- `index.html` — Home / brand impression, discovery and real-listing showcase
- `marketplace.html` — searchable concept inventory with filters, source/status signals and saved states
- `collections.html` — editorial collection logic and featured listing paths
- `spaces.html` — visual/lifestyle-led discovery
- `projects.html` — project-guide concept
- `property-tristan-condo.html` — named supplied-photo listing record
- `property-the-sukhothai-residences.html` — named supplied-photo sale/rent record
- `property-hyde-sukhumvit-11.html` — named supplied-photo record with pending commercial verification
- `book-viewing.html` — viewing-request flow
- `the-home-edit.html` — owner/agent submission proposition
- `partner-demo.html` — guided partner walkthrough

---

## Real photography and listing-data policy

The prototype is gradually replacing generic stock photography with real property images supplied by the project owner/agents.

### Rules

1. **A real photo set belongs to one named property identity.** Do not use it as the imagery for an unrelated fake listing.
2. **Do not invent facts.** Unknown size, floor, price, bath count, availability, agent, ownership or right-to-market must be marked pending rather than guessed.
3. **Supplied facts may be shown as supplied.** For example, a supplied asking price, size or furnishing state may be visible, but must not imply it is live-confirmed inventory.
4. **Source and availability must be rechecked** before treating a record as public/live or confirming a viewing.
5. **Collections are not advertisements.** A listing appears because it fits the editorial criteria, not because someone paid.

Useful disclosure language:

- `Real supplied photography · facts pending source verification`
- `Supplied asking terms · availability to re-check`
- `Source to verify`
- `Concept record`

---

## Current named inventory records

These are prototype records built from supplied photography and only the facts provided to the project.

| Property | Supplied facts shown | Important status |
|---|---|---|
| Tristan Condo Petfriendly | Unit 11/16, floor 3, 2 bedrooms, 99.91 sqm, fully furnished, pet-friendly, asking ฿9.89M | Availability and source/right-to-market pending re-check |
| The Sukhothai Residences | 2 bedrooms, sale ฿56M, rent ฿250,000/month | Remaining unit facts, availability and source/right-to-market pending re-check |
| Hyde Sukhumvit 11 | Real supplied photography | Commercial/unit facts pending verification |
| Lumpini / Sukhumvit concept record | Real supplied photography attached to a transitional concept record | Listing facts are concept-only and require identity cleanup before live use |
| W 8 Thonglor supplied photo sets | Separate 3-bedroom and 5-bedroom supplied sets exist | Must remain distinct; final routes and verified terms still need to be built |
| Mandarin Oriental Residences Bangkok | 2 bedrooms, supplied asking context ฿70M | Needs its own distinct listing route and remaining facts/source verification |

---

## Visual direction

The visual system is intentionally not black-and-gold luxury portal styling.

- **Core:** bright warm editorial/gallery foundation — cream, muted moss, deep green, readable serif headlines and clean sans-serif body text.
- **Typography:** Playfair Display for editorial display headings; DM Sans for readable body/product text; DM Mono only for compact labels, IDs and status.
- **Photography:** full-bleed real listing imagery wherever possible.
- **Dark cinematic material:** used only as an occasional Bangkok-after-rain editorial interruption, not the entire product theme.
- **Home page:** should be a long, rich showcase — brand impression, current named inventory, collection entry points, visual discovery and a clear owner proposition.

---

## What this project is not

- Not a high-volume nationwide classifieds portal.
- Not a generic agent landing page.
- Not a moodboard with no search, facts or actions.
- Not a system that labels unverified property data as live.
- Not a marketplace where editorial placement can be secretly purchased.

---

## Definition of a successful first version

A strong MVP does not require thousands of listings.

It should prove that a visitor can:

1. arrive on a memorable, credible Bangkok property homepage;
2. browse a small number of genuinely distinct homes;
3. understand why a home was selected;
4. see transparent pricing/fact/source status;
5. request a viewing through a clearly accountable host;
6. trust that the home will be rechecked before they invest time travelling.

For supply, it should prove that a high-quality owner or agent can see why thoughtful photography, reliable listing facts and editorial presentation are more valuable than simply posting the same unit to another bulk portal.
