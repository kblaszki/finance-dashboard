/** Fallback sticky sidebar width when `--sidebar-width` is unavailable. */
export const SHELL_SIDEBAR_WIDTH_PX = 232;

/** Approx. horizontal padding of `.shell-content` (clamp 1.25rem–2rem × 2). */
export const SHELL_CONTENT_CHROME_PX = 48;

/** Fallback when the page has no data tables (mobile hamburger). */
export const SHELL_DRAWER_FALLBACK_MAX_PX = 900;

/** Read `--sidebar-width` from the document (falls back to SHELL_SIDEBAR_WIDTH_PX). */
export function readSidebarWidthPx(
  root: Element | null = typeof document !== "undefined" ? document.documentElement : null,
): number {
  if (!root || typeof getComputedStyle === "undefined") {
    return SHELL_SIDEBAR_WIDTH_PX;
  }
  const raw = getComputedStyle(root).getPropertyValue("--sidebar-width").trim();
  if (!raw) return SHELL_SIDEBAR_WIDTH_PX;
  const probe = document.createElement("div");
  probe.style.width = raw;
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  document.body.appendChild(probe);
  const px = probe.getBoundingClientRect().width;
  probe.remove();
  return px > 0 ? px : SHELL_SIDEBAR_WIDTH_PX;
}

/**
 * Intrinsic minimum width of a table (column mins / content), independent of
 * the current layout width so drawer ↔ sticky mode does not feedback-loop.
 */
export function measureTableMinWidthPx(table: HTMLTableElement): number {
  const wrap = table.closest(".table-wrap") as HTMLElement | null;
  const prevWidth = table.style.width;
  const prevWrapOverflow = wrap?.style.overflow ?? "";
  if (wrap) wrap.style.overflow = "hidden";
  table.style.width = "0px";
  const width = table.scrollWidth;
  table.style.width = prevWidth;
  if (wrap) wrap.style.overflow = prevWrapOverflow;
  return width;
}

export function maxTableMinWidthIn(root: ParentNode): number {
  let max = 0;
  root.querySelectorAll<HTMLTableElement>(".table-wrap table, table.data-table").forEach((table) => {
    max = Math.max(max, measureTableMinWidthPx(table));
  });
  return max;
}

/** Prefer hiding the sticky sidebar before a table is forced below its readable min. */
export function shouldUseShellDrawerMode(
  viewportWidth: number,
  maxTableMinWidthPx: number,
  sidebarWidthPx = SHELL_SIDEBAR_WIDTH_PX,
  fallbackMaxPx = SHELL_DRAWER_FALLBACK_MAX_PX,
  contentChromePx = SHELL_CONTENT_CHROME_PX,
): boolean {
  if (maxTableMinWidthPx <= 0) {
    return viewportWidth <= fallbackMaxPx;
  }
  return viewportWidth < maxTableMinWidthPx + sidebarWidthPx + contentChromePx;
}
