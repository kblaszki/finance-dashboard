import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import {
  SetupChecklist,
  hasCashActivityFromAccounts,
  isSetupComplete,
} from "./SetupChecklist";

beforeEach(() => {
  cleanup();
});

describe("SetupChecklist helpers", () => {
  it("isSetupComplete requires all three flags", () => {
    expect(
      isSetupComplete({
        hasAccounts: true,
        hasCategories: true,
        hasCashActivity: false,
      }),
    ).toBe(false);
    expect(
      isSetupComplete({
        hasAccounts: true,
        hasCategories: true,
        hasCashActivity: true,
      }),
    ).toBe(true);
  });

  it("hasCashActivityFromAccounts detects balance drift from opening", () => {
    expect(
      hasCashActivityFromAccounts([
        { cashBalance: 100, openingBalance: 100 },
      ]),
    ).toBe(false);
    expect(
      hasCashActivityFromAccounts([
        { cashBalance: 90, openingBalance: 100 },
      ]),
    ).toBe(true);
  });
});

describe("SetupChecklist", () => {
  it("renders undone steps as links", () => {
    render(
      <MemoryRouter>
        <SetupChecklist
          hasAccounts={false}
          hasCategories={false}
          hasCashActivity={false}
        />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("link", { name: "Add an account" }).getAttribute("href"),
    ).toBe("/accounts");
    expect(
      screen
        .getByRole("link", { name: "Add income or expense categories" })
        .getAttribute("href"),
    ).toBe("/categories");
  });

  it("links record step to first account ledger when available", () => {
    render(
      <MemoryRouter>
        <SetupChecklist
          hasAccounts
          hasCategories
          hasCashActivity={false}
          firstAccountId={7}
        />
      </MemoryRouter>,
    );
    expect(
      screen
        .getByRole("link", { name: "Record a transaction" })
        .getAttribute("href"),
    ).toBe("/accounts/7");
  });

  it("compact mode shows only the next step", () => {
    render(
      <MemoryRouter>
        <SetupChecklist
          compact
          hasAccounts
          hasCategories={false}
          hasCashActivity={false}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Next:/)).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Add income or expense categories" }),
    ).toBeTruthy();
    expect(screen.queryByText("Add an account")).toBeNull();
  });
});
