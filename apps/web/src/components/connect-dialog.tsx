"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ConnectAgents,
  ConnectReturnToContext,
  STARTER_PROMPTS,
} from "@/components/connect-agents";
import { Check, Copy, Sparkles } from "lucide-react";

interface ConnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConnectDialog({ open, onOpenChange }: ConnectDialogProps) {
  const [committed, setCommitted] = useState(false);

  useEffect(() => {
    if (!open) setCommitted(false);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl h-[70vh] top-[12%] -translate-y-0 p-0 gap-0 flex flex-col">
        <DialogHeader className="sr-only">
          <DialogTitle>Connect</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 px-6 pt-6 pb-2">
          <ConnectReturnToContext.Provider value="connect">
            <ConnectAgents scrollable onCommit={() => setCommitted(true)} />
          </ConnectReturnToContext.Provider>
        </div>
      </DialogContent>
      {open && <StarterPromptsStrip visible={committed} />}
    </Dialog>
  );
}

function StarterPromptsStrip({ visible }: { visible: boolean }) {
  const [mounted, setMounted] = useState(false);
  const reduce = useReducedMotion();
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-6"
      style={{ top: "calc(82vh + 14px)" }}
    >
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
            transition={
              reduce
                ? { duration: 0.15 }
                : { type: "spring", stiffness: 420, damping: 30, mass: 0.7 }
            }
            className="pointer-events-auto flex items-center gap-3 rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white shadow-lg"
          >
            <div className="flex shrink-0 items-center gap-1.5 text-white/75">
              <motion.span
                initial={reduce ? false : { scale: 0, rotate: -30 }}
                animate={reduce ? undefined : { scale: 1, rotate: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 500,
                  damping: 14,
                  delay: 0.08,
                }}
                className="inline-flex"
              >
                <Sparkles className="size-4" />
              </motion.span>
              <span>Once connected, try</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
              {STARTER_PROMPTS.map((p, i) => (
                <PromptPill
                  key={p}
                  prompt={p}
                  typeDelayMs={reduce ? 0 : 260 + i * 120}
                  instant={!!reduce}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    document.body,
  );
}

function PromptPill({
  prompt,
  typeDelayMs,
  instant,
}: {
  prompt: string;
  typeDelayMs: number;
  instant: boolean;
}) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 text-white/85 transition-colors hover:text-white"
    >
      {copied ? (
        <Check className="size-3.5 shrink-0 text-green-400" />
      ) : (
        <Copy className="size-3.5 shrink-0 text-white/50" />
      )}
      <Typewriter text={prompt} delayMs={typeDelayMs} instant={instant} />
    </button>
  );
}

function Typewriter({
  text,
  delayMs,
  instant,
}: {
  text: string;
  delayMs: number;
  instant: boolean;
}) {
  const [count, setCount] = useState(instant ? text.length : 0);

  useEffect(() => {
    if (instant) {
      setCount(text.length);
      return;
    }
    setCount(0);
    let i = 0;
    let raf = 0;
    const startTimer = window.setTimeout(() => {
      const tick = () => {
        i += 1;
        setCount(i);
        if (i < text.length) {
          raf = window.setTimeout(tick, 22) as unknown as number;
        }
      };
      tick();
    }, delayMs);
    return () => {
      window.clearTimeout(startTimer);
      window.clearTimeout(raf);
    };
  }, [text, delayMs, instant]);

  const shown = text.slice(0, count);
  const done = count >= text.length;
  return (
    <span className="relative whitespace-pre">
      {shown}
      {!done && (
        <span
          aria-hidden
          className="ml-0.5 inline-block h-3.5 w-px -translate-y-[1px] animate-pulse bg-white/70 align-middle"
        />
      )}
      <span className="sr-only">{text}</span>
    </span>
  );
}
