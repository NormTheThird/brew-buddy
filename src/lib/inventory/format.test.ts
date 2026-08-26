import { describe, expect, it } from "vitest";
import { bestByStatus, formatCost, formatMonth, formatQuantity } from "./format";

describe("bestByStatus", () => {
  const now = new Date("2026-08-26");

  it("returns none without a date", () => {
    expect(bestByStatus(null, now)).toBe("none");
  });

  it("returns ok for far-future dates (US-05 lot 250573, 07/2028)", () => {
    expect(bestByStatus(new Date("2028-07-01"), now)).toBe("ok");
  });

  it("returns soon within 60 days", () => {
    expect(bestByStatus(new Date("2026-09-30"), now)).toBe("soon");
  });

  it("returns expired for past dates", () => {
    expect(bestByStatus(new Date("2026-08-01"), now)).toBe("expired");
  });
});

describe("formatters", () => {
  it("formats month-year and em-dashes missing dates", () => {
    expect(formatMonth(new Date("2026-08-15"))).toBe("Aug 2026");
    expect(formatMonth(null)).toBe("—");
  });

  it("does not shift UTC-midnight dates into the previous month", () => {
    expect(formatMonth(new Date("2028-07-01"))).toBe("Jul 2028");
  });

  it("formats cost with missing as em-dash", () => {
    expect(formatCost(12.5)).toBe("$12.50");
    expect(formatCost(null)).toBe("—");
  });

  it("formats quantities without trailing zeros", () => {
    expect(formatQuantity(0, "oz")).toBe("0 oz");
    expect(formatQuantity(5.75, "gal")).toBe("5.75 gal");
    expect(formatQuantity(11.5, "g")).toBe("11.5 g");
    expect(formatQuantity(null, "lb")).toBe("—");
  });
});
