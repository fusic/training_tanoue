"use client";

import { css } from "@emotion/css";
import React, { FC } from "react";

type RaceCardProps = {
  rank: string;
  raceName: string;
  date: string;
  venue: string;
  trackType: string;
  distance: number;
  horseCount: number;
  onStart: () => void;
};

export const RaceCard: FC<RaceCardProps> = ({
  rank,
  raceName,
  date,
  venue,
  trackType,
  distance,
  horseCount,
  onStart,
}) => {
  return (
    <div className={styles.card}>
      <div className={styles.rankBadge}>{rank}</div>
      <h3 className={styles.raceName}>{raceName}</h3>
      <div className={styles.info}>
        <div className={styles.infoRow}>
          <span className={styles.label}>開催日:</span>
          <span className={styles.value}>{date}</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.label}>競馬場:</span>
          <span className={styles.value}>{venue}</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.label}>種別:</span>
          <span className={styles.value}>{trackType}</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.label}>距離:</span>
          <span className={styles.value}>{distance}m</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.label}>出走数:</span>
          <span className={styles.value}>{horseCount}頭</span>
        </div>
      </div>
      <button className={styles.startButton} onClick={onStart}>
        開始
      </button>
    </div>
  );
};

const styles = {
  card: css({
    width: "18%",
    aspectRatio: "1 / 1",
    backgroundColor: "#FFFFFF",
    border: "1px solid #E0E0E0",
    borderRadius: 8,
    padding: 16,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
    transition: "transform 0.2s, box-shadow 0.2s",
    "&:hover": {
      transform: "translateY(-4px)",
      boxShadow: "0 4px 8px rgba(0, 0, 0, 0.15)",
    },
  }),
  rankBadge: css({
    backgroundColor: "#FFD700",
    color: "#000000",
    fontSize: 12,
    fontWeight: "bold",
    padding: "4px 8px",
    borderRadius: 4,
    alignSelf: "flex-start",
    marginBottom: 8,
  }),
  raceName: css({
    fontSize: 16,
    fontWeight: "bold",
    margin: "0 0 12px 0",
    color: "#2E373D",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  }),
  info: css({
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 6,
    fontSize: 12,
    color: "#666666",
  }),
  infoRow: css({
    display: "flex",
    justifyContent: "space-between",
  }),
  label: css({
    fontWeight: "500",
  }),
  value: css({
    color: "#2E373D",
  }),
  startButton: css({
    backgroundColor: "#4CAF50",
    color: "#FFFFFF",
    border: "none",
    borderRadius: 4,
    padding: "10px 16px",
    fontSize: 14,
    fontWeight: "bold",
    cursor: "pointer",
    transition: "background-color 0.2s",
    "&:hover": {
      backgroundColor: "#45a049",
    },
    "&:active": {
      backgroundColor: "#3d8b40",
    },
  }),
};
