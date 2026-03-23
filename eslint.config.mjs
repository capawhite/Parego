import next from "eslint-config-next"

/** @type {import("eslint").Linter.Config[]} */
export default [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "dist/**",
      "OldPairingAlgo/**",
      ".claude/**",
      "coverage/**",
      "*.config.js",
      "*.config.mjs",
      "*.config.ts",
    ],
  },
  ...next,
  {
    rules: {
      // Next/React Compiler rules — many valid SSR/hydration/timer patterns trip these; keep typecheck + tests as guardrails.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
      "react-hooks/refs": "off",
    },
  },
]
