import { useEffect, useRef, useState } from "react";
import type { DragEvent, ReactNode } from "react";
import {
  fieldLabelId,
  fileUploadAnnouncements,
  focusAfterRemoval,
  getFileUploadProps,
  toPickedFile,
  validateFiles,
} from "@rata/primitives";
import type { FieldStatus, FileRejection, PickedFile } from "@rata/primitives";
import { File as FileGlyph, Icon, X } from "@rata/icons";
import { Button } from "./button.js";
import { Field } from "./field.js";
import { cx } from "./cx.js";

export type { FileRejection, PickedFile };

export interface FileUploadProps {
  /** What the files are for. Always required — `labelHidden` hides it, nothing removes it. */
  label: ReactNode;
  /** Which files are allowed, as MIME types and extensions: "image/*,.pdf". */
  accept?: string;
  /** Accepts more than one file. */
  multiple?: boolean;
  /** The most files the list may hold. Only meaningful with `multiple`. */
  maxFiles?: number;
  /** The largest file allowed, in bytes. */
  maxSize?: number;
  /** Controls the chosen files from outside, with the caller's per-file `progress` and `error`. */
  value?: PickedFile[];
  /** Fires with the whole accepted list whenever a file is added or removed. */
  onValueChange?: (files: PickedFile[]) => void;
  /** Fires with the files that were refused and why. */
  onReject?: (rejections: FileRejection[]) => void;
  /** Draws a drop target around the button, for dragging files in from the desktop. */
  dropzone?: boolean;
  /** The choose button's text. Defaults to "Choose file", or "Choose files" with `multiple`. */
  buttonLabel?: string;
  /** Form field name. A native form post submits exactly the listed files. */
  name?: string;
  /** Takes the label off screen while leaving it in the accessibility tree. */
  labelHidden?: boolean;
  /** Stable id for the file field. Defaults to a generated one. */
  id?: string;
  /** Validation lifecycle. Drives `aria-invalid`, `aria-busy`, the message tone and the drop zone's edge. */
  status?: FieldStatus;
  /** Persistent helper text under the control. */
  description?: ReactNode;
  /** Status-dependent message under the control. */
  message?: ReactNode;
  /** Marks the field required to assistive technology and in the label. */
  required?: boolean;
  /** Blocks choosing, dropping and removing while keeping the controls focusable and announced. */
  disabled?: boolean;
  /** Class for the wrapper — the width the form wants, not a restyle. */
  className?: string;
}

type FocusTarget = { target: "remove"; index: number } | { target: "choose" } | null;

/**
 * Choose files with a button or drop them in, see what was chosen, and remove
 * what was not meant. It CHOOSES; it does not upload (decision C11).
 *
 * A visually hidden native `<input type="file">` is the control — it owns the
 * OS dialog, the camera option on phones and form submission — and the
 * system's Button opens it. The drop zone around the button is a pointer
 * shortcut with no role and no tab stop.
 *
 * The primitive decides what may enter the list. What this wrapper owns are
 * the DOM acts:
 *
 * - WRITE-BACK. A file input's selection replaces itself on every pick and
 *   cannot be edited, so after every change the list is written back into it
 *   through a `DataTransfer`, and a form post sends exactly the visible files.
 * - FOCUS after a removal: the next file's remove button, the previous one at
 *   the end, or the choose button — never the body.
 * - The polite status region: "2 files added", "report.pdf removed", and a
 *   file's `error` when it appears. Rejections are not announced here; the
 *   caller's `message` is, through Field.
 */
