/**
 * Headless FILE UPLOAD behavior — choosing, validating and listing files.
 *
 * It does not upload. Uploading is a network policy (chunking, retries, auth,
 * cancellation) that belongs to the caller; what this owns is which files may
 * enter the list, where focus goes when one leaves it, and what the polite
 * status region says. All pure: the `DataTransfer` write-back and the drag
 * events are DOM acts, and live in the wrapper.
 *
 * WHY IT RE-VALIDATES. `accept` filters the OS dialog only as a suggestion,
 * and drag and drop bypasses it entirely, so every candidate is checked
 * against `accept`, `maxSize` and `maxFiles` before it enters the list, and
 * the refusals come back with a reason for the caller to word.
 *
 * Per-file `progress` and `error` are the caller's (decision C11): they ride
 * on the `PickedFile` items and are carried through untouched.
 */

/** A chosen file. The same shape on web and native; `file` is web's handle, `uri` native's. */
export interface PickedFile {
  name: string;
  size: number;
  type: string;
  file?: File;
  uri?: string;
  /** Upload progress, 0–100, set by the caller's uploader. Never set here. */
  progress?: number;
  /** Why this file failed, set by the caller's uploader. Never set here. */
  error?: string;
}

export type FileRejectionReason = "type" | "size" | "count";

export interface FileRejection {
  file: PickedFile;
  reason: FileRejectionReason;
}

export interface FileConstraints {
  accept?: string;
  multiple?: boolean;
  maxFiles?: number;
  maxSize?: number;
}

/** Whether a file matches an `accept` string: MIME types, `type/*` wildcards and `.ext` extensions. */
export function matchesAccept(file: Pick<PickedFile, "name" | "type">, accept?: string): boolean {
  if (accept === undefined || accept.trim() === "") return true;
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return accept
    .split(",")
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean)
    .some((token) => {
      if (token.startsWith(".")) return name.endsWith(token);
      if (token.endsWith("/*")) return type.startsWith(token.slice(0, -1));
      return type === token;
    });
}

/**
 * Splits candidates into what may join the list and what is refused.
 *
 * Without `multiple` a new choice REPLACES the current one, the way the
 * native input behaves, and only the first acceptable candidate is taken.
 * With it, candidates are added after the existing files until `maxFiles`.
 */
export function validateFiles(
  candidates: PickedFile[],
  existing: PickedFile[],
  constraints: FileConstraints = {}
): { files: PickedFile[]; added: PickedFile[]; rejections: FileRejection[] } {
  const { accept, multiple = false, maxFiles, maxSize } = constraints;
  const limit = multiple ? maxFiles ?? Infinity : 1;
  const base = multiple ? existing : [];
  const added: PickedFile[] = [];
  const rejections: FileRejection[] = [];

  for (const file of candidates) {
    if (!matchesAccept(file, accept)) rejections.push({ file, reason: "type" });
    else if (maxSize !== undefined && file.size > maxSize) rejections.push({ file, reason: "size" });
    else if (base.length + added.length >= limit) rejections.push({ file, reason: "count" });
    else added.push(file);
  }

  // Nothing acceptable leaves a single-file field's current choice alone,
  // rather than replacing a good file with nothing.
  const files = !multiple && added.length === 0 ? existing : [...base, ...added];
  return { files, added, rejections };
}

/** A File (or anything shaped like one) as a `PickedFile`. */
export function toPickedFile(file: File): PickedFile {
  return { name: file.name, size: file.size, type: file.type, file };
}

/**
 * Where focus goes after the file at `index` is removed from a list of
 * `length`: the next file's remove control, the previous one at the end, or
 * the choose control when the list empties. The pressed control no longer
 * exists, and focus on a removed node falls to the top of the page.
 */
export function focusAfterRemoval(
  index: number,
  length: number
): { target: "remove"; index: number } | { target: "choose" } {
  const remaining = length - 1;
  if (remaining <= 0) return { target: "choose" };
  return { target: "remove", index: Math.min(index, remaining - 1) };
}

