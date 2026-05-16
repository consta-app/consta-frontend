import { forwardRef } from "react";
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  TextareaHTMLAttributes,
  HTMLAttributes,
} from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border border-accent bg-accent/10 text-accent hover:bg-accent/20 disabled:opacity-50 disabled:hover:bg-accent/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
  secondary:
    "border border-border-strong text-text hover:border-text-muted disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
  ghost: "text-text-muted hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
  danger:
    "border border-danger/60 text-danger hover:bg-danger/10 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }
>(function Button({ className = "", variant = "primary", ...rest }, ref) {
  return (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center gap-2 rounded px-4 py-2 text-sm font-medium transition-colors ${variantClasses[variant]} ${className}`}
      {...rest}
    />
  );
});

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function Input({ className = "", ...rest }, ref) {
  return (
    <input
      ref={ref}
      className={`w-full rounded border border-border-strong bg-bg-elevated px-3 py-2 text-sm text-text placeholder:text-text-dim outline-none focus:border-accent ${className}`}
      {...rest}
    />
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className = "", ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      className={`w-full rounded border border-border-strong bg-bg-elevated px-3 py-2 text-sm text-text placeholder:text-text-dim outline-none focus:border-accent leading-relaxed ${className}`}
      {...rest}
    />
  );
});

export function Label({
  className = "",
  ...rest
}: HTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={`block text-xs font-mono uppercase tracking-[0.18em] text-text-dim ${className}`}
      {...rest}
    />
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-text-dim">{hint}</p> : null}
    </div>
  );
}

export function Card({
  className = "",
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded border border-border bg-bg-elevated ${className}`}
      {...rest}
    />
  );
}

export function Mono({
  className = "",
  ...rest
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={`font-mono text-xs break-all text-text-muted ${className}`}
      {...rest}
    />
  );
}

export function Pill({
  className = "",
  ...rest
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={`inline-flex items-center rounded-full border border-border-strong px-2.5 py-0.5 text-[10px] uppercase tracking-[0.15em] font-mono text-text-muted ${className}`}
      {...rest}
    />
  );
}
