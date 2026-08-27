/* A BeerXML skeleton shaped exactly like what parseBeerXml understands.
   Made to be pasted into an AI ("fill this in for a clone of X") and then
   imported back. The comments teach the units so the numbers come out right. */
export const BEERXML_TEMPLATE = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Fill in this BeerXML recipe. Rules:
     - BATCH_SIZE is LITERS (5 US gallons = 18.93)
     - FERMENTABLE and HOP AMOUNT are KILOGRAMS (1 lb = 0.4536 kg, 1 oz = 0.0283 kg)
     - TYPE is one of: Extract, Partial Mash, All Grain
     - HOP USE is Boil / Dry Hop; TIME is minutes in the boil
     - EST_OG / EST_FG like 1.042; IBU is a whole-ish number
     - Add more FERMENTABLE / HOP / YEAST / MISC blocks as needed -->
<RECIPES>
  <RECIPE>
    <NAME>Recipe name here</NAME>
    <VERSION>1</VERSION>
    <TYPE>Extract</TYPE>
    <STYLE>
      <NAME>Style name, e.g. American Amber Ale</NAME>
      <VERSION>1</VERSION>
    </STYLE>
    <BATCH_SIZE>18.93</BATCH_SIZE>
    <BOIL_TIME>60</BOIL_TIME>
    <EST_OG>1.042</EST_OG>
    <EST_FG>1.010</EST_FG>
    <IBU>18</IBU>
    <NOTES>Where this recipe came from and anything worth remembering.</NOTES>
    <FERMENTABLES>
      <FERMENTABLE>
        <NAME>Gold liquid malt extract</NAME>
        <VERSION>1</VERSION>
        <TYPE>Extract</TYPE>
        <AMOUNT>2.72</AMOUNT>
        <YIELD>0</YIELD>
      </FERMENTABLE>
    </FERMENTABLES>
    <HOPS>
      <HOP>
        <NAME>Willamette</NAME>
        <VERSION>1</VERSION>
        <AMOUNT>0.0283</AMOUNT>
        <USE>Boil</USE>
        <TIME>60</TIME>
        <ALPHA>5.5</ALPHA>
      </HOP>
    </HOPS>
    <YEASTS>
      <YEAST>
        <NAME>SafAle US-05</NAME>
        <VERSION>1</VERSION>
        <AMOUNT>0.0115</AMOUNT>
      </YEAST>
    </YEASTS>
    <MISCS></MISCS>
    <WATERS></WATERS>
  </RECIPE>
</RECIPES>
`;
