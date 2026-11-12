export type RgbColor = [number, number, number];

export function hexToRgb(color: string): RgbColor {
  const match = /^#([0-9a-f]{6})$/i.exec(color);
  if (!match) return [30, 58, 95];
  return [
    parseInt(match[1].slice(0, 2), 16),
    parseInt(match[1].slice(2, 4), 16),
    parseInt(match[1].slice(4, 6), 16),
  ];
}

export function contrastingTextColor(color: string): RgbColor {
  const linear = hexToRgb(color).map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  return luminance > 0.179 ? [15, 23, 42] : [255, 255, 255];
}

export function contrastingTextHex(color: string): string {
  const [red, green, blue] = contrastingTextColor(color);
  return `#${[red, green, blue].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}
