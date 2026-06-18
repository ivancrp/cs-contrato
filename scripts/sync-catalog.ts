import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchCatalog } from '@ct/parser';

async function syncCatalog(): Promise<void> {
  const { collections } = await fetchCatalog();
  const totalSkins = collections.reduce((sum, col) => sum + col.items.length, 0);
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const outputDir = join(__dirname, '../data');
  const outputPath = join(outputDir, 'catalog.json');

  mkdirSync(outputDir, { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(collections, null, 2)}\n`, 'utf8');

  console.log(`Catálogo sincronizado: ${collections.length} coleções, ${totalSkins} skins.`);
  console.log(`Arquivo: ${outputPath}`);
}

syncCatalog().catch((error) => {
  console.error('Erro ao sincronizar catálogo:', error);
  process.exit(1);
});
