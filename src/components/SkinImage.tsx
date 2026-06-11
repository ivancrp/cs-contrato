import { useEffect, useState } from 'react';
import type { Rarity } from '../models/types';
import { getSkinImageUrl } from '../data/skinImages';
import { skinImageService } from '../services/skinImageService';
import { generateSkinSvgFallback } from '../utils/skinSvgFallback';
import { getSteamImageFallbacks } from '../utils/steamImage';

interface SkinImageProps {
  name: string;
  rarity?: Rarity;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  title?: string;
}

const SIZE_CLASS = { sm: 'skin-img-sm', md: 'skin-img-md', lg: 'skin-img-lg' };

/**
 * Exibe imagem da skin: proxy Vite → CDN Steam → SVG fallback.
 */
export function SkinImage({ name, rarity, size = 'md', className = '', title }: SkinImageProps) {
  const [baseUrl, setBaseUrl] = useState(() =>
    skinImageService.getSync(name) ?? getSkinImageUrl(name),
  );
  const [fallbackIndex, setFallbackIndex] = useState(0);
  const [useSvg, setUseSvg] = useState(false);

  useEffect(() => {
    const sync = skinImageService.getSync(name) ?? getSkinImageUrl(name);
    setBaseUrl(sync);
    setFallbackIndex(0);
    setUseSvg(false);
    skinImageService.resolve(name).then((resolved) => {
      if (resolved) setBaseUrl(resolved);
    });
  }, [name]);

  const fallbacks = getSteamImageFallbacks(baseUrl, size);
  const src = useSvg
    ? generateSkinSvgFallback(name, rarity)
    : (fallbacks[fallbackIndex] ?? generateSkinSvgFallback(name, rarity));

  const handleError = () => {
    if (fallbackIndex + 1 < fallbacks.length) {
      setFallbackIndex((i) => i + 1);
    } else {
      setUseSvg(true);
    }
  };

  return (
    <div
      className={`skin-image-wrap ${SIZE_CLASS[size]} ${rarityClass(rarity)} ${className}`}
      title={title ?? name}
    >
      <img
        src={src}
        alt={name}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={handleError}
      />
    </div>
  );
}

function rarityClass(rarity?: Rarity): string {
  return rarity ? `skin-rarity-${rarity}` : '';
}
