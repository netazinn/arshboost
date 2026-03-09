-- ─────────────────────────────────────────────────────────────────────────────
-- ArshBoost — Seed Data (Development)
-- ─────────────────────────────────────────────────────────────────────────────

-- Games
insert into games (name, slug, logo_url, display_order) values
  ('Valorant',                'valorant',          '/images/games/valorant.svg', 1),
  ('League of Legends',       'league-of-legends', '/images/games/lol.svg',      2),
  ('Apex Legends',            'apex-legends',      '/images/games/apex.svg',     3),
  ('TFT: Team Fight Tactics', 'tft',               '/images/games/tft.svg',      4)
on conflict (slug) do nothing;

-- League of Legends services
insert into games_services (game_id, type, label, base_price) values
  ((select id from games where slug = 'league-of-legends'), 'rank_boost',          'Rank Boost',          10.00),
  ((select id from games where slug = 'league-of-legends'), 'win_boost',           'Win Boost',            0.00),
  ((select id from games where slug = 'league-of-legends'), 'duo_boost',           'Duo Boost',           13.00),
  ((select id from games where slug = 'league-of-legends'), 'placement_matches',   'Placement Matches',    0.00)
on conflict (game_id, type) do nothing;

-- Valorant services
insert into games_services (game_id, type, label, base_price) values
  ((select id from games where slug = 'valorant'), 'rank_boost',         'Rank Boost',          12.00),
  ((select id from games where slug = 'valorant'), 'win_boost',          'Win Boost',            0.00),
  ((select id from games where slug = 'valorant'), 'duo_boost',          'Duo Boost',           15.00),
  ((select id from games where slug = 'valorant'), 'unrated_matches',    'Unrated Matches',      0.00),
  ((select id from games where slug = 'valorant'), 'placement_matches',  'Placement Matches',    0.00)
on conflict (game_id, type) do nothing;

-- TFT services
insert into games_services (game_id, type, label, base_price) values
  ((select id from games where slug = 'tft'), 'rank_boost',   'Rank Boost',   9.00),
  ((select id from games where slug = 'tft'), 'win_boost',    'Win Boost',    0.00)
on conflict (game_id, type) do nothing;

-- Apex Legends services
insert into games_services (game_id, type, label, base_price) values
  ((select id from games where slug = 'apex-legends'), 'rank_boost', 'Rank Boost', 11.00),
  ((select id from games where slug = 'apex-legends'), 'win_boost',  'Win Boost',   0.00)
on conflict (game_id, type) do nothing;
