import { describe, expect, test } from "vitest";
import {
  describeAccept,
  fileUploadAnnouncements,
  focusAfterRemoval,
  formatFileSize,
  getFileUploadProps,
  matchesAccept,
  validateFiles,
} from "./file-upload.js";
import type { PickedFile } from "./file-upload.js";

const f = (name: string, type: string, size = 100): PickedFile => ({ name, type, size });

describe("matchesAccept", () => {
  test("MIME types, wildcards and extensions", () => {
    expect(matchesAccept(f("a.png", "image/png"), "image/*")).toBe(true);
    expect(matchesAccept(f("a.pdf", "application/pdf"), "application/pdf")).toBe(true);
    expect(matchesAccept(f("A.PDF", ""), ".pdf")).toBe(true);
    expect(matchesAccept(f("a.exe", "application/x-msdownload"), "image/*,.pdf")).toBe(false);
    expect(matchesAccept(f("a.exe", "application/x-msdownload"))).toBe(true);
  });
});

describe("validateFiles", () => {
  test("a dropped file outside accept is refused with a reason", () => {
    const r = validateFiles([f("a.exe", "application/octet-stream")], [], { accept: "image/*" });
    expect(r.files).toEqual([]);
    expect(r.rejections).toEqual([{ file: f("a.exe", "application/octet-stream"), reason: "type" }]);
  });

  test("too large is refused", () => {
    const r = validateFiles([f("big.png", "image/png", 2000)], [], { maxSize: 1000 });
    expect(r.rejections[0]!.reason).toBe("size");
  });

  test("multiple adds after existing files, up to maxFiles", () => {
    const existing = [f("1.png", "image/png")];
    const r = validateFiles([f("2.png", "image/png"), f("3.png", "image/png")], existing, {
      multiple: true,
      maxFiles: 2,
    });
    expect(r.files.map((x) => x.name)).toEqual(["1.png", "2.png"]);
    expect(r.added.map((x) => x.name)).toEqual(["2.png"]);
    expect(r.rejections).toEqual([{ file: f("3.png", "image/png"), reason: "count" }]);
  });

  test("single replaces the current choice with the first acceptable file", () => {
    const r = validateFiles([f("new.pdf", "application/pdf"), f("x.pdf", "application/pdf")], [f("old.pdf", "application/pdf")]);
    expect(r.files.map((x) => x.name)).toEqual(["new.pdf"]);
    expect(r.rejections.map((x) => x.reason)).toEqual(["count"]);
  });

  test("single keeps its file when nothing acceptable arrives", () => {
    const existing = [f("old.pdf", "application/pdf")];
    const r = validateFiles([f("a.exe", "x/y")], existing, { accept: ".pdf" });
    expect(r.files).toBe(existing);
  });

  test("carries the caller's progress and error through untouched", () => {
    const uploading = { ...f("1.png", "image/png"), progress: 40, error: "Timed out" };
    const r = validateFiles([f("2.png", "image/png")], [uploading], { multiple: true });
    expect(r.files[0]).toBe(uploading);
  });
});

describe("focusAfterRemoval", () => {
  test("next, previous at the end, or the choose control when empty", () => {
    expect(focusAfterRemoval(0, 3)).toEqual({ target: "remove", index: 0 });
    expect(focusAfterRemoval(2, 3)).toEqual({ target: "remove", index: 1 });
    expect(focusAfterRemoval(0, 1)).toEqual({ target: "choose" });
  });
});

describe("words", () => {
  test("file sizes in human units", () => {
    expect(formatFileSize(512, "en-US")).toBe("512 bytes");
    expect(formatFileSize(1_250_000, "en-US")).toBe("1.3 MB");
  });

  test("accept, restated", () => {
    expect(describeAccept("application/pdf,image/*")).toBe("PDF or image");
    expect(describeAccept("image/*,.pdf,.docx")).toBe("image, PDF or DOCX");
    expect(describeAccept("text/csv")).toBe("CSV");
    expect(describeAccept()).toBeNull();
  });

  test("announcements", () => {
    expect(fileUploadAnnouncements.added(2)).toBe("2 files added");
    expect(fileUploadAnnouncements.added(1)).toBe("1 file added");
    expect(fileUploadAnnouncements.removed("report.pdf")).toBe("report.pdf removed");
  });
});

describe("getFileUploadProps", () => {
  test("the native input is out of the tab order and carries accept and multiple", () => {
    const p = getFileUploadProps({ id: "u", files: [], accept: "image/*", multiple: true });
    expect(p.input).toEqual({ type: "file", accept: "image/*", multiple: true, tabIndex: -1 });
    expect(p.buttonLabel).toBe("Choose files");
    expect(getFileUploadProps({ id: "u", files: [] }).buttonLabel).toBe("Choose file");
    expect(getFileUploadProps({ id: "u", files: [], buttonLabel: "Attach" }).buttonLabel).toBe("Attach");
  });

  test("a row shows a bar only while progress is set, named by the file", () => {
    const p = getFileUploadProps({
      id: "u",
      files: [{ ...f("a.png", "image/png"), progress: 40 }, f("b.png", "image/png")],
    });
    expect(p.rows[0]!.progressbar).toEqual({
      role: "progressbar",
      "aria-labelledby": "u-file-0",
      "aria-valuemin": 0,
      "aria-valuemax": 100,
      "aria-valuenow": 40,
    });
    expect(p.rows[1]!.progressbar).toBeNull();
  });

  test("an error joins the remove control's description", () => {
    const p = getFileUploadProps({ id: "u", files: [{ ...f("a.png", "image/png"), error: "Too slow" }] });
    expect(p.rows[0]!.errorId).toBe("u-file-0-error");
    expect(p.rows[0]!.remove["aria-describedby"]).toBe("u-file-0-error");
    expect(p.rows[0]!.remove["aria-label"]).toBe("Remove a.png");
  });

  test("disabled marks every remove control", () => {
    const p = getFileUploadProps({ id: "u", files: [f("a.png", "image/png")], disabled: true });
    expect(p.rows[0]!.remove["aria-disabled"]).toBe(true);
  });
});
