/* Style families for filtering, and SRM color for the glass icon.
   Styles are freeform text ("Bourbon Barrel Stout"), so families match by
   keyword; ORDER MATTERS (barrel before stout, IPA before pale before the
   ale catch-all). Color prefers the recipe's targetSRM; otherwise the
   family's typical SRM stands in. */

export type StyleFamily = {
  key: string;
  label: string;
  re: RegExp;
  /** Typical mid-range SRM for the family, used when the recipe has none. */
  srm: number;
};

export const STYLE_FAMILIES: StyleFamily[] = [
  { key: "barrel", label: "Barrel-aged", re: /barrel|bourbon/i, srm: 28 },
  { key: "ipa", label: "IPA", re: /\bipa\b|india pale/i, srm: 7 },
  { key: "pale", label: "Pale Ale", re: /pale ale/i, srm: 6 },
  { key: "stout", label: "Stout", re: /stout/i, srm: 36 },
  { key: "porter", label: "Porter", re: /porter/i, srm: 30 },
  { key: "brown", label: "Brown", re: /brown/i, srm: 20 },
  { key: "amber", label: "Amber / Red", re: /amber|red/i, srm: 13 },
  { key: "wheat", label: "Wheat", re: /wheat|hefe|wit\b|weiss/i, srm: 4 },
  { key: "sour", label: "Sour", re: /sour|gose|lambic|berliner/i, srm: 4 },
  { key: "lager", label: "Lager / Pils", re: /lager|pilsner|\bpils\b|kolsch|kölsch|marzen|märzen|bock/i, srm: 4 },
  { key: "ale", label: "Other Ale", re: /ale/i, srm: 9 },
];

export function styleFamily(style: string | null): StyleFamily | null {
  if (!style) return null;
  return STYLE_FAMILIES.find((f) => f.re.test(style)) ?? null;
}

/* Standard SRM color chart, sampled; values between rows interpolate to the
   nearest lower entry. Beyond 40 everything is essentially black-brown. */
const SRM_HEX: Array<[number, string]> = [
  [1, "#FFE699"], [2, "#FFD878"], [3, "#FFCA5A"], [4, "#FFBF42"],
  [5, "#FBB123"], [6, "#F8A600"], [7, "#F39C00"], [8, "#EA8F00"],
  [9, "#E58500"], [10, "#DE7C00"], [12, "#CF6900"], [14, "#BB5100"],
  [17, "#A13700"], [20, "#8E2900"], [25, "#701400"], [30, "#600903"],
  [35, "#520907"], [40, "#470606"],
];

export function srmToHex(srm: number): string {
  const clamped = Math.max(1, Math.min(40, srm));
  let hex = SRM_HEX[0][1];
  for (const [s, h] of SRM_HEX) {
    if (clamped >= s) hex = h;
    else break;
  }
  return hex;
}

/** The color the glass icon pours: real SRM first, family estimate second. */
export function recipeGlassColor(
  targetSRM: number | null,
  style: string | null
): string {
  if (targetSRM != null && targetSRM > 0) return srmToHex(targetSRM);
  const fam = styleFamily(style);
  return srmToHex(fam?.srm ?? 9);
}
