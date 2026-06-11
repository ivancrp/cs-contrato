-- Skins como Gamma Doppler compartilham nome/variante com paint_index diferente
DROP INDEX IF EXISTS idx_skins_name_variant;

CREATE INDEX IF NOT EXISTS idx_skins_name_variant ON skins (name, stattrak, souvenir);
CREATE INDEX IF NOT EXISTS idx_skins_paint_index ON skins (paint_index);
