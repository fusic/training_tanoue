import React from "react";
import { Header } from "../components/Header";
import RaceTelemetryPanel from "../components/RaceTelemetryPanel";
import RaceField from "../components/RaceField";

const RacePage = () => {
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Header />
      <div
        style={{
          flex: 1,
          width: "100%",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <RaceField cameraAutoRotate={false} numberOfHorses={2} />
      </div>
      {/* <RaceTelemetryPanel /> */}
    </div>
  );
};

export default RacePage;
