import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function Boom() {
  throw new Error("boom");
}

describe("ErrorBoundary", () => {
  it("shows error UI when a child throws", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <MemoryRouter>
        <ErrorBoundary>
          <Boom />
        </ErrorBoundary>
      </MemoryRouter>,
    );
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText("Something went wrong.")).toBeTruthy();
    spy.mockRestore();
  });

  it("clears error state when remounted with a new key", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { rerender } = render(
      <MemoryRouter>
        <ErrorBoundary key="/a">
          <Boom />
        </ErrorBoundary>
      </MemoryRouter>,
    );
    expect(screen.getByRole("alert")).toBeTruthy();

    rerender(
      <MemoryRouter>
        <ErrorBoundary key="/b">
          <p>recovered</p>
        </ErrorBoundary>
      </MemoryRouter>,
    );
    expect(screen.getByText("recovered")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    spy.mockRestore();
  });
});
