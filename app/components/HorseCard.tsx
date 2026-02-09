import { HorseConfig } from "../sim/types";
import "./horseCard.css";

type HorseCardProps = {
  horse: HorseConfig;
  onUpdate: (id: number, patch: Partial<HorseConfig>) => void;
};

const HorseCard = ({ horse, onUpdate }: HorseCardProps) => {
  return (
    <div className="horse-card" style={{ backgroundColor: horse.color }}>
      <div className="horse-card-number">{horse.id}</div>
      <div className="horse-card-info">
        <div className="horse-card-title">{horse.name}</div>
        <div className="horse-card-content">
          <div className="horse-card-field">
            <label className="horse-card-label" htmlFor={`speed-${horse.id}`}>
              速度
            </label>
            <input
              id={`speed-${horse.id}`}
              type="number"
              step={0.01}
              value={horse.speed}
              onChange={(event) =>
                onUpdate(horse.id, { speed: Number(event.target.value) })
              }
            />
          </div>
          <div className="horse-card-field">
            <label className="horse-card-label" htmlFor={`accel-${horse.id}`}>
              加速度
            </label>
            <input
              id={`accel-${horse.id}`}
              type="number"
              step={0.001}
              value={horse.accel}
              onChange={(event) =>
                onUpdate(horse.id, { accel: Number(event.target.value) })
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default HorseCard;