/* HOMES/BKK — single source of truth for the prototype's homes and categories.
   To add a home: add one object to HB.HOMES. Shelves, counts, filters and cards update themselves.
   Only tag a home when the fact is supplied or verified — an untagged home simply doesn't appear in that shelf. */
window.HB = window.HB || {};

/* Category axes. `group` decides which shelf a tag lives in. */
HB.GROUPS = {
  life:     { label: 'How you live',       shelfTitle: 'Ways to live' },
  setting:  { label: 'Where it sits',      shelfTitle: 'Where it sits' },
  building: { label: 'The building',       shelfTitle: 'The building' }
};

HB.TAGS = {
  'pet-friendly':   { group: 'life',     label: 'Pet-friendly city homes', short: 'Pet-friendly',   img: 'assets/tristan-condo/tristan-living-dog.jpg',       alt: 'Dog resting on the living room rug at Tristan Condo' },
  'work-from-home': { group: 'life',     label: 'Work-from-home ready',    short: 'Work from home', img: 'assets/tristan-condo/tristan-home-office.jpg',      alt: 'Home office in the second bedroom at Tristan Condo' },
  'quiet':          { group: 'life',     label: 'The quiet city',          short: 'Quiet city',     img: 'assets/lumpini24/lumpini24-02.jpg',                 alt: 'Bright living room with a sofa, rug and balcony door' },
  'city-view':      { group: 'life',     label: 'Homes with a view',       short: 'City views',     img: 'assets/hyde-sukhumvit-11/hyde-bedroom-view.jpg',    alt: 'Bedroom looking out over the Bangkok skyline' },
  'family':         { group: 'life',     label: 'Room for a family',       short: 'Family',         img: 'assets/burasiri/burasiri-15.jpg',                   alt: 'Two-storey house across a green lawn at Burasiri Watcharapol' },
  'bts':            { group: 'setting',  label: 'Walk to the BTS',         short: 'Near BTS',       img: 'assets/hyde-sukhumvit-11/hyde-kitchen-living.jpg',  alt: 'Open-plan living and kitchen with a skyline window' },
  'riverside':      { group: 'setting',  label: 'By the river',            short: 'Riverside',      img: 'assets/mandarin/mandarin-16.jpg',                   alt: 'Balcony looking down the Chao Phraya river' },
  'central':        { group: 'setting',  label: 'Central Bangkok',         short: 'Central',        img: null },
  'low-rise':       { group: 'building', label: 'Low-rise living',         short: 'Low-rise',       img: 'assets/w8-88-86/w8-88-86-05.jpg',                   alt: 'Duplex living room with a glass-sided staircase' },
  'high-rise':      { group: 'building', label: 'High-rise living',        short: 'High-rise',      img: 'assets/nye/nye-06.jpg',                             alt: 'Wide sky and city view from a high balcony' }
};

HB.AREAS = {
  sukhumvit: 'Sukhumvit & Phrom Phong',
  sathorn:   'Sathorn & Silom',
  thonglor:  'Thonglor & Ekkamai',
  thonburi:  'Riverside & Thonburi',
  saimai:    'Sai Mai & outer Bangkok'
};

/* Every record below is a real supplied-photo home. Prices and facts come from the owner or listing team and are
   labelled "pending" where not yet supplied. concept:true would mark an illustrative record (none at present). */
/* geo / geoR: an AREA-level point and the radius (metres) of the circle drawn around it. Never an exact address.
   Tristan Condo and Ramada Plaza have none yet and are listed as "location to be pinned" on the map.
   Points for Mandarin Oriental, Nye, Lumpini 24 and Sukhothai come from public listing pages / landmarks and should be
   confirmed by an owner; Hyde, W8 and Burasiri are rougher (larger circles) until an owner pins them. */
