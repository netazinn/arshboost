-- Update game logo_url from .webp to .svg
UPDATE games SET logo_url = '/images/games/lol.svg'      WHERE slug = 'league-of-legends';
UPDATE games SET logo_url = '/images/games/valorant.svg' WHERE slug = 'valorant';
UPDATE games SET logo_url = '/images/games/tft.svg'      WHERE slug = 'tft';
