-- Add display_order column for custom game ordering
ALTER TABLE games ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 99;

-- Update existing games
UPDATE games SET display_order = 1, name = 'Valorant'                WHERE slug = 'valorant';
UPDATE games SET display_order = 2                                    WHERE slug = 'league-of-legends';
UPDATE games SET display_order = 4, name = 'TFT: Team Fight Tactics' WHERE slug = 'tft';

-- Add Apex Legends
INSERT INTO games (name, slug, logo_url, is_active, display_order)
VALUES ('Apex Legends', 'apex-legends', '/images/games/apex.svg', true, 3)
ON CONFLICT (slug) DO NOTHING;

-- Add Apex Legends services
INSERT INTO games_services (game_id, type, label, base_price)
VALUES
  ((SELECT id FROM games WHERE slug = 'apex-legends'), 'rank_boost', 'Rank Boost', 11.00),
  ((SELECT id FROM games WHERE slug = 'apex-legends'), 'win_boost',  'Win Boost',   0.00)
ON CONFLICT (game_id, type) DO NOTHING;
