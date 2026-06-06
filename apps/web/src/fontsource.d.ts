// @fontsource-variable/* packages inject CSS via side-effect imports and ship no
// type declarations. TypeScript 6 reports TS2882 ("Cannot find module or type
// declarations for side-effect import") for such imports, so declare them here.
declare module "@fontsource-variable/*";
