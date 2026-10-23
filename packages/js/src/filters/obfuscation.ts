import { ObfuscationLevel, ObfuscationOptions } from '../types/types';

export interface ResolvedObfuscation {
  html: { enabled: boolean; decodeDepth: number };
  separators: { enabled: boolean; chars: string; allowSpace: boolean; minTwoPieceLength: number };
  masking: { enabled: boolean; chars: string; minVisible: number };
  stretch: boolean;
  ambiguousLeet: boolean;
  builtinWhitelist: boolean;
}

const DEFAULT_LEVEL: ObfuscationLevel = 'standard';
const DEFAULT_SEPARATORS = '.,/|_-';
const DEFAULT_MASKS = '*#@$%_?!';

/** Reads an integer override from the environment (Node only), else the fallback. */
function envInt(name: string, fallback: number): number {
  const raw = typeof process !== 'undefined' ? process.env?.[name] : undefined;
  const parsed = raw === undefined ? NaN : parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function object<T extends object>(value: boolean | T | undefined): Partial<T> {
  return typeof value === 'object' && value !== null ? value : {};
}

/** Turns the public `obfuscation` option into concrete switches. */
export function resolveObfuscation(
  option: ObfuscationLevel | ObfuscationOptions | undefined,
): ResolvedObfuscation {
  const opts: ObfuscationOptions = typeof option === 'string' ? { level: option } : option ?? {};
  const level = opts.level ?? DEFAULT_LEVEL;
  const on = level !== 'off';
  const mid = level === 'standard' || level === 'strict';
  const strict = level === 'strict';
  const flag = (value: boolean | object | undefined, byLevel: boolean) =>
    value === undefined ? byLevel : value !== false;

  const html = object(opts.html);
  const sep = object(opts.separators);
  const mask = object(opts.masking);

  return {
    html: {
      enabled: flag(opts.html, on),
      decodeDepth: html.decodeDepth ?? envInt('GLIN_HTML_DECODE_DEPTH', 2),
    },
    separators: {
      enabled: flag(opts.separators, mid),
      chars: sep.chars ?? DEFAULT_SEPARATORS,
      allowSpace: sep.allowSpace ?? strict,
      minTwoPieceLength: sep.minTwoPieceLength ?? envInt('GLIN_SEPARATOR_MIN_JOIN', strict ? 3 : 4),
    },
    masking: {
      enabled: flag(opts.masking, mid),
      chars: mask.chars ?? DEFAULT_MASKS,
      minVisible: mask.minVisible ?? envInt('GLIN_MASK_MIN_VISIBLE', 1),
    },
    stretch: opts.stretch ?? on,
    ambiguousLeet: opts.ambiguousLeet ?? mid,
    builtinWhitelist: opts.builtinWhitelist ?? on,
  };
}

export function obfuscationEnabled(resolved: ResolvedObfuscation): boolean {
  return (
    resolved.html.enabled ||
    resolved.separators.enabled ||
    resolved.masking.enabled ||
    resolved.stretch ||
    resolved.ambiguousLeet ||
    resolved.builtinWhitelist
  );
}
