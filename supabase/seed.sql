-- Producer Network — genre/subgenre taxonomy seed
-- Hip hop gets the deepest coverage (launch scene: Irish hip hop/rap).
-- Adding a scene later is a plain insert here — no app release needed.
-- Re-runnable: on conflict do nothing.

insert into public.tag_options (id, label, kind, parent_id, sort_order) values
  ('hip-hop',     'Hip hop',      'genre', null, 1),
  ('rnb',         'R&B',          'genre', null, 2),
  ('pop',         'Pop',          'genre', null, 3),
  ('electronic',  'Electronic',   'genre', null, 4),
  ('afrobeats',   'Afrobeats',    'genre', null, 5),
  ('rock-indie',  'Rock / indie', 'genre', null, 6),
  ('latin',       'Latin',        'genre', null, 7),

  ('trap',            'Trap',                    'subgenre', 'hip-hop', 1),
  ('drill',           'Drill',                   'subgenre', 'hip-hop', 2),
  ('uk-drill',        'UK drill',                'subgenre', 'hip-hop', 3),
  ('irish-rap',       'Irish rap',               'subgenre', 'hip-hop', 4),
  ('boom-bap',        'Boom bap',                'subgenre', 'hip-hop', 5),
  ('atlanta',         'Atlanta sound',           'subgenre', 'hip-hop', 6),
  ('dmv',             'DMV',                     'subgenre', 'hip-hop', 7),
  ('memphis',         'Memphis',                 'subgenre', 'hip-hop', 8),
  ('grime',           'Grime',                   'subgenre', 'hip-hop', 9),
  ('cloud-rap',       'Cloud rap',               'subgenre', 'hip-hop', 10),
  ('sc-underground',  'SoundCloud underground',  'subgenre', 'hip-hop', 11),
  ('plugg',           'Plugg',                   'subgenre', 'hip-hop', 12),
  ('rage',            'Rage',                    'subgenre', 'hip-hop', 13),
  ('phonk',           'Phonk',                   'subgenre', 'hip-hop', 14),
  ('alt-hip-hop',     'Alternative hip hop',     'subgenre', 'hip-hop', 15),

  ('alt-rnb',    'Alt R&B',    'subgenre', 'rnb', 1),
  ('neo-soul',   'Neo-soul',   'subgenre', 'rnb', 2),
  ('trapsoul',   'Trapsoul',   'subgenre', 'rnb', 3),
  ('90s-rnb',    '90s R&B',    'subgenre', 'rnb', 4),

  ('hyperpop',     'Hyperpop',     'subgenre', 'pop', 1),
  ('indie-pop',    'Indie pop',    'subgenre', 'pop', 2),
  ('dance-pop',    'Dance pop',    'subgenre', 'pop', 3),
  ('bedroom-pop',  'Bedroom pop',  'subgenre', 'pop', 4),

  ('house',      'House',        'subgenre', 'electronic', 1),
  ('techno',     'Techno',       'subgenre', 'electronic', 2),
  ('uk-garage',  'UK garage',    'subgenre', 'electronic', 3),
  ('dnb',        'Drum & bass',  'subgenre', 'electronic', 4),
  ('jungle',     'Jungle',       'subgenre', 'electronic', 5),
  ('dubstep',    'Dubstep',      'subgenre', 'electronic', 6),
  ('ambient',    'Ambient',      'subgenre', 'electronic', 7),

  ('amapiano',     'Amapiano',     'subgenre', 'afrobeats', 1),
  ('afro-fusion',  'Afro-fusion',  'subgenre', 'afrobeats', 2),
  ('alte',         'Alté',         'subgenre', 'afrobeats', 3),

  ('indie-rock',  'Indie rock',  'subgenre', 'rock-indie', 1),
  ('alt-rock',    'Alt rock',    'subgenre', 'rock-indie', 2),
  ('pop-punk',    'Pop punk',    'subgenre', 'rock-indie', 3),
  ('shoegaze',    'Shoegaze',    'subgenre', 'rock-indie', 4),

  ('reggaeton',   'Reggaeton',   'subgenre', 'latin', 1),
  ('latin-trap',  'Latin trap',  'subgenre', 'latin', 2)
on conflict (id) do nothing;
