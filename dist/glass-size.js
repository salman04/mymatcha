// Serving size shared by the recipe and its presentation. Keep the thick base
// and the width unchanged while extending the drinking wall by fifty percent.
export const GLASS_CAPACITY_ML=450;
export const MAX_ICE_CUBES=12;
export const GLASS_BASE_Y=.10;
export const GLASS_FILL_DEPTH=.87;
export const GLASS_FILL_TOP=GLASS_BASE_Y+GLASS_FILL_DEPTH;
export const GLASS_RIM_Y=1.015;
export const glassWallY=y=>y<=GLASS_BASE_Y?y:GLASS_BASE_Y+(y-GLASS_BASE_Y)*1.5;
