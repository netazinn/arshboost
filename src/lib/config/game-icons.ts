/**
 * Central game icon registry.
 * All icons are served from /public/icons/ (sourced from a third-party CDN).
 * Update paths here — both GameCard and ClientOrdersView read from this file.
 */
export const GAME_ICONS: Record<string, string> = {
  // GameCard uses slugs (lowercase, hyphenated)
  'valorant':          '/icons/valorant.png',
  'league-of-legends': '/icons/league-of-legends.png',
  'apex-legends':      '/icons/apex-legends.png',
  'tft':               '/icons/tft.png',

  // ClientOrdersView uses display names
  'Valorant':          '/icons/valorant.png',
  'League of Legends': '/icons/league-of-legends.png',
  'Apex Legends':      '/icons/apex-legends.png',
  'TFT':               '/icons/tft.png',
}
