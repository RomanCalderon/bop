export const PHOTO_MAX_HEIGHT = {
  thumb: 160,
  hero: 800,
} as const;

export type PhotoSize = keyof typeof PHOTO_MAX_HEIGHT;

export function photoMaxHeight(size: PhotoSize): number {
  switch (size) {
    case "thumb":
      return PHOTO_MAX_HEIGHT.thumb;
    case "hero":
      return PHOTO_MAX_HEIGHT.hero;
    default: {
      const _exhaustive: never = size;
      return _exhaustive;
    }
  }
}

export function parsePhotoMaxHeight(raw: string | null): number {
  const n = Number(raw);
  if (n === PHOTO_MAX_HEIGHT.thumb) return PHOTO_MAX_HEIGHT.thumb;
  if (n === PHOTO_MAX_HEIGHT.hero) return PHOTO_MAX_HEIGHT.hero;
  return PHOTO_MAX_HEIGHT.hero;
}

export function placePhotoSrc(photoName: string, size: PhotoSize): string {
  return `/api/photos?name=${encodeURIComponent(photoName)}&h=${photoMaxHeight(size)}`;
}
