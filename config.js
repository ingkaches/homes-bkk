/* Site settings. Leave endpoint empty to keep the prototype behaviour (forms send nothing; the portal runs in demo mode).
   To go live: deploy backend/Code.gs + Portal.gs as a web app and paste its /exec URL here. */
window.HB_CONFIG = {
  endpoint: '',
  /* Map. Default tiles are OpenStreetMap's public server: fine for testing, not for real traffic.
     Before launch, switch to a paid tile provider (MapTiler, Stadia, Mapbox...) by changing the next two lines. */
  mapTiles: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  mapAttribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  mapCenter: [13.7367, 100.5560],
  mapZoom: 12,
  mapCircleMeters: 500,      /* radius of the "approximate location" circle on public maps */
  placeSearch: true,         /* portal: search a place name with Nominatim (OpenStreetMap). false = lat/lng and click only */
  /* Where listing photos are served from. {id} is the Google Drive file id, {w} the width. */
  photoUrl: 'https://lh3.googleusercontent.com/d/{id}=w{w}'
};
if (window.HB_CONFIG.endpoint && /^https:\/\//.test(window.HB_CONFIG.endpoint)) {
  document.documentElement.classList.add('hb-live');
}
