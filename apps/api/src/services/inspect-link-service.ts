import { WEAR_BOUNDS } from '@ct/engine';
import type { SkinItem, WearTier } from '@ct/types';
import { crc32 } from 'node:zlib';

const STEAM_INSPECT_PREFIX =
  'steam://rungame/730/76561202255233023/+csgo_econ_action_preview%20';

function encodeVarint(value: number): Buffer {
  const bytes: number[] = [];
  let n = value >>> 0;
  while (n >= 0x80) {
    bytes.push((n & 0x7f) | 0x80);
    n >>>= 7;
  }
  bytes.push(n);
  return Buffer.from(bytes);
}

function encodeUint32Field(fieldNumber: number, value: number): Buffer {
  const tag = encodeVarint((fieldNumber << 3) | 0);
  const payload = encodeVarint(value >>> 0);
  return Buffer.concat([tag, payload]);
}

function floatToWearBits(wear: number): number {
  const buf = Buffer.alloc(4);
  buf.writeFloatBE(wear, 0);
  return buf.readUInt32BE(0);
}

function serializePreviewBlock(
  defIndex: number,
  paintIndex: number,
  paintSeed: number,
  paintWear: number,
): Buffer {
  return Buffer.concat([
    encodeUint32Field(3, defIndex),
    encodeUint32Field(4, paintIndex),
    encodeUint32Field(7, floatToWearBits(paintWear)),
    encodeUint32Field(8, paintSeed),
  ]);
}

/** Gera payload hex para inspect in-game (preview gen). */
export function generateInspectPayloadHex(
  defIndex: number,
  paintIndex: number,
  paintSeed: number,
  paintWear: number,
): string {
  const proto = serializePreviewBlock(defIndex, paintIndex, paintSeed, paintWear);
  const buffer = Buffer.concat([Buffer.from([0]), proto]);
  const checksum = crc32(buffer) >>> 0;
  const xored = (checksum & 0xffff) ^ (proto.length * checksum);
  const out = Buffer.alloc(buffer.length + 4);
  buffer.copy(out, 0);
  out.writeUInt32BE(xored >>> 0, buffer.length);
  return out.toString('hex').toUpperCase();
}

export function buildSteamInspectUrl(hexPayload: string): string {
  return `${STEAM_INSPECT_PREFIX}${hexPayload}`;
}

export function wearToPreviewFloat(skin: SkinItem, wear: WearTier): number {
  const bounds = WEAR_BOUNDS[wear];
  const min = Math.max(bounds.min, skin.minFloat);
  const max = Math.min(bounds.max, skin.maxFloat);
  if (min >= max) return Math.min(Math.max(min, 0), 1);
  return Math.round(((min + max) / 2) * 10000) / 10000;
}

export function generateInspectLinkForSkin(
  skin: SkinItem,
  wear: WearTier = 'Field-Tested',
  paintSeed = 1,
): string | null {
  const defIndex = skin.weaponDefIndex;
  const paintIndex = skin.paintIndex ? Number(skin.paintIndex) : NaN;
  if (!defIndex || !Number.isFinite(paintIndex) || paintIndex <= 0) return null;

  const paintWear = wearToPreviewFloat(skin, wear);
  const hex = generateInspectPayloadHex(defIndex, paintIndex, paintSeed, paintWear);
  return buildSteamInspectUrl(hex);
}
