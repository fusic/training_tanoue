"use client";

import { useMemo, useState, Suspense, lazy } from "react";
import type { HorseConfig } from "./types";
import HorseCard from "../components/horseCard";
import "./sim.css";

const SimCanvas = lazy(() => import("./SimCanvas"));

const DEFAULT_COLORS = [
  "#ff6f61",
  "#4fc3f7",
  "#ffd54f",
  "#9575cd",
  "#81c784",
  "#ff8a65",
  "#a1887f",
  "#90caf9",
];

const buildHorses = (count: number): HorseConfig[] => {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    name: `Horse ${index + 1}`,
    color: DEFAULT_COLORS[index % DEFAULT_COLORS.length],
    speed: 0.32 + index * 0.01,
    accel: 0.002,
  }));
}

export default function SimPage() {
  const [horseCount, setHorseCount] = useState(8); //一旦固定
  const [horses, setHorses] = useState<HorseConfig[]>(() => buildHorses(8));

  const horsesById = useMemo(() => {
    return horses.reduce<Record<number, HorseConfig>>((acc, horse) => {
      acc[horse.id] = horse;
      return acc;
    }, {});
  }, [horses]);

  const handleHorseCount = (value: number) => {
    const nextCount = Math.max(2, Math.min(12, value));
    setHorseCount(nextCount);
    setHorses(buildHorses(nextCount));
  };

  const updateHorse = (id: number, patch: Partial<HorseConfig>) => {
    setHorses((prev) =>
      prev.map((horse) => (horse.id === id ? { ...horse, ...patch } : horse))
    );
  };

  return (
    <main className="sim-page">
      <header className="sim-header">
        <div>
          <h1>競馬シミュレーション</h1>
          <p>各馬の速度・加速度を調整して挙動を変えられます</p>
        </div>
      </header>

      <section className="sim-content">
        <div className="sim-stage">
          <Suspense
            fallback={
              <div className="sim-canvas sim-loading">
                <div className="loading-spinner">
                  <p>3Dモデルを読み込んでいます...</p>
                  <div className="spinner"></div>
                </div>
              </div>
            }
          >
            <SimCanvas key={horseCount} horses={horses} />
          </Suspense>

          <div className="horse-cards-overlay">
            {horses.map((horse) => (
              <HorseCard
                key={horse.id}
                horse={horsesById[horse.id] || horse}
                onUpdate={updateHorse}
              />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
