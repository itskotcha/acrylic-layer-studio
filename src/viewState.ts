// Session-only view state, deliberately separate from project files and history.
export const views2D = new Map<
  string,
  { zoom: number; px: number; py: number }
>();
export const views3D = new Map<
  string,
  {
    position: [number, number, number];
    target: [number, number, number];
    zoomRatio: number;
    auto: boolean;
    exploded: boolean;
    quality: string;
  }
>();
export function resetViews() {
  views2D.clear();
  views3D.clear();
}
