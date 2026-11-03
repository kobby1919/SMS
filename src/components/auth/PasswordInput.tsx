"use client";

import { forwardRef, useCallback, useId, useLayoutEffect, useRef, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

const PasswordInput = forwardRef<HTMLInputElement, Props>(function PasswordInput(
  { id, className = "", style, disabled, ...props }, forwardedRef,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const selection = useRef<{ start: number | null; end: number | null; direction: "forward" | "backward" | "none" | null; focused: boolean } | null>(null);
  const [visible, setVisible] = useState(false);
  const label = visible ? "Hide password" : "Show password";
  const setInputRef = useCallback((node: HTMLInputElement | null) => {
    inputRef.current = node;
    if (typeof forwardedRef === "function") forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  }, [forwardedRef]);

  useLayoutEffect(() => {
    const input = inputRef.current;
    const previous = selection.current;
    if (!input || !previous) return;
    if (previous.focused) input.focus({ preventScroll: true });
    if (previous.start !== null && previous.end !== null) {
      input.setSelectionRange(previous.start, previous.end, previous.direction ?? undefined);
    }
    selection.current = null;
  }, [visible]);

  function toggleVisibility() {
    const input = inputRef.current;
    if (!input || disabled) return;
    selection.current = {
      start: input.selectionStart, end: input.selectionEnd, direction: input.selectionDirection,
      focused: document.activeElement === input,
    };
    setVisible((value) => !value);
  }

  return (
    <div className="relative min-w-0 w-full">
      <input
        {...props}
        id={inputId}
        ref={setInputRef}
        type={visible ? "text" : "password"}
        disabled={disabled}
        className={`${className} [appearance:none] [&::-ms-reveal]:hidden [&::-ms-clear]:hidden`}
        style={{ minHeight: "2.75rem", ...style, paddingInlineEnd: "3.5rem" }}
      />
      <button
        type="button"
        aria-label={label}
        aria-controls={inputId}
        aria-pressed={visible}
        title={label}
        disabled={disabled}
        onPointerDown={(event) => event.preventDefault()}
        onClick={toggleVisibility}
        className="absolute inset-y-0 right-1 my-auto flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 transition-colors hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {visible ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
      </button>
    </div>
  );
});

export default PasswordInput;
