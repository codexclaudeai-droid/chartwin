export function getContrastTextColor(bgColor: string): string {
  const parseHex = (hex: string): [number, number, number] | null => {
    const h = hex.replace('#', '').trim();
    if (h.length !== 6) return null;
    const r = Number.parseInt(h.slice(0, 2), 16);
    const g = Number.parseInt(h.slice(2, 4), 16);
    const b = Number.parseInt(h.slice(4, 6), 16);
    if ([r, g, b].some(Number.isNaN)) return null;
    return [r, g, b];
  };
  const parseRgb = (rgb: string): [number, number, number] | null => {
    const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (!m) return null;
    return [Number(m[1]), Number(m[2]), Number(m[3])];
  };
  const color = bgColor.trim().startsWith('#') ? parseHex(bgColor) : parseRgb(bgColor);
  if (!color) return '#ffffff';
  const [r, g, b] = color;
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 150 ? '#111111' : '#ffffff';
}

export function toRgba(color: string, alpha: number, fallback = 'rgba(255,255,255,0.35)'): string {
  const a = Math.max(0, Math.min(1, alpha));
  const source = color.trim();
  if (source.startsWith('#')) {
    const raw = source.slice(1);
    const full = raw.length === 3
      ? `${raw[0]}${raw[0]}${raw[1]}${raw[1]}${raw[2]}${raw[2]}`
      : raw;
    if (full.length === 6) {
      const r = Number.parseInt(full.slice(0, 2), 16);
      const g = Number.parseInt(full.slice(2, 4), 16);
      const b = Number.parseInt(full.slice(4, 6), 16);
      if (![r, g, b].some(Number.isNaN)) {
        return `rgba(${r},${g},${b},${a})`;
      }
    }
  }
  const m = source.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (m) {
    return `rgba(${Number(m[1])},${Number(m[2])},${Number(m[3])},${a})`;
  }
  return fallback;
}
