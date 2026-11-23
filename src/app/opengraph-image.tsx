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
          background: "#0c7a43",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 36, fontWeight: 600 }}>
          <div style={{ width: 72, height: 72, borderRadius: 16, background: "white", display: "flex", alignItems: "center", justifyContent: "center", color: "#0c7a43", fontSize: 48 }}>
            ⚡
          </div>
          enyakinsarj.com.tr
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 72, fontWeight: 600, lineHeight: 1 }}>En yakın şarj istasyonunu bulun</div>
          <div style={{ fontSize: 30, opacity: 0.85 }}>Tüm şarj ağları tek haritada, güncel kWh fiyatları ve anlık doluluk</div>
        </div>
      </div>
    ),
    size,
  );
}
