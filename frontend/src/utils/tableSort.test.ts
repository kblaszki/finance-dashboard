import { describe, expect, it } from "vitest";
import {
  ariaSortValue,
  sortBy,
  toggleSort,
  type SortState,
} from "./tableSort";

describe("toggleSort", () => {
  it("starts ascending then flips", () => {
    const first = toggleSort(null, "name");
    expect(first).toEqual({ key: "name", dir: "asc" });
    expect(toggleSort(first, "name")).toEqual({ key: "name", dir: "desc" });
    expect(toggleSort(first, "amount")).toEqual({ key: "amount", dir: "asc" });
  });
});

describe("ariaSortValue", () => {
  it("maps state to aria-sort", () => {
    const sort: SortState<"name"> = { key: "name", dir: "desc" };
    expect(ariaSortValue(sort, "name")).toBe("descending");
    expect(ariaSortValue(sort, "other")).toBe("none");
  });
});

describe("sortBy", () => {
  type Row = { name: string; amount: number };
  const rows: Row[] = [
    { name: "Beta", amount: 10 },
    { name: "Alpha", amount: 30 },
    { name: "Gamma", amount: 20 },
  ];
  const getters = {
    name: (r: Row) => r.name,
    amount: (r: Row) => r.amount,
  };

  it("sorts strings and numbers", () => {
    expect(
      sortBy(rows, { key: "name", dir: "asc" }, getters).map((r) => r.name),
    ).toEqual(["Alpha", "Beta", "Gamma"]);

    expect(
      sortBy(rows, { key: "amount", dir: "desc" }, getters).map((r) => r.amount),
    ).toEqual([30, 20, 10]);
  });

  it("returns original order when sort is null", () => {
    expect(sortBy(rows, null, getters)).toBe(rows);
  });
});
