"use client";

import { useState, useEffect, useCallback } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export interface PinItem {
  id: string;
  targetType: "repo" | "file" | "dir";
  targetPath: string;
  displayOrder: number;
}

export function usePins(teamName: string) {
  const [pins, setPins] = useState<PinItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPins = useCallback(async () => {
    if (!teamName) return;
    try {
      const res = await fetch(`${API_URL}/pins/${teamName}`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setPins(data.pins);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [teamName]);

  useEffect(() => {
    setLoading(true);
    fetchPins();
  }, [fetchPins]);

  const addPin = useCallback(
    async (targetType: "repo" | "file" | "dir", targetPath: string) => {
      try {
        const res = await fetch(`${API_URL}/pins/${teamName}`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetType, targetPath }),
        });
        if (res.ok) {
          const data = await res.json();
          setPins((prev) => [...prev, data.pin]);
        }
      } catch {
        // ignore
      }
    },
    [teamName]
  );

  const removePin = useCallback(
    async (pinId: string) => {
      try {
        const res = await fetch(`${API_URL}/pins/${teamName}/${pinId}`, {
          method: "DELETE",
          credentials: "include",
        });
        if (res.ok) {
          setPins((prev) => prev.filter((p) => p.id !== pinId));
        }
      } catch {
        // ignore
      }
    },
    [teamName]
  );

  const removePinByPath = useCallback(
    async (targetPath: string) => {
      const pin = pins.find((p) => p.targetPath === targetPath);
      if (pin) {
        await removePin(pin.id);
      }
    },
    [pins, removePin]
  );

  const isPinned = useCallback(
    (targetPath: string) => pins.some((p) => p.targetPath === targetPath),
    [pins]
  );

  return { pins, loading, addPin, removePin, removePinByPath, isPinned };
}
