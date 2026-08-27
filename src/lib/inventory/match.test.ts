import { describe, expect, it } from "vitest";
import { nameMatches } from "./match";

describe("nameMatches", () => {
  it("does not match on filler words like 'with'", () => {
    expect(
      nameMatches(
        "Triple scale hydrometer with glass test jar",
        "Brewer's Edge Mash and Boil with Pump V2 (Series 2) all-in-one brewing kettle"
      )
    ).toBe(false);
  });

  it("does not match on generic brewing words", () => {
    expect(nameMatches("Stainless steel brewing spoon", "Stainless steel chiller coil")).toBe(false);
  });

  it("matches distinctive tokens across name variants", () => {
    expect(nameMatches("Willamette hop pellets", "Willamette, pellet")).toBe(true);
    expect(nameMatches("Clear vinyl transfer tubing", "Siphon tubing")).toBe(true);
    expect(nameMatches("Triple scale hydrometer", "SOLIGT hydrometer + test jar")).toBe(true);
  });

  it("matches full containment", () => {
    expect(nameMatches("Inkbird ITC-308", "Inkbird ITC-308 WiFi Temperature Controller")).toBe(true);
  });
});
