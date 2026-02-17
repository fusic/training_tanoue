"use client";

import { css } from "@emotion/css";
import React, { FC } from "react";

type HorseTelemetry = {
  id: number;
  name: string;
  position: number;
  distanceFromLeader: number;
  speed: number;
  odds: number;
};

// 仮データ（京都記念2026を参考に14頭）
const dummyTelemetryData: HorseTelemetry[] = [
  { id: 1, name: "ヨーホーレイク", position: 1, distanceFromLeader: 0, speed: 59.2, odds: 3.5 },
  { id: 2, name: "エリキング", position: 2, distanceFromLeader: 0.3, speed: 59.0, odds: 4.8 },
  { id: 3, name: "ヘデントール", position: 3, distanceFromLeader: 0.8, speed: 58.7, odds: 2.9 },
  { id: 4, name: "プラダリア", position: 4, distanceFromLeader: 1.2, speed: 58.4, odds: 8.2 },
  { id: 5, name: "ダノンザキッド", position: 5, distanceFromLeader: 1.8, speed: 58.0, odds: 5.6 },
  { id: 6, name: "ジャスティンパレス", position: 6, distanceFromLeader: 2.5, speed: 57.6, odds: 12.5 },
  { id: 7, name: "ソールオリエンス", position: 7, distanceFromLeader: 3.0, speed: 57.3, odds: 6.8 },
  { id: 8, name: "ディープボンド", position: 8, distanceFromLeader: 3.8, speed: 56.9, odds: 15.3 },
  { id: 9, name: "シュヴァリエローズ", position: 9, distanceFromLeader: 4.5, speed: 56.5, odds: 18.7 },
  { id: 10, name: "マテンロウオリオン", position: 10, distanceFromLeader: 5.2, speed: 56.1, odds: 22.4 },
  { id: 11, name: "ステラヴェローチェ", position: 11, distanceFromLeader: 6.0, speed: 55.7, odds: 28.9 },
  { id: 12, name: "レッドジェネシス", position: 12, distanceFromLeader: 7.1, speed: 55.2, odds: 35.6 },
  { id: 13, name: "アリストテレス", position: 13, distanceFromLeader: 8.5, speed: 54.6, odds: 45.2 },
  { id: 14, name: "ワンダフルタウン", position: 14, distanceFromLeader: 10.2, speed: 53.8, odds: 58.9 },
];

const RaceTelemetryPanel: FC = () => {
  const elapsedTime = "1:23.45";
  const remainingDistance = 1400;
  const totalDistance = 2200;

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.headerItem}>
          <span className={styles.headerLabel}>経過時間</span>
          <span className={styles.headerValue}>{elapsedTime}</span>
        </div>
        <div className={styles.headerItem}>
          <span className={styles.headerLabel}>残り距離</span>
          <span className={styles.headerValue}>{remainingDistance}m</span>
        </div>
        <div className={styles.headerItem}>
          <span className={styles.headerLabel}>総距離</span>
          <span className={styles.headerValue}>{totalDistance}m</span>
        </div>
      </div>

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>順位</th>
              <th className={styles.th}>馬名</th>
              <th className={styles.th}>差</th>
              <th className={styles.th}>速度</th>
              <th className={styles.th}>オッズ</th>
            </tr>
          </thead>
          <tbody>
            {dummyTelemetryData.map((horse) => (
              <tr key={horse.id} className={styles.tr}>
                <td className={styles.td}>
                  <span className={horse.position === 1 ? styles.firstPlace : styles.position}>
                    {horse.position}
                  </span>
                </td>
                <td className={styles.td}>{horse.name}</td>
                <td className={styles.td}>
                  {horse.distanceFromLeader === 0 ? "-" : `+${horse.distanceFromLeader.toFixed(1)}馬身`}
                </td>
                <td className={styles.td}>{horse.speed.toFixed(1)} km/h</td>
                <td className={styles.td}>{horse.odds.toFixed(1)}倍</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RaceTelemetryPanel;

const styles = {
  panel: css({
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#2E373D",
    color: "#FFFFFF",
    padding: 20,
    borderRadius: "8px 8px 0 0",
    boxShadow: "0 -2px 8px rgba(0, 0, 0, 0.2)",
    zIndex: 1000,
  }),
  header: css({
    display: "flex",
    justifyContent: "space-around",
    marginBottom: 20,
    paddingBottom: 15,
    borderBottom: "1px solid rgba(255, 255, 255, 0.2)",
  }),
  headerItem: css({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 5,
  }),
  headerLabel: css({
    fontSize: 12,
    color: "#B0B0B0",
    textTransform: "uppercase",
  }),
  headerValue: css({
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFFFFF",
  }),
  tableContainer: css({
    maxHeight: "25vh",
    overflowY: "auto",
    overflowX: "auto",
  }),
  table: css({
    width: "100%",
    borderCollapse: "collapse",
  }),
  th: css({
    textAlign: "left",
    padding: "10px 15px",
    fontSize: 12,
    fontWeight: "600",
    color: "#B0B0B0",
    textTransform: "uppercase",
    borderBottom: "1px solid rgba(255, 255, 255, 0.2)",
  }),
  tr: css({
    transition: "background-color 0.2s",
    "&:hover": {
      backgroundColor: "rgba(255, 255, 255, 0.05)",
    },
  }),
  td: css({
    padding: "12px 15px",
    fontSize: 14,
    borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
  }),
  position: css({
    display: "inline-block",
    minWidth: 24,
    textAlign: "center",
    fontWeight: "bold",
    fontSize: 16,
  }),
  firstPlace: css({
    display: "inline-block",
    minWidth: 24,
    textAlign: "center",
    fontWeight: "bold",
    fontSize: 16,
    color: "#FFD700",
  }),
};
