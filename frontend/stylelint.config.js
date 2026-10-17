/** @type {import('stylelint').Config} */
export default {
  extends: ["stylelint-config-standard"],
  plugins: ["stylelint-order"],
  ignoreFiles: ["**/coverage/**", "**/dist/**", "**/node_modules/**"],
  rules: {
    "color-no-hex": true,
    "declaration-property-value-disallowed-list": {
      "font-size": ["/px$/"],
    },
    "declaration-no-important": true,
    "selector-max-id": 1,
    "selector-max-specificity": null,
    "max-nesting-depth": 3,
    "function-no-unknown": [
      true,
      {
        ignoreFunctions: ["color-mix"],
      },
    ],
    // Deferred until file split / cascade cleanup (phase split-layers).
    "no-descending-specificity": null,
    "selector-class-pattern": null,
    "custom-property-pattern": null,
    "keyframes-name-pattern": null,
    "custom-property-empty-line-before": null,
    "declaration-empty-line-before": null,
    "rule-empty-line-before": null,
    "comment-empty-line-before": null,
    "media-feature-range-notation": null,
    "alpha-value-notation": null,
    "color-function-notation": null,
    "color-function-alias-notation": null,
    "color-hex-length": null,
    "declaration-block-no-redundant-longhand-properties": null,
    "value-keyword-case": null,
    "order/properties-order": null,
  },
  overrides: [
    {
      files: ["**/index.css", "**/styles/tokens.css"],
      rules: {
        "color-no-hex": null,
      },
    },
  ],
};
