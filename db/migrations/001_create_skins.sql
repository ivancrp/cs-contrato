-- Catálogo de coleções e skins CS2 (trade-up)
CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS skins (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  weapon TEXT NOT NULL,
  collection_id TEXT REFERENCES collections (id) ON DELETE SET NULL,
  rarity TEXT NOT NULL CHECK (
    rarity IN (
      'consumer',
      'industrial',
      'mil-spec',
      'restricted',
      'classified',
      'covert',
      'extraordinary'
    )
  ),
  min_float NUMERIC(4, 3) NOT NULL DEFAULT 0,
  max_float NUMERIC(4, 3) NOT NULL DEFAULT 1,
  stattrak BOOLEAN NOT NULL DEFAULT FALSE,
  souvenir BOOLEAN NOT NULL DEFAULT FALSE,
  image_url TEXT,
  paint_index TEXT,
  source TEXT NOT NULL DEFAULT 'bymykel',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skins_name ON skins (name);
CREATE INDEX IF NOT EXISTS idx_skins_collection_id ON skins (collection_id);
CREATE INDEX IF NOT EXISTS idx_skins_rarity ON skins (rarity);
CREATE INDEX IF NOT EXISTS idx_skins_name_variant ON skins (name, stattrak, souvenir);
CREATE INDEX IF NOT EXISTS idx_skins_paint_index ON skins (paint_index);
