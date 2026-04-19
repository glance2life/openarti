"use client";

import * as React from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

interface SegmentedControlProps<T extends string> {
  value: T;
  onValueChange: (value: T) => void;
  items: { value: T; label: React.ReactNode }[];
  className?: string;
  /** Unique layoutId prefix — needed if multiple SegmentedControls share a page */
  id?: string;
  "aria-label"?: string;
}

function SegmentedControlInner<T extends string>(
  {
    value,
    onValueChange,
    items,
    className,
    id = "seg",
    "aria-label": ariaLabel,
  }: SegmentedControlProps<T>,
  ref: React.ForwardedRef<HTMLDivElement>
) {
  const groupRef = React.useRef<HTMLDivElement | null>(null);
  const buttonRefs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const activeIndex = items.findIndex((i) => i.value === value);

  // If focus is already inside the group when `value` changes (e.g. via a
  // global hotkey or arrow keys), move it to the newly-active button so the
  // focus ring stays in sync with the selection.
  React.useEffect(() => {
    const group = groupRef.current;
    if (!group || !group.contains(document.activeElement)) return;
    const el = buttonRefs.current[activeIndex];
    if (el && el !== document.activeElement) el.focus();
  }, [activeIndex]);

  const setGroupRef = (el: HTMLDivElement | null) => {
    groupRef.current = el;
    if (typeof ref === "function") ref(el);
    else if (ref) ref.current = el;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    let next = activeIndex;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      next = (activeIndex + 1) % items.length;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      next = (activeIndex - 1 + items.length) % items.length;
    } else if (e.key === "Home") {
      next = 0;
    } else if (e.key === "End") {
      next = items.length - 1;
    } else {
      return;
    }
    e.preventDefault();
    if (next !== activeIndex) onValueChange(items[next].value);
  };

  return (
    <div
      ref={setGroupRef}
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      className={cn(
        "relative inline-flex items-center rounded-lg bg-muted p-0.5",
        className
      )}
    >
      {items.map((item, i) => {
        const isActive = item.value === value;
        return (
          <button
            key={item.value}
            ref={(el) => {
              buttonRefs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onValueChange(item.value)}
            className={cn(
              "relative z-10 flex items-center justify-center gap-1.5 rounded-md p-1.5 text-xs font-medium transition-colors duration-150",
              isActive
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground/80"
            )}
          >
            {isActive && (
              <motion.span
                layoutId={`${id}-indicator`}
                className="absolute inset-0 rounded-md bg-background shadow-sm"
                transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export const SegmentedControl = React.forwardRef(SegmentedControlInner) as <
  T extends string
>(
  props: SegmentedControlProps<T> & { ref?: React.ForwardedRef<HTMLDivElement> }
) => React.ReactElement;
