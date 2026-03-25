import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "**/AdminDashboard_backup.tsx"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // In this app we occasionally set form state on dialog open; treat as warning.
      "react-hooks/set-state-in-effect": "warn",
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      // This codebase currently uses `any` in large dashboard files.
      // Treat as warning so Husky can enforce lint without blocking commits.
      "@typescript-eslint/no-explicit-any": "warn",
      // Relax a few rules that currently flag legacy dashboard code as hard errors.
      // We still surface them as warnings so they can be cleaned up iteratively.
      "no-empty": "warn",
      "@typescript-eslint/no-require-imports": "warn",
      "@typescript-eslint/no-unused-vars": "off",
    },
  }
);