export function FileUpload({
  label,
  accept,
  multiple = false,
  maxFiles,
  maxSize,
  value,
  onValueChange,
  onReject,
  dropzone = true,
  buttonLabel,
  name,
  labelHidden = false,
  id,
  status = "idle",
  description,
  message,
  required = false,
  disabled = false,
  className,
}: FileUploadProps) {
  const isControlled = value !== undefined;
  const [uncontrolled, setUncontrolled] = useState<PickedFile[]>([]);
  const files = isControlled ? value : uncontrolled;

  const [announcement, setAnnouncement] = useState("");
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const chooseRef = useRef<HTMLButtonElement | null>(null);
  const removeRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [focusTarget, setFocusTarget] = useState<FocusTarget>(null);

  const commit = (next: PickedFile[]) => {
    if (!isControlled) setUncontrolled(next);
    onValueChange?.(next);
  };

  const add = (candidates: File[]) => {
    if (disabled || candidates.length === 0) return;
    const result = validateFiles(candidates.map(toPickedFile), files, {
      accept,
      multiple,
      maxFiles,
      maxSize,
    });
    if (result.rejections.length > 0) onReject?.(result.rejections);
    if (result.added.length > 0) {
      commit(result.files);
      setAnnouncement(fileUploadAnnouncements.added(result.added.length));
    }
  };

  const remove = (index: number) => {
    if (disabled) return;
    const removed = files[index];
    if (!removed) return;
    commit(files.filter((_, i) => i !== index));
    setAnnouncement(fileUploadAnnouncements.removed(removed.name));
    setFocusTarget(focusAfterRemoval(index, files.length));
  };

  // The list and the submission cannot disagree: after every change the
  // listed files are what the native input holds.
  const writeBack = (list: PickedFile[]) => {
    const input = inputRef.current;
    if (!input || typeof DataTransfer === "undefined") return;
    const transfer = new DataTransfer();
    for (const picked of list) if (picked.file) transfer.items.add(picked.file);
    input.files = transfer.files;
  };
  useEffect(() => writeBack(files), [files]);

  // Focus moves once the removed row has left the DOM.
  useEffect(() => {
    if (focusTarget === null) return;
    if (focusTarget.target === "choose") chooseRef.current?.focus();
    else removeRefs.current[focusTarget.index]?.focus();
    setFocusTarget(null);
  }, [focusTarget]);

  // A file's error is announced when it appears, not on every render.
  const announcedErrors = useRef(new Map<PickedFile, string>());
  useEffect(() => {
    const seen = announcedErrors.current;
    for (const picked of files) {
      if (picked.error && seen.get(picked) !== picked.error) {
        setAnnouncement(fileUploadAnnouncements.failed(picked.name, picked.error));
      }
    }
    announcedErrors.current = new Map(
      files.filter((p) => p.error).map((p) => [p, p.error as string])
    );
  }, [files]);

  const hasFiles = (event: DragEvent) => event.dataTransfer?.types?.includes("Files") ?? false;
  const dropHandlers = {
    onDragEnter: (event: DragEvent<HTMLDivElement>) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      dragDepth.current += 1;
      if (!disabled) setDragging(true);
    },
    onDragOver: (event: DragEvent<HTMLDivElement>) => {
      if (!hasFiles(event)) return;
      // Prevented even when disabled, so a refused drop does not make the
      // browser navigate to the file instead.
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = disabled ? "none" : "copy";
    },
    onDragLeave: () => {
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setDragging(false);
    },
    onDrop: (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      add([...(event.dataTransfer?.files ?? [])]);
    },
  };

  return (
    <Field
      className={cx("rata-file-upload", className)}
      label={label}
      labelHidden={labelHidden}
      id={id}
      status={status}
      description={description}
      message={message}
      required={required}
      disabled={disabled}
    >
      {({ readOnly: _readOnly, "aria-describedby": describedBy, "aria-disabled": _ariaDisabled, ...control }) => {
        const upload = getFileUploadProps({
          id: control.id,
          files,
          accept,
          multiple,
          disabled,
          buttonLabel,
        });
        const buttonDescribedBy =
          [upload.acceptDescription?.id, describedBy].filter(Boolean).join(" ") || undefined;

        const choose = (
          <Button
            ref={chooseRef}
            type="button"
            variant="secondary"
            disabled={disabled}
            aria-describedby={buttonDescribedBy}
            onClick={() => inputRef.current?.click()}
          >
            {upload.buttonLabel}
          </Button>
        );

        return (
          <div
            className="rata-file-upload-group"
            role="group"
            aria-labelledby={fieldLabelId(control.id)}
            aria-describedby={describedBy}
          >
            {/* The control itself: visually hidden and out of the tab order;
                the Button stands in for it. The label's `for` reaches it, so
                clicking the label opens the dialog too. */}
            <input
              {...control}
              {...upload.input}
              ref={inputRef}
              name={name}
              className="rata-visually-hidden"
              // The label's `for` would open the dialog past the Button's
              // guard, so a disabled field refuses the click here too.
              onClick={(event) => {
                if (disabled) event.preventDefault();
              }}
              onChange={(event) => {
                const picked = [...(event.currentTarget.files ?? [])];
                // The native selection replaced itself. Put the listed files
                // back first, so a pick that adds nothing — all refused —
                // leaves the input agreeing with the list; an accepted pick
                // changes the list and the effect writes it again.
                writeBack(files);
                add(picked);
              }}
            />
            {upload.acceptDescription && (
              <span className="rata-visually-hidden" id={upload.acceptDescription.id}>
                {upload.acceptDescription.text}
              </span>
            )}

            {dropzone ? (
              <div
                className="rata-file-upload-dropzone"
                data-dragging={dragging ? "" : undefined}
                {...dropHandlers}
              >
                {choose}
                <p className="rata-file-upload-hint">
                  {multiple ? "or drag files here" : "or drag a file here"}
                </p>
              </div>
            ) : (
              choose
            )}

            {upload.rows.length > 0 && (
              <ul className="rata-file-upload-list">
                {upload.rows.map((row, index) => (
                  <li
                    key={`${row.file.name}-${index}`}
                    className="rata-file-upload-row"
                    data-error={row.file.error ? "" : undefined}
                  >
                    <Icon icon={FileGlyph} className="rata-file-upload-row-icon" />
                    <span className="rata-file-upload-row-body">
                      <span className="rata-file-upload-row-head">
                        <span className="rata-file-upload-row-name" id={row.nameId}>
                          {row.file.name}
                        </span>
                        <span className="rata-file-upload-row-size">{row.size}</span>
                      </span>
                      {row.progressbar && (
                        <span className="rata-file-upload-progress" {...row.progressbar}>
                          <span
                            className="rata-file-upload-progress-fill"
                            style={{ inlineSize: `${row.progressbar["aria-valuenow"]}%` }}
                          />
                        </span>
                      )}
                      {row.errorId && (
                        <span className="rata-file-upload-row-error" id={row.errorId}>
                          {row.file.error}
                        </span>
                      )}
                    </span>
                    <button
                      {...row.remove}
                      ref={(node) => {
                        removeRefs.current[index] = node;
                      }}
                      className="rata-file-upload-remove rata-state-layer rata-state-layer--flush"
                      onClick={() => remove(index)}
                    >
                      <Icon icon={X} />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <span className="rata-visually-hidden" role="status" aria-live="polite">
              {announcement}
            </span>
          </div>
        );
      }}
    </Field>
  );
}
