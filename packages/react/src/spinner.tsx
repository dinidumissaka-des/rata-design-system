export interface SpinnerProps {
  /** Accessible label; omit when a parent already conveys the loading state. */
  label?: string;
}

export function Spinner({ label }: SpinnerProps) {
  return (
    <span
      className="rata-spinner"
      role={label ? "status" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}
