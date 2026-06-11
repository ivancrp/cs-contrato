import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCatalogFromApiSkins, SKINS_API_URL, type ApiSkin } from '../src/data/buildCatalog';

async function syncCatalog(): Promise<void> {
  const response = await fetch(SKINS_API_URL);
  if (!response.ok) {
    throw new Error(`Falha ao baixar catálogo: HTTP ${response.status}`);
  }

  const apiSkins = (await response.json()) as ApiSkin[];
  const collections = buildCatalogFromApiSkins(apiSkins);

  const totalSkins = collections.reduce((sum, col) => sum + col.items.length, 0);
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const outputPath = join(__dirname, '../src/data/catalog.json');

  writeFileSync(outputPath, `${JSON.stringify(collections, null, 2)}\n`, 'utf8');

  console.log(`Catálogo sincronizado: ${collections.length} coleções, ${totalSkins} skins.`);
  console.log(`Arquivo: ${outputPath}`);
}

syncCatalog().catch((error) => {
  console.error('Erro ao sincronizar catálogo:', error);
  process.exit(1);
});
