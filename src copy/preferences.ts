import { create } from "zustand";
import { persist } from "zustand/middleware";
export const usePreferences = create(
  persist<{
    theme: "light" | "dark" | "system";
    desk: "white" | "gray" | "black" | "checker";
    snap: boolean;
    exportEdge: number;
    embedFonts: boolean;
    set: (
      v: Partial<{
        theme: "light" | "dark" | "system";
        desk: "white" | "gray" | "black" | "checker";
        snap: boolean;
        exportEdge: number;
        embedFonts: boolean;
      }>,
    ) => void;
  }>(
    (set) => ({
      theme: "system",
      desk: "checker",
      snap: true,
      exportEdge: 2048,
      embedFonts: true,
      set: (v) => set(v),
    }),
    { name: "acrylic-preferences-v2" },
  ),
);
