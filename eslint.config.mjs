import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescriptConfig from "eslint-config-next/typescript";

const config = [
  ...coreWebVitals,
  ...typescriptConfig,
  {
    ignores: [
      ".next/**", "node_modules/**", "coverage/**", "playwright-report/**",
      "test-results/**", "prisma/migrations/**", "src/generated/**", ".prisma-offline/**",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@next/next/no-img-element": "off",
    },
  },
  {
    files: ["src/app/layout.tsx"],
    rules: { "@next/next/no-page-custom-font": "off" },
  },
];

export default config;