HB.HOMES = [
  { id: 'tristan', concept: false,
    href: 'property-tristan-condo.html', img: 'assets/tristan-condo/tristan-living-dog.jpg',
    alt: 'Tristan Condo living room with a dog',
    title: 'A pet-friendly two-bedroom, Tristan Condo', place: 'Tristan Condo',
    badge: 'Supplied photography / pet-friendly',
    price: '฿9.89M · for sale', intents: ['buy'], beds: 2, area: null,
    meta: ['2 beds · 99.91 sqm · floor 3 · fully furnished', 'Unit 11/16 · real supplied photography'],
    trust: ['Availability to re-check', 'Source to verify'],
    tags: ['quiet', 'pet-friendly', 'work-from-home'] },

  { id: 'mandarin', concept: false,
    geo: [13.7267, 100.5104], geoR: 500,
    href: 'property-mandarin-oriental-residences.html', img: 'assets/mandarin/mandarin-08.jpg',
    alt: 'Living room at The Residences at Mandarin Oriental with the Chao Phraya river view',
    title: 'A river home for the big nights, Mandarin Oriental Residences', place: 'The Residences at Mandarin Oriental, Bangkok',
    badge: 'Supplied photography / riverside',
    price: '฿70M · for sale', intents: ['buy'], beds: 2, area: 'thonburi',
    meta: ['2 beds · 151 sqm · floor 11', 'Unit 289/21 · baths to confirm'],
    trust: ['Availability to re-check', 'Source to verify'],
    tags: ['riverside', 'high-rise', 'city-view'] },

  { id: 'nye', concept: false,
    geo: [13.7217, 100.4979], geoR: 600,
    href: 'property-nye-by-sansiri.html', img: 'assets/nye/nye-22.jpg',
    alt: 'Living room at Nye by Sansiri with a leather sofa and balcony doors',
    title: 'Bought for the view, Nye by Sansiri', place: 'Nye by Sansiri',
    badge: 'Supplied photography / high floor',
    price: '฿4.99M · for sale', intents: ['buy'], beds: null, area: 'thonburi',
    meta: ['High floor · size and layout pending', 'Beside BTS Wongwian Yai · view per owner'],
    trust: ['Availability to re-check', 'Source to verify'],
    tags: ['city-view', 'high-rise', 'bts'] },

  { id: 'w8-88-88', concept: false,
    geo: [13.7345, 100.583], geoR: 900,
    href: 'property-w8-thonglor-88-88.html', img: 'assets/w8-88-88/w8-88-88-33.jpg',
    alt: 'Living and dining room with a round white sofa at W8 Thonglor',
    title: 'Two floors, five bedrooms, W8 Thonglor 88/88', place: 'W8 Thonglor, Unit 88/88',
    badge: 'Supplied photography / low-rise',
    price: '฿25M sale · ฿65,000–80,000 / month rent', intents: ['buy', 'rent'], beds: 5, area: 'thonglor',
    meta: ['3 + 2 beds, or 5 joined · 221.59 sqm · floors 6–7', 'Unit 88/88 · rent by floor · dogs up to 20 kg'],
    trust: ['Availability to re-check', 'Staircase to confirm'],
    tags: ['pet-friendly', 'low-rise', 'family', 'city-view'] },

  { id: 'w8-88-86', concept: false,
    geo: [13.7345, 100.583], geoR: 900,
    href: 'property-w8-thonglor-88-86.html', img: 'assets/w8-88-86/w8-88-86-12.jpg',
    alt: 'Duplex living room with a glass-sided staircase at W8 Thonglor',
    title: 'A duplex with the staircase open, W8 Thonglor 88/86', place: 'W8 Thonglor, Unit 88/86',
    badge: 'Supplied photography / duplex',
    price: '฿16M · for sale', intents: ['buy'], beds: null, area: 'thonglor',
    meta: ['180.49 sqm · floors 4–5 · bedrooms pending', 'Unit 88/86 · sale only · dogs up to 20 kg'],
    trust: ['Availability to re-check', 'Bedrooms to confirm'],
    tags: ['pet-friendly', 'low-rise'] },

  { id: 'burasiri', concept: false,
    geo: [13.91, 100.65], geoR: 2500,
    href: 'property-burasiri-watcharapol.html', img: 'assets/burasiri/burasiri-16.jpg',
    alt: 'Two-storey house with a lawn and a covered terrace at Burasiri Watcharapol',
    title: 'A five-bedroom house with a lawn, Burasiri Watcharapol', place: 'Burasiri Watcharapol',
    badge: 'Supplied photography / house',
    price: '฿22.5M · for sale', intents: ['buy'], beds: 5, area: 'saimai',
    meta: ['5 beds · 5 baths · 288 sqm · plot 494.80 sqm', 'House 55/71 · 2 storeys'],
    trust: ['Availability to re-check', 'Source to verify'],
    tags: ['family'] },

  { id: 'lumpini24', concept: false,
    geo: [13.7223, 100.566], geoR: 500,
    href: 'property-lumpini-24.html', img: 'assets/lumpini24/lumpini24-12.jpg',
    alt: 'Living and dining room at The Lumpini 24 with a white pendant lamp',
    title: 'Styled with care, The Lumpini 24', place: 'The Lumpini 24',
    badge: 'Supplied photography / city view',
    price: '฿9.99M · for sale', intents: ['buy'], beds: null, area: 'sukhumvit',
    meta: ['Size, floor and layout pending', 'Sukhumvit 24 · about 0.9 km to Phrom Phong BTS'],
    trust: ['Availability to re-check', 'Unit facts to verify'],
    tags: ['city-view', 'high-rise'] },

  { id: 'sukhothai', concept: false,
    geo: [13.7214, 100.5415], geoR: 500,
    href: 'property-the-sukhothai-residences.html', img: 'assets/the-sukhothai-residences/sukhothai-living-hero.jpg',
    alt: 'The Sukhothai Residences double-height living room',
    title: 'Double-height living, The Sukhothai Residences', place: 'The Sukhothai Residences',
    badge: 'Supplied photography / terms to re-check',
    price: '฿56M sale · ฿250,000 / month rent', intents: ['buy', 'rent'], beds: 2, area: 'sathorn',
    meta: ['2 beds · size and floor pending confirmation', 'Real supplied photography · supplied asking terms'],
    trust: ['Availability to re-check', 'Source to verify'],
    tags: ['city-view'] },

  { id: 'hyde', concept: false,
    geo: [13.741, 100.5563], geoR: 800,
    href: 'property-hyde-sukhumvit-11.html', img: 'assets/hyde-sukhumvit-11/hyde-living-hero.jpg',
    alt: 'Hyde Sukhumvit 11 living room and skyline',
    title: 'City-facing living, Hyde Sukhumvit 11', place: 'Hyde Sukhumvit 11',
    badge: 'Supplied photography / terms pending',
    price: 'Terms pending verification', intents: [], beds: null, area: 'sukhumvit',
    meta: ['Unit facts pending · Sukhumvit 11', 'Real supplied photography'],
    trust: ['Source to verify', 'Facts pending'],
    tags: ['bts', 'city-view'] },

  { id: 'ramada', concept: false,
    href: 'property-ramada-plaza.html', img: 'assets/ramada-plaza-by-wyndham/ramada-living-storage.jpg',
    alt: 'Ramada Plaza by Wyndham double-height living room with a glass mezzanine',
    title: 'A double-height residence, Ramada Plaza', place: 'Ramada Plaza by Wyndham',
    badge: 'Supplied photography / terms pending',
    price: 'Terms pending verification', intents: [], beds: null, area: null,
    meta: ['Duplex-style home · unit facts pending', 'Real supplied photography'],
    trust: ['Source to verify', 'Facts pending'],
    tags: ['quiet'] }
];
