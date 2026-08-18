import { describe, expect, it } from "vitest";
import { pinAppearance, pinSvg } from "./map-pins";

describe("pinAppearance", () => {
  it("uses 6–8px dots at metro zoom", () => {
    const pin = pinAppearance(11, false);
    expect(pin.kind).toBe("dot");
    expect(pin.size).toBeGreaterThanOrEqual(6);
    expect(pin.size).toBeLessThanOrEqual(8);
  });

  it("uses 10–12px discs at neighborhood zoom", () => {
    const pin = pinAppearance(12, false);
    expect(pin.kind).toBe("disc");
    expect(pin.size).toBeGreaterThanOrEqual(10);
    expect(pin.size).toBeLessThanOrEqual(12);
    expect(pinAppearance(14, false).kind).toBe("disc");
  });

  it("uses 20–24px branded pins at street zoom", () => {
    const pin = pinAppearance(15, false);
    expect(pin.kind).toBe("pin");
    expect(pin.size).toBeGreaterThanOrEqual(20);
    expect(pin.size).toBeLessThanOrEqual(24);
  });

  it("makes the selected pin larger at every zoom", () => {
    for (const zoom of [10, 13, 16]) {
      const rest = pinAppearance(zoom, false);
      const selected = pinAppearance(zoom, true);
      expect(selected.size).toBeGreaterThan(rest.size);
      expect(selected.canvas).toBeGreaterThan(rest.canvas);
    }
  });
});

describe("pinSvg", () => {
  it("uses accent fill and never Google red", () => {
    const svg = pinSvg(pinAppearance(12, false));
    expect(svg).toContain("#c45c26");
    expect(svg).not.toContain("#ea4335");
    expect(svg).not.toContain("red");
  });

  it("draws a ring on the selected pin", () => {
    expect(pinSvg(pinAppearance(15, true))).toContain("stroke");
    expect(pinSvg(pinAppearance(15, false))).not.toContain("stroke");
  });
});
