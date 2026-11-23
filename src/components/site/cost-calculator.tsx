"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { fmtTl } from "@/lib/format";

interface ProviderPrice {
  id: string;
  name: string;
  minAcPrice: number | null;
  minDcPrice: number | null;
}

export function CostCalculator({ providers }: { providers: ProviderPrice[] }) {
  const [battery, setBattery] = useState(60);
  const [range, setRange] = useState<[number, number]>([20, 80]);
  const [consumption, setConsumption] = useState(17);
  const [type, setType] = useState<"DC" | "AC">("DC");
  const [providerId, setProviderId] = useState<string>(providers[0]?.id ?? "custom");
  const [customPrice, setCustomPrice] = useState(12);
  const [fuelPrice, setFuelPrice] = useState(50);
  const [fuelConsumption, setFuelConsumption] = useState(6.5);

  const provider = providers.find((p) => p.id === providerId);
  const price = provider ? ((type === "DC" ? provider.minDcPrice : provider.minAcPrice) ?? customPrice) : customPrice;

  const r = useMemo(() => {
    const efficiency = type === "DC" ? 0.92 : 0.88; // şarj kayıpları
    const kwh = (battery * (range[1] - range[0])) / 100;
    const gridKwh = kwh / efficiency;
    const cost = gridKwh * price;
    const km = (kwh / consumption) * 100;
    const per100 = (consumption / efficiency) * price;
    const fuel100 = fuelConsumption * fuelPrice;
    return { kwh, gridKwh, cost, km, per100, fuel100, saving: fuel100 - per100 };
  }, [battery, range, consumption, type, price, fuelPrice, fuelConsumption]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <Card>
        <CardHeader>
          <CardTitle>Araç ve şarj bilgileri</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="battery">Batarya kapasitesi (kWh)</Label>
            <Input id="battery" type="number" min={10} max={200} value={battery} onChange={(e) => setBattery(Number(e.target.value) || 0)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="consumption">Ortalama tüketim (kWh/100 km)</Label>
            <Input
              id="consumption"
              type="number"
              min={8}
              max={40}
              step={0.5}
              value={consumption}
              onChange={(e) => setConsumption(Number(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-3 sm:col-span-2">
            <Label>
              Şarj aralığı: %{range[0]} → %{range[1]}
            </Label>
            <Slider value={range} min={0} max={100} step={5} onValueChange={(v) => setRange([v[0], v[1]] as [number, number])} />
          </div>
          <div className="space-y-2">
            <Label>Şarj tipi</Label>
            <Select value={type} onValueChange={(v) => setType(v as "AC" | "DC")}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DC">DC hızlı şarj</SelectItem>
                <SelectItem value="AC">AC normal şarj</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Şarj ağı</Label>
            <Select value={providerId} onValueChange={setProviderId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {providers.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} ({fmtTl(type === "DC" ? p.minDcPrice : p.minAcPrice)}/kWh)
                  </SelectItem>
                ))}
                <SelectItem value="custom">Kendi fiyatımı gireceğim</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(!provider || (type === "DC" ? provider.minDcPrice : provider.minAcPrice) == null) && (
            <div className="space-y-2">
              <Label htmlFor="custom-price">kWh fiyatı (₺)</Label>
              <Input
                id="custom-price"
                type="number"
                step={0.01}
                value={customPrice}
                onChange={(e) => setCustomPrice(Number(e.target.value) || 0)}
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="fuel-price">Benzin litre fiyatı (₺)</Label>
            <Input id="fuel-price" type="number" step={0.1} value={fuelPrice} onChange={(e) => setFuelPrice(Number(e.target.value) || 0)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fuel-cons">Benzinli araç tüketimi (L/100 km)</Label>
            <Input
              id="fuel-cons"
              type="number"
              step={0.1}
              value={fuelConsumption}
              onChange={(e) => setFuelConsumption(Number(e.target.value) || 0)}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="h-fit bg-primary text-primary-foreground lg:sticky lg:top-20" aria-live="polite">
        <CardHeader>
          <CardTitle className="text-primary-foreground/80">Tahmini şarj maliyeti</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-5xl font-bold tabular-nums">{fmtTl(r.cost)}</p>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="opacity-75">Bataryaya giren</dt>
              <dd className="text-lg font-semibold tabular-nums">{r.kwh.toFixed(1)} kWh</dd>
            </div>
            <div>
              <dt className="opacity-75">Şebekeden çekilen</dt>
              <dd className="text-lg font-semibold tabular-nums">{r.gridKwh.toFixed(1)} kWh</dd>
            </div>
            <div>
              <dt className="opacity-75">Kazanılan menzil</dt>
              <dd className="text-lg font-semibold tabular-nums">≈ {Math.round(r.km)} km</dd>
            </div>
            <div>
              <dt className="opacity-75">100 km maliyeti</dt>
              <dd className="text-lg font-semibold tabular-nums">{fmtTl(r.per100)}</dd>
            </div>
          </dl>
          <div className="rounded-xl bg-primary-foreground/10 p-4 text-sm">
            Benzinli araçla 100 km: <strong>{fmtTl(r.fuel100)}</strong>
            <br />
            {r.saving >= 0 ? "Tasarruf" : "Fark"}: <strong>{fmtTl(Math.abs(r.saving))}</strong> / 100 km
          </div>
          <p className="text-xs opacity-75">
            Hesaplama, {type} şarjda %{type === "DC" ? 8 : 12} şarj kaybı varsayar. Fiyat: {fmtTl(price)}/kWh.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
