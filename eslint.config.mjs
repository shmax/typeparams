import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: ["**/dist/**"], // Ignore the `dist` directory
  },
  {
    files: ["src/**/*.{ts,js,mjs,cjs}"], // Limit linting to the `src` directory
    languageOptions: {
      globals: { ...globals.browser, ...globals.node }, // Support both browser and Node.js environments
    },
  },
  pluginJs.configs.recommended, // Standard JS rules
  ...tseslint.configs.recommended, // TypeScript-specific rules
];
