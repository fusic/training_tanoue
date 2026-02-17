"use client";

import Link from "next/link";
import "./app.css";
import { RaceCard } from "./components/RaceCard";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  return (
    <main className="home">
      <section className="home-card">
        <h1>Horse Race Simulation</h1>
        <p>未来のレース情報から詳細なシミュレーションを実行</p>
        <Link className="primary" href="/sim">
          シミュレーションを開始
        </Link>
        　　　　　
        <RaceCard
          rank="GII"
          raceName="京都記念"
          date="2026-02-15"
          venue="京都競馬場"
          trackType="芝"
          distance={2200}
          horseCount={14}
          onStart={() => router.push("/race")}
        />
      </section>
    </main>
  );
}
