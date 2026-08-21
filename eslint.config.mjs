import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

/**
 * eslint-config-next 16 ya exporta config plana, así que no hace falta
 * FlatCompat.
 */
const eslintConfig = [
  {
    ignores: [
      "DESING/**",
      ".next/**",
      "node_modules/**",
      // Lo escribe el CLI de Convex; no es código nuestro.
      "convex/_generated/**",
    ],
  },
  ...coreWebVitals,
  ...typescript,
];

export default eslintConfig;
