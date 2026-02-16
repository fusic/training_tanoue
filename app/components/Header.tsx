"use client";

import { css } from "@emotion/css";
import React, { FC } from "react";
import ArrowBackIosIcon from "@mui/icons-material/ArrowBackIos";
import { useRouter } from "next/navigation";

export const Header: FC = () => {
  const router = useRouter();
  return (
    <header className={styles.header}>
      <ArrowBackIosIcon
        style={{ color: "#FFFFFF", marginRight: 10 }}
        onClick={() => router.push("/")}
      />
      <h1 className={styles.title}>Horse Racing Simulation</h1>
    </header>
  );
};

const styles = {
  header: css({
    height: 60,
    backgroundColor: "#2E373D",
    display: "flex",
    alignItems: "center",
    paddingLeft: 20,
  }),
  title: css({
    color: "#FFFFFF",
    fontSize: 24,
    margin: 0,
  }),
};
