import { describe, expect, it } from "vitest";
import { getTextFieldProps } from "./text-field.js";

describe("getTextFieldProps", () => {
  it("associates the label with the input", () => {
    const props = getTextFieldProps({ id: "email" });
    expect(props.label.htmlFor).toBe("email");
    expect(props.input.id).toBe("email");
  });

  it("describes the input with helper text when there is any", () => {
    const props = getTextFieldProps({ id: "email", hasDescription: true });
    expect(props.input["aria-describedby"]).toBe("email-description");
    expect(props.description.id).toBe("email-description");
  });

  it("leaves aria-describedby unset when nothing describes the input", () => {
    const props = getTextFieldProps({ id: "email" });
    expect(props.input["aria-describedby"]).toBeUndefined();
  });

  it("omits the message from aria-describedby while the status is idle", () => {
    const props = getTextFieldProps({
      id: "email",
      hasDescription: true,
      hasMessage: true,
    });
    expect(props.input["aria-describedby"]).toBe("email-description");
  });

  it("adds the message once a status is set, after the description", () => {
    const props = getTextFieldProps({
      id: "email",
      status: "invalid",
      hasDescription: true,
      hasMessage: true,
      describedBy: "form-hint",
    });
    expect(props.input["aria-describedby"]).toBe(
      "email-description email-message form-hint"
    );
  });

  it("marks the input invalid only in the invalid status", () => {
    expect(getTextFieldProps({ id: "a", status: "invalid" }).input["aria-invalid"]).toBe(true);
    expect(getTextFieldProps({ id: "a", status: "valid" }).input["aria-invalid"]).toBeUndefined();
    expect(getTextFieldProps({ id: "a" }).input["aria-invalid"]).toBeUndefined();
  });

  it("exposes aria-busy while validating", () => {
    const props = getTextFieldProps({ id: "a", status: "validating" });
    expect(props.input["aria-busy"]).toBe(true);
    expect(props.root["data-status"]).toBe("validating");
  });

  it("blocks editing with readOnly and aria-disabled, not the disabled attribute", () => {
    const props = getTextFieldProps({ id: "a", disabled: true });
    expect(props.input["aria-disabled"]).toBe(true);
    expect(props.input.readOnly).toBe(true);
    expect(props.root["data-disabled"]).toBe("");
    expect("disabled" in props.input).toBe(false);
  });

  it("announces the message politely, since it is already in aria-describedby", () => {
    expect(getTextFieldProps({ id: "a" }).message["aria-live"]).toBe("polite");
  });
});
