/** Harita için sıkıştırılmış istasyon noktası: [uid, lat, lng, providerIndex, maxPowerKw, flags] */
export type MapPoint = [string, number, number, number, number, number];

export const FLAG = {
  AC: 1,
  DC: 2,
  CCS: 4,
  TYPE2: 8,
  CHADEMO: 16,
} as const;

export interface MapProvider {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  stationCount: number;
}
