import { ImageResponse } from "next/og";

export const alt = "En Yakın Şarj – Türkiye şarj istasyonu haritası";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "linear-gradient(135deg, #052e16 0%, #15803d 60%, #22c55e 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 40, fontWeight: 700 }}>
          <div style={{ width: 72, height: 72, borderRadius: 20, background: "white", display: "flex", alignItems: "center", justifyContent: "center", color: "#16a34a", fontSize: 48 }}>
            ⚡
          </div>
          enyakinsarj.com.tr
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05 }}>En yakın şarj istasyonunu bulun</div>
          <div style={{ fontSize: 34, opacity: 0.85 }}>Tüm şarj ağları tek haritada · kWh fiyatları · anlık doluluk</div>
        </div>
      </div>
    ),
    size,
  );
}
