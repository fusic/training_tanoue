import Link from "next/link";
import "./app.css";

export default function Home() {
  return (
    <main className="home">
      <section className="home-card">
        <h1>Horse Race Simulation</h1>
        <p>
         未来のレース情報から詳細なシミュレーションを実行
        </p>
        <Link className="primary" href="/sim">
          シミュレーションを開始
        </Link>
      </section>
    </main>
  );
}
