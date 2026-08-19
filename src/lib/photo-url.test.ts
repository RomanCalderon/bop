import { describe, expect, it } from "vitest";
import { parsePhotoMaxHeight, placePhotoSrc } from "./photo-url";

describe("placePhotoSrc", () => {
  it("encodes the photo name and thumb height", () => {
    expect(placePhotoSrc("places/ChIJ1/photos/AAA", "thumb")).toBe(
      "/api/photos?name=places%2FChIJ1%2Fphotos%2FAAA&h=160",
    );
  });

  it("encodes the hero height for the detail image", () => {
    expect(placePhotoSrc("places/ChIJ1/photos/AAA", "hero")).toBe(
      "/api/photos?name=places%2FChIJ1%2Fphotos%2FAAA&h=800",
    );
  });
});

describe("parsePhotoMaxHeight", () => {
  it("accepts the thumb and hero buckets", () => {
    expect(parsePhotoMaxHeight("160")).toBe(160);
    expect(parsePhotoMaxHeight("800")).toBe(800);
  });

  it("falls back to hero for missing or unknown values", () => {
    expect(parsePhotoMaxHeight(null)).toBe(800);
    expect(parsePhotoMaxHeight("4800")).toBe(800);
    expect(parsePhotoMaxHeight("nope")).toBe(800);
  });
});
