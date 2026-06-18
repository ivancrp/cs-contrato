import type { CacheAdapter } from '@ct/common';
import type { Collection, SkinItem } from '@ct/types';

export interface AppContext {
  cache: CacheAdapter;
  collections: Collection[];
  skins: SkinItem[];
  skinsById: Map<string, SkinItem>;
  catalogSource: 'prisma' | 'cache' | 'parser';
}
