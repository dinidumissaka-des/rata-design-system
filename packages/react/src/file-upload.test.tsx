import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { FileUpload } from "./file-upload.js";
import type { PickedFile } from "./file-upload.js";

/**
 * Validation, focus targets and wording are the primitive's and are tested
 * there. Asserted here: the group and its controls, the native input behind
 * the Button, re-validation of dropped files, focus after a removal, the
 * polite region, and the caller's progress and error on each row.
 */
afterEach(cleanup);

const file = (name: string, type: string, size = 1000) => new File(["x".repeat(size)], name, { type });
const nativeInput = (container: HTMLElement) =>
  container.querySelector('input[type="file"]') as HTMLInputElement;

function drop(target: Element, files: File[]) {
  const dataTransfer = { files, types: ["Files"], dropEffect: "none" };
  fireEvent.dragEnter(target, { dataTransfer });
  fireEvent.dragOver(target, { dataTransfer });
  fireEvent.drop(target, { dataTransfer });
}

describe("FileUpload", () => {
  test("a group named by the label, with a Button standing in for the hidden native input", () => {
    const { container } = render(<FileUpload label="Proof of address" accept="application/pdf,image/*" name="proof" />);
    expect(screen.getByRole("group", { name: "Proof of address" })).toBeTruthy();
    const input = nativeInput(container);
    expect(input.tabIndex).toBe(-1);
    expect(input.className).toContain("rata-visually-hidden");
    expect(input.accept).toBe("application/pdf,image/*");
    expect(input.name).toBe("proof");
    const button = screen.getByRole("button", { name: "Choose file" });
    expect(button.className).toContain("rata-button");
  });

  test("accept is restated in words ahead of the helper text", () => {
    render(
      <FileUpload label="Proof of address" accept="application/pdf,image/*" description="Up to 10 MB." />
    );
    const ids = screen.getByRole("button", { name: "Choose file" }).getAttribute("aria-describedby")!.split(" ");
    expect(ids.map((id) => document.getElementById(id)?.textContent)).toEqual(["PDF or image", "Up to 10 MB."]);
  });

  test("the button opens the native dialog", async () => {
    const user = userEvent.setup();
    const { container } = render(<FileUpload label="Attachments" />);
    const click = vi.spyOn(nativeInput(container), "click");
    await user.click(screen.getByRole("button", { name: "Choose file" }));
    expect(click).toHaveBeenCalled();
  });

  test("multiple says so on the button, and picks are listed and announced", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { container } = render(<FileUpload label="Attachments" multiple onValueChange={onValueChange} />);
    expect(screen.getByRole("button", { name: "Choose files" })).toBeTruthy();
    await user.upload(nativeInput(container), [file("a.pdf", "application/pdf"), file("b.pdf", "application/pdf")]);
    expect(onValueChange.mock.calls[0]![0].map((f: PickedFile) => f.name)).toEqual(["a.pdf", "b.pdf"]);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByRole("status").textContent).toBe("2 files added");
  });

  test("a dropped file outside accept is refused through onReject, not listed", () => {
    const onReject = vi.fn();
    const { container } = render(<FileUpload label="Photos" multiple accept="image/*" onReject={onReject} />);
    drop(container.querySelector(".rata-file-upload-dropzone")!, [file("setup.exe", "application/x-msdownload")]);
    expect(onReject).toHaveBeenCalledWith([expect.objectContaining({ reason: "type" })]);
    expect(onReject.mock.calls[0]![0][0].file.name).toBe("setup.exe");
    expect(screen.queryByRole("listitem")).toBeNull();
  });

  test("the drop zone has no role and no tab stop, and shows drag-over", () => {
    const { container } = render(<FileUpload label="Photos" />);
    const zone = container.querySelector(".rata-file-upload-dropzone")!;
    expect(zone.getAttribute("role")).toBeNull();
    expect(zone.getAttribute("tabindex")).toBeNull();
    fireEvent.dragEnter(zone, { dataTransfer: { files: [], types: ["Files"] } });
    expect(zone.hasAttribute("data-dragging")).toBe(true);
    fireEvent.dragLeave(zone);
    expect(zone.hasAttribute("data-dragging")).toBe(false);
  });

  test("dropzone={false} is the button alone", () => {
    const { container } = render(<FileUpload label="Attachments" dropzone={false} buttonLabel="Attach files" />);
    expect(container.querySelector(".rata-file-upload-dropzone")).toBeNull();
    expect(screen.getByRole("button", { name: "Attach files" })).toBeTruthy();
  });

  test("removing moves focus to the next file, the previous at the end, then the button", async () => {
    const user = userEvent.setup();
    const { container } = render(<FileUpload label="Attachments" multiple />);
    await user.upload(nativeInput(container), [
      file("a.pdf", "application/pdf"),
      file("b.pdf", "application/pdf"),
      file("c.pdf", "application/pdf"),
    ]);
    await user.click(screen.getByRole("button", { name: "Remove a.pdf" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Remove b.pdf" }));
    expect(screen.getByRole("status").textContent).toBe("a.pdf removed");
    await user.click(screen.getByRole("button", { name: "Remove c.pdf" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Remove b.pdf" }));
    await user.click(screen.getByRole("button", { name: "Remove b.pdf" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Choose files" }));
  });

  test("rows show the caller's progress and error, and the component sets neither", () => {
    const files: PickedFile[] = [
      { name: "a.pdf", size: 1000, type: "application/pdf", progress: 40 },
      { name: "b.pdf", size: 1000, type: "application/pdf", error: "Upload failed. Try again." },
    ];
    render(<FileUpload label="Attachments" multiple value={files} />);
    const bar = screen.getByRole("progressbar", { name: "a.pdf" });
    expect(bar.getAttribute("aria-valuenow")).toBe("40");
    const remove = screen.getByRole("button", { name: "Remove b.pdf" });
    const errorId = remove.getAttribute("aria-describedby")!;
    expect(document.getElementById(errorId)?.textContent).toBe("Upload failed. Try again.");
    expect(screen.getAllByRole("progressbar")).toHaveLength(1);
  });

  test("a file's error is announced when it appears", () => {
    function Stage() {
      const [files, setFiles] = useState<PickedFile[]>([{ name: "a.pdf", size: 1, type: "application/pdf" }]);
      return (
        <>
          <FileUpload label="Attachments" value={files} />
          <button type="button" onClick={() => setFiles([{ ...files[0]!, error: "Timed out" }])}>
            fail
          </button>
        </>
      );
    }
    render(<Stage />);
    expect(screen.getByRole("status").textContent).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "fail" }));
    expect(screen.getByRole("status").textContent).toBe("a.pdf: Timed out");
  });

  test("disabled: controls stay focusable, choosing, dropping and removing are refused", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const files: PickedFile[] = [{ name: "a.pdf", size: 1, type: "application/pdf" }];
    const { container } = render(
      <FileUpload label="Attachments" multiple disabled value={files} onValueChange={onValueChange} />
    );
    const choose = screen.getByRole("button", { name: "Choose files" });
    const remove = screen.getByRole("button", { name: "Remove a.pdf" });
    expect(choose.getAttribute("aria-disabled")).toBe("true");
    expect(remove.getAttribute("aria-disabled")).toBe("true");
    const click = vi.spyOn(nativeInput(container), "click");
    await user.click(choose);
    expect(click).not.toHaveBeenCalled();
    await user.click(remove);
    drop(container.querySelector(".rata-file-upload-dropzone")!, [file("b.pdf", "application/pdf")]);
    expect(onValueChange).not.toHaveBeenCalled();
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    remove.focus();
    expect(document.activeElement).toBe(remove);
  });

  test("composes Field: invalid status and message", () => {
    const { container } = render(
      <FileUpload label="Photos" status="invalid" message="setup.exe is not an image." />
    );
    expect(container.querySelector(".rata-file-upload")!.getAttribute("data-status")).toBe("invalid");
    const ids = screen.getByRole("button", { name: "Choose file" }).getAttribute("aria-describedby")!;
    expect(document.getElementById(ids)?.textContent).toBe("setup.exe is not an image.");
  });
});
