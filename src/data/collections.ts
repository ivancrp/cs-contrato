import type { Collection } from '../models/types';

/**
 * Catálogo de coleções CS2 com dados representativos.
 * Preparado para substituição por API/banco no futuro.
 */
export const COLLECTIONS: Collection[] = [
  {
    id: 'revolution',
    name: 'The Revolution Collection',
    items: [
      { id: 'rev-p2000-urban-hazard', name: 'P2000 | Urban Hazard', weapon: 'P2000', collectionId: 'revolution', rarity: 'consumer', minFloat: 0, maxFloat: 1, stattrak: false },
      { id: 'rev-nova-dark-sigil', name: 'Nova | Dark Sigil', weapon: 'Nova', collectionId: 'revolution', rarity: 'consumer', minFloat: 0, maxFloat: 1, stattrak: false },
      { id: 'rev-dualberettas-hideout', name: 'Dual Berettas | Hideout', weapon: 'Dual Berettas', collectionId: 'revolution', rarity: 'industrial', minFloat: 0, maxFloat: 0.7, stattrak: false },
      { id: 'rev-mac10-light-box', name: 'MAC-10 | Light Box', weapon: 'MAC-10', collectionId: 'revolution', rarity: 'industrial', minFloat: 0, maxFloat: 1, stattrak: false },
      { id: 'rev-ump45-motorized', name: 'UMP-45 | Motorized', weapon: 'UMP-45', collectionId: 'revolution', rarity: 'mil-spec', minFloat: 0, maxFloat: 0.8, stattrak: false },
      { id: 'rev-scar20-fragments', name: 'SCAR-20 | Fragments', weapon: 'SCAR-20', collectionId: 'revolution', rarity: 'mil-spec', minFloat: 0, maxFloat: 1, stattrak: false },
      { id: 'rev-glock-vogue', name: 'Glock-18 | Vogue', weapon: 'Glock-18', collectionId: 'revolution', rarity: 'restricted', minFloat: 0, maxFloat: 0.75, stattrak: false },
      { id: 'rev-glock-vogue-st', name: 'Glock-18 | Vogue', weapon: 'Glock-18', collectionId: 'revolution', rarity: 'restricted', minFloat: 0, maxFloat: 0.75, stattrak: true },
      { id: 'rev-m4a1s-black-lotus', name: 'M4A1-S | Black Lotus', weapon: 'M4A1-S', collectionId: 'revolution', rarity: 'classified', minFloat: 0, maxFloat: 0.7, stattrak: false },
      { id: 'rev-m4a1s-black-lotus-st', name: 'M4A1-S | Black Lotus', weapon: 'M4A1-S', collectionId: 'revolution', rarity: 'classified', minFloat: 0, maxFloat: 0.7, stattrak: true },
      { id: 'rev-ak47-head-shot', name: 'AK-47 | Head Shot', weapon: 'AK-47', collectionId: 'revolution', rarity: 'covert', minFloat: 0, maxFloat: 1, stattrak: false },
      { id: 'rev-ak47-head-shot-st', name: 'AK-47 | Head Shot', weapon: 'AK-47', collectionId: 'revolution', rarity: 'covert', minFloat: 0, maxFloat: 1, stattrak: true },
    ],
  },
  {
    id: 'recoil',
    name: 'The Recoil Collection',
    items: [
      { id: 'rec-mp9-featherweight', name: 'MP9 | Featherweight', weapon: 'MP9', collectionId: 'recoil', rarity: 'consumer', minFloat: 0, maxFloat: 1, stattrak: false },
      { id: 'rec-r8-banana-cannon', name: 'R8 Revolver | Banana Cannon', weapon: 'R8 Revolver', collectionId: 'recoil', rarity: 'industrial', minFloat: 0, maxFloat: 1, stattrak: false },
      { id: 'rec-m249-downtown', name: 'M249 | Downtown', weapon: 'M249', collectionId: 'recoil', rarity: 'mil-spec', minFloat: 0, maxFloat: 1, stattrak: false },
      { id: 'rec-sg553-aloha', name: 'SG 553 | Aloha', weapon: 'SG 553', collectionId: 'recoil', rarity: 'mil-spec', minFloat: 0, maxFloat: 0.55, stattrak: false },
      { id: 'rec-dual-elite-tread', name: 'Dual Berettas | Tread', weapon: 'Dual Berettas', collectionId: 'recoil', rarity: 'restricted', minFloat: 0, maxFloat: 1, stattrak: false },
      { id: 'rec-dual-elite-tread-st', name: 'Dual Berettas | Tread', weapon: 'Dual Berettas', collectionId: 'recoil', rarity: 'restricted', minFloat: 0, maxFloat: 1, stattrak: true },
      { id: 'rec-ump45-roadblock', name: 'UMP-45 | Roadblock', weapon: 'UMP-45', collectionId: 'recoil', rarity: 'restricted', minFloat: 0, maxFloat: 1, stattrak: false },
      { id: 'rec-ump45-roadblock-st', name: 'UMP-45 | Roadblock', weapon: 'UMP-45', collectionId: 'recoil', rarity: 'restricted', minFloat: 0, maxFloat: 1, stattrak: true },
      { id: 'rec-awp-chromatic', name: 'AWP | Chromatic Aberration', weapon: 'AWP', collectionId: 'recoil', rarity: 'classified', minFloat: 0, maxFloat: 1, stattrak: false },
      { id: 'rec-awp-chromatic-st', name: 'AWP | Chromatic Aberration', weapon: 'AWP', collectionId: 'recoil', rarity: 'classified', minFloat: 0, maxFloat: 1, stattrak: true },
      { id: 'rec-usps-printstream', name: 'USP-S | Printstream', weapon: 'USP-S', collectionId: 'recoil', rarity: 'covert', minFloat: 0, maxFloat: 0.85, stattrak: false },
      { id: 'rec-usps-printstream-st', name: 'USP-S | Printstream', weapon: 'USP-S', collectionId: 'recoil', rarity: 'covert', minFloat: 0, maxFloat: 0.85, stattrak: true },
    ],
  },
  {
    id: 'dreams-nightmares',
    name: 'The Dreams & Nightmares Collection',
    items: [
      { id: 'dn-ppbizon-space-cat', name: 'PP-Bizon | Space Cat', weapon: 'PP-Bizon', collectionId: 'dreams-nightmares', rarity: 'mil-spec', minFloat: 0, maxFloat: 1, stattrak: false },
      { id: 'dn-mp7-abyssal', name: 'MP7 | Abyssal Apparition', weapon: 'MP7', collectionId: 'dreams-nightmares', rarity: 'restricted', minFloat: 0, maxFloat: 1, stattrak: false },
      { id: 'dn-mp7-abyssal-st', name: 'MP7 | Abyssal Apparition', weapon: 'MP7', collectionId: 'dreams-nightmares', rarity: 'restricted', minFloat: 0, maxFloat: 1, stattrak: true },
      { id: 'dn-famas-mecha', name: 'FAMAS | Rapid Eye Movement', weapon: 'FAMAS', collectionId: 'dreams-nightmares', rarity: 'restricted', minFloat: 0, maxFloat: 1, stattrak: false },
      { id: 'dn-famas-mecha-st', name: 'FAMAS | Rapid Eye Movement', weapon: 'FAMAS', collectionId: 'dreams-nightmares', rarity: 'restricted', minFloat: 0, maxFloat: 1, stattrak: true },
      { id: 'dn-mac10-ensnared', name: 'MAC-10 | Ensnared', weapon: 'MAC-10', collectionId: 'dreams-nightmares', rarity: 'restricted', minFloat: 0, maxFloat: 1, stattrak: false },
      { id: 'dn-mac10-ensnared-st', name: 'MAC-10 | Ensnared', weapon: 'MAC-10', collectionId: 'dreams-nightmares', rarity: 'restricted', minFloat: 0, maxFloat: 1, stattrak: true },
      { id: 'dn-ak47-nightwish', name: 'AK-47 | Nightwish', weapon: 'AK-47', collectionId: 'dreams-nightmares', rarity: 'classified', minFloat: 0, maxFloat: 1, stattrak: false },
      { id: 'dn-ak47-nightwish-st', name: 'AK-47 | Nightwish', weapon: 'AK-47', collectionId: 'dreams-nightmares', rarity: 'classified', minFloat: 0, maxFloat: 1, stattrak: true },
      { id: 'dn-mp9-starlight', name: 'MP9 | Starlight Protector', weapon: 'MP9', collectionId: 'dreams-nightmares', rarity: 'covert', minFloat: 0, maxFloat: 0.8, stattrak: false },
      { id: 'dn-mp9-starlight-st', name: 'MP9 | Starlight Protector', weapon: 'MP9', collectionId: 'dreams-nightmares', rarity: 'covert', minFloat: 0, maxFloat: 0.8, stattrak: true },
    ],
  },
  {
    id: 'kilowatt',
    name: 'The Kilowatt Collection',
    items: [
      { id: 'kw-tec9-slate', name: 'Tec-9 | Slag', weapon: 'Tec-9', collectionId: 'kilowatt', rarity: 'mil-spec', minFloat: 0, maxFloat: 1, stattrak: false },
      { id: 'kw-nova-dark-sigil', name: 'Nova | Dark Sigil', weapon: 'Nova', collectionId: 'kilowatt', rarity: 'restricted', minFloat: 0, maxFloat: 1, stattrak: false },
      { id: 'kw-nova-dark-sigil-st', name: 'Nova | Dark Sigil', weapon: 'Nova', collectionId: 'kilowatt', rarity: 'restricted', minFloat: 0, maxFloat: 1, stattrak: true },
      { id: 'kw-m4a4-eternal', name: 'M4A4 | Etch Lord', weapon: 'M4A4', collectionId: 'kilowatt', rarity: 'restricted', minFloat: 0, maxFloat: 1, stattrak: false },
      { id: 'kw-m4a4-eternal-st', name: 'M4A4 | Etch Lord', weapon: 'M4A4', collectionId: 'kilowatt', rarity: 'restricted', minFloat: 0, maxFloat: 1, stattrak: true },
      { id: 'kw-zeus-olympus', name: 'Zeus x27 | Olympus', weapon: 'Zeus x27', collectionId: 'kilowatt', rarity: 'classified', minFloat: 0, maxFloat: 0.67, stattrak: false },
      { id: 'kw-zeus-olympus-st', name: 'Zeus x27 | Olympus', weapon: 'Zeus x27', collectionId: 'kilowatt', rarity: 'classified', minFloat: 0, maxFloat: 0.67, stattrak: true },
      { id: 'kw-ak47-inheritance', name: 'AK-47 | Inheritance', weapon: 'AK-47', collectionId: 'kilowatt', rarity: 'covert', minFloat: 0, maxFloat: 0.8, stattrak: false },
      { id: 'kw-ak47-inheritance-st', name: 'AK-47 | Inheritance', weapon: 'AK-47', collectionId: 'kilowatt', rarity: 'covert', minFloat: 0, maxFloat: 0.8, stattrak: true },
    ],
  },
];

/** Índice flat de todas as skins */
export function getAllSkins() {
  return COLLECTIONS.flatMap((c) => c.items);
}

/** Busca skin por nome (prioriza match exato). */
export function findSkinByName(name: string, stattrak: boolean) {
  const normalized = name.toLowerCase().replace(/stattrak™?\s*/gi, '').trim();
  const pool = getAllSkins().filter((s) => s.stattrak === stattrak);

  const exact = pool.filter((s) => s.name.toLowerCase() === normalized);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) {
    return exact.find((s) => s.rarity !== 'consumer' && s.rarity !== 'industrial') ?? exact[0];
  }

  return pool.find((s) => s.name.toLowerCase().includes(normalized));
}
