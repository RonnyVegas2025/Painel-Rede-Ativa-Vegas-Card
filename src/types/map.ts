import type { MarkerPriority } from "@/lib/business-rules/resolve-marker-status";

export interface MapMarker {
  establishmentId: string;
  latitude: number;
  longitude: number;
  priority: MarkerPriority;
  colorToken: string;
  icon: string;
  /** Texto com as cinco dimensoes. Cor nunca e o unico canal (ADR 0004). */
  accessibleLabel: string;
}

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}