/** Bytes in human units at the page's locale — "1.2 MB". Decimal units, as file managers show. */
export function formatFileSize(bytes: number, locale?: string): string {
  const units = ["byte", "kilobyte", "megabyte", "gigabyte", "terabyte"] as const;
  let value = bytes;
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit += 1;
  }
  return new Intl.NumberFormat(locale, {
    style: "unit",
    unit: units[unit],
    // "512 byte" is what the short form gives for bytes; the long form reads.
    unitDisplay: unit === 0 ? "long" : "short",
    maximumFractionDigits: unit === 0 ? 0 : 1,
  }).format(value);
}

/** What the polite region says. */
export const fileUploadAnnouncements = {
  added: (count: number) => `${count} ${count === 1 ? "file" : "files"} added`,
  removed: (name: string) => `${name} removed`,
  failed: (name: string, error: string) => `${name}: ${error}`,
};

const KNOWN: Record<string, string> = {
  "image/*": "image",
  "video/*": "video",
  "audio/*": "audio",
  "text/*": "text file",
  "application/pdf": "PDF",
  ".pdf": "PDF",
};

/**
 * `accept` in words — "PDF or image" — for the description chain, because a
 * reader who cannot see a file dialog's filter never learns it. `null`
 * without an `accept`.
 */
export function describeAccept(accept?: string): string | null {
  if (accept === undefined || accept.trim() === "") return null;
  const words: string[] = [];
  for (const raw of accept.split(",")) {
    const token = raw.trim().toLowerCase();
    if (!token) continue;
    const word =
      KNOWN[token] ??
      (token.startsWith(".")
        ? token.slice(1).toUpperCase()
        : (token.split("/")[1] ?? token).replace(/^x-/, "").split(/[.+]/).pop()!.toUpperCase());
    if (!words.includes(word)) words.push(word);
  }
  if (words.length === 0) return null;
  if (words.length === 1) return words[0]!;
  return `${words.slice(0, -1).join(", ")} or ${words[words.length - 1]}`;
}

export interface FileUploadOptions {
  id: string;
  files: PickedFile[];
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  buttonLabel?: string;
  locale?: string;
}

export interface FileUploadRow {
  file: PickedFile;
  /** Formatted size, "1.2 MB". */
  size: string;
  nameId: string;
  errorId: string | undefined;
  /** The row's bar, while the caller has set `progress`; `null` otherwise. */
  progressbar: {
    role: "progressbar";
    "aria-labelledby": string;
    "aria-valuemin": 0;
    "aria-valuemax": 100;
    "aria-valuenow": number;
  } | null;
  remove: {
    type: "button";
    "aria-label": string;
    "aria-describedby": string | undefined;
    "aria-disabled": true | undefined;
  };
}

export interface FileUploadProps {
  input: {
    type: "file";
    accept: string | undefined;
    multiple: boolean;
    tabIndex: -1;
  };
  buttonLabel: string;
  acceptDescription: { id: string; text: string } | null;
  rows: FileUploadRow[];
}

export function getFileUploadProps(options: FileUploadOptions): FileUploadProps {
  const { id, files, accept, multiple = false, disabled = false, buttonLabel, locale } = options;
  const words = describeAccept(accept);
  return {
    input: { type: "file", accept, multiple, tabIndex: -1 },
    buttonLabel: buttonLabel ?? (multiple ? "Choose files" : "Choose file"),
    acceptDescription: words === null ? null : { id: `${id}-accept`, text: words },
    rows: files.map((file, index) => {
      const nameId = `${id}-file-${index}`;
      const errorId = file.error ? `${id}-file-${index}-error` : undefined;
      return {
        file,
        size: formatFileSize(file.size, locale),
        nameId,
        errorId,
        progressbar:
          file.progress === undefined
            ? null
            : {
                role: "progressbar",
                "aria-labelledby": nameId,
                "aria-valuemin": 0,
                "aria-valuemax": 100,
                "aria-valuenow": Math.min(100, Math.max(0, file.progress)),
              },
        remove: {
          type: "button",
          "aria-label": `Remove ${file.name}`,
          // The error is heard with the file it belongs to.
          "aria-describedby": errorId,
          "aria-disabled": disabled || undefined,
        },
      };
    }),
  };
}
