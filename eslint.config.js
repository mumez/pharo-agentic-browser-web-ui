import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import solidPlugin from "eslint-plugin-solid";

export default [
    {
        files: ["src/**/*.{ts,tsx}"],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                project: "./tsconfig.app.json",
            },
        },
        plugins: {
            "@typescript-eslint": tsPlugin,
            solid: solidPlugin,
        },
        rules: {
            ...tsPlugin.configs.recommended.rules,
            ...solidPlugin.configs.typescript.rules,
        },
    },
    {
        ignores: ["dist/**", "node_modules/**"],
    },
];
