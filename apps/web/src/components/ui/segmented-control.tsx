"use client";

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";

interface SegmentedControlProps<T extends string> {
  value: T;
  onValueChange: (value: T) => void;
  items: { value: T; label: React.ReactNode }[];
  className?: string;
  /** Unique layoutId prefix — needed if multiple SegmentedControls share a page */
  id?: string;
}

function SegmentedControlInner<T extends string>(
  { value, onValueChange, items, className, id = "seg" }: SegmentedControlProps<T>,
  ref: React.ForwardedRef<HTMLDivElement>
) {
  return (
    <div
      ref={ref}
      className={cn(
        "relative inline-flex items-center rounded-lg bg-muted p-0.5",
        className
      )}
    >
      {items.map((item) => {
        const isActive = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
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
