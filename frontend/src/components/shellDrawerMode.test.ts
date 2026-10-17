import { describe, expect, it } from "vitest";
import {
  SHELL_CONTENT_CHROME_PX,
  SHELL_DRAWER_FALLBACK_MAX_PX,
  SHELL_SIDEBAR_WIDTH_PX,
  shouldUseShellDrawerMode,
} from "./shellDrawerMode";

describe("shouldUseShellDrawerMode", () => {
  it("uses the mobile fallback when no table needs width", () => {
    expect(shouldUseShellDrawerMode(SHELL_DRAWER_FALLBACK_MAX_PX, 0)).toBe(true);
    expect(shouldUseShellDrawerMode(SHELL_DRAWER_FALLBACK_MAX_PX + 1, 0)).toBe(false);
  });

  it("hides the sidebar before the table would be crushed beside it", () => {
    const tableMin = 800;
    const threshold = tableMin + SHELL_SIDEBAR_WIDTH_PX + SHELL_CONTENT_CHROME_PX;
    expect(shouldUseShellDrawerMode(threshold - 1, tableMin)).toBe(true);
    expect(shouldUseShellDrawerMode(threshold, tableMin)).toBe(false);
  });
});
