export type KeyChord = {
  mod?: boolean;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  key: string;
};

const MOD_TOKENS = new Set(["mod", "ctrl", "control", "shift", "alt", "option", "meta", "cmd", "command"]);

function parseChord(token: string): KeyChord {
  const parts = token.split("+").map((p) => p.trim()).filter(Boolean);
  const chord: KeyChord = { key: "" };
  for (const part of parts) {
    const lower = part.toLowerCase();
    if (MOD_TOKENS.has(lower)) {
      if (lower === "mod" || lower === "cmd" || lower === "command" || lower === "meta") chord.mod = true;
      else if (lower === "ctrl" || lower === "control") chord.ctrl = true;
      else if (lower === "shift") chord.shift = true;
      else if (lower === "alt" || lower === "option") chord.alt = true;
    } else {
      chord.key = normalizeKey(part);
    }
  }
  return chord;
}

function normalizeKey(key: string): string {
  if (key.length === 1) return key.toLowerCase();
  const lower = key.toLowerCase();
  switch (lower) {
    case "esc":
      return "escape";
    case "space":
      return " ";
    case "return":
      return "enter";
    default:
      return lower;
  }
}

export function parse(keys: string): KeyChord[] {
  return keys
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(parseChord);
}

export function isMac(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent || "");
}

export function matches(e: KeyboardEvent, chord: KeyChord): boolean {
  const eventKey = normalizeKey(e.key);
  if (eventKey !== chord.key) return false;

  const mac = isMac();
  const wantMeta = !!chord.mod && mac;
  const wantCtrl = (!!chord.mod && !mac) || !!chord.ctrl;

  if (e.metaKey !== wantMeta) return false;
  if (e.ctrlKey !== wantCtrl) return false;
  if (e.altKey !== !!chord.alt) return false;

  // Shift is required only when explicitly declared. For symbol keys like "?"
  // browsers report `e.key` already as the shifted glyph, so don't compare shiftKey
  // unless the chord asked for it.
  if (chord.shift && !e.shiftKey) return false;

  return true;
}

export function formatChord(chord: KeyChord, mac: boolean): string[] {
  const out: string[] = [];
  if (chord.mod) out.push(mac ? "⌘" : "Ctrl");
  if (chord.ctrl) out.push(mac ? "⌃" : "Ctrl");
  if (chord.alt) out.push(mac ? "⌥" : "Alt");
  if (chord.shift) out.push(mac ? "⇧" : "Shift");
  if (chord.key) out.push(displayKey(chord.key));
  return out;
}

function displayKey(key: string): string {
  if (key.length === 1) return key.toUpperCase();
  switch (key) {
    case "escape":
      return "Esc";
    case "arrowup":
      return "↑";
    case "arrowdown":
      return "↓";
    case "arrowleft":
      return "←";
    case "arrowright":
      return "→";
    case "enter":
      return "↵";
    case " ":
      return "Space";
    default:
      return key.charAt(0).toUpperCase() + key.slice(1);
  }
}
