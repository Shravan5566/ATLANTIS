/**
 * hoverStore.ts - High-performance decoupled hover & crosshair state
 * 
 * Prevents root component re-render cascades in React when moving the mouse over the Cesium globe.
 * InfoBar subscribes directly to this store, allowing 60+ FPS navigation.
 */

export interface HoverInfo {
  latitude: number | null;
  longitude: number | null;
  depth: number | null;
  value: number | null;
  variableName: string;
  variableUnits: string;
  targetType?: string;
  targetId?: string;
}

export const initialHoverInfo: HoverInfo = {
  latitude: null,
  longitude: null,
  depth: 0.5,
  value: null,
  variableName: "Sea Water Temperature",
  variableUnits: "°C",
};

type Listener = (info: HoverInfo) => void;

class HoverStore {
  private currentInfo: HoverInfo = { ...initialHoverInfo };
  private listeners = new Set<Listener>();
  private rafId: number | null = null;
  private pendingInfo: HoverInfo | null = null;

  public get(): HoverInfo {
    return this.currentInfo;
  }

  /**
   * Schedules a throttled update using requestAnimationFrame.
   */
  public set(info: HoverInfo): void {
    this.pendingInfo = info;
    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(() => {
        this.rafId = null;
        if (this.pendingInfo) {
          this.currentInfo = this.pendingInfo;
          this.pendingInfo = null;
          this.listeners.forEach((listener) => listener(this.currentInfo));
        }
      });
    }
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.currentInfo);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const hoverStore = new HoverStore();
