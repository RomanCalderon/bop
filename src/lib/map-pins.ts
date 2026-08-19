export type PinKind = "dot" | "disc" | "pin";

export type PinAppearance = {
  kind: PinKind;
  size: number;
  selected: boolean;
  canvas: number;
};

const ACCENT = "#c45c26";
const PAPER = "#f5f0e8";

export function pinAppearance(zoom: number, selected: boolean): PinAppearance {
  let kind: PinKind;
  let size: number;
  if (zoom <= 11) {
    kind = "dot";
    size = 7;
  } else if (zoom <= 14) {
    kind = "disc";
    size = 11;
  } else {
    kind = "pin";
    size = 22;
  }
  if (selected) {
    size = Math.round(size * 1.35);
  }
  const canvas = selected ? size + 10 : size;
  return { kind, size, selected, canvas };
}

export function pinSvg(appearance: PinAppearance): string {
  const { kind, size, selected, canvas } = appearance;
  const cx = canvas / 2;
  const cy = canvas / 2;
  const r = size / 2;
  const ring = selected
    ? `<circle cx="${cx}" cy="${cy}" r="${r + 3}" fill="none" stroke="${ACCENT}" stroke-width="2" opacity="0.45"/>`
    : "";
  const body =
    kind === "pin"
      ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${ACCENT}"/><circle cx="${cx}" cy="${cy}" r="${Math.max(2, r * 0.28)}" fill="${PAPER}"/>`
      : `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${ACCENT}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas}" height="${canvas}" viewBox="0 0 ${canvas} ${canvas}">${ring}${body}</svg>`;
}

export function pinIconUrl(appearance: PinAppearance): string {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(pinSvg(appearance))}`;
}
