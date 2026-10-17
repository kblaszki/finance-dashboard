import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TagsPage } from "./TagsPage";

vi.mock("../api/tagsApi", () => ({
  fetchTags: vi.fn(),
  createTag: vi.fn(),
  updateTag: vi.fn(),
  deleteTag: vi.fn(),
}));

import { createTag, deleteTag, fetchTags, updateTag } from "../api/tagsApi";

const tags = [
  { id: 1, name: "Personal", createdAt: "2026-01-01T00:00:00.000Z" },
  { id: 2, name: "Work", createdAt: "2026-01-01T00:00:00.000Z" },
];

function renderTags() {
  return render(
    <MemoryRouter initialEntries={["/tags"]}>
      <Routes>
        <Route path="/tags" element={<TagsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("TagsPage", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.mocked(fetchTags).mockResolvedValue(tags);
    vi.mocked(createTag).mockResolvedValue({
      id: 3,
      name: "Reimbursable",
      createdAt: "2026-01-02T00:00:00.000Z",
    });
    vi.mocked(updateTag).mockResolvedValue({
      id: 2,
      name: "Office",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    vi.mocked(deleteTag).mockResolvedValue(undefined);
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("lists tags and creates a new one", async () => {
    renderTags();
    expect(await screen.findByText("Work")).toBeTruthy();
    expect(screen.getByText("Personal")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("New tag name"), {
      target: { value: "Reimbursable" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add tag" }));

    await waitFor(() => {
      expect(createTag).toHaveBeenCalledWith({ name: "Reimbursable" });
    });
  });

  it("renames on double-click then Enter", async () => {
    renderTags();
    await screen.findByText("Work");
    fireEvent.doubleClick(screen.getByText("Work"));
    const input = screen.getByLabelText("Edit name");
    fireEvent.change(input, { target: { value: "Office" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => {
      expect(updateTag).toHaveBeenCalledWith(2, { name: "Office" });
    });
  });

  it("deletes with confirm", async () => {
    renderTags();
    await screen.findByText("Work");
    fireEvent.click(screen.getByRole("button", { name: "Delete Work" }));
    await waitFor(() => {
      expect(deleteTag).toHaveBeenCalledWith(2);
    });
  });
});
