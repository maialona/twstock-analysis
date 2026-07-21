import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // 收集器是 Node 端獨立工具（用 .ts 副檔名 import、無 React），
    // 不走 Next 建置圖，交由 tsconfig.scripts.json 各自把關
    "scripts/**",
  ]),
  {
    rules: {
      // 以底線開頭的參數是「刻意保留簽章但不使用」的慣例（如 hasFullAnalysis(_stockId)）
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
]);

export default eslintConfig;
