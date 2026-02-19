/**
 * CSV出力処理
 */

import { createObjectCsvWriter } from "csv-writer";
import { RaceData } from "./types";

export class CsvWriter {
  /**
   * CSVファイルに出力
   */
  static async write(data: RaceData[], outputPath: string): Promise<void> {
    console.log(`\n📝 CSVファイル作成中: ${outputPath}`);

    const csvWriter = createObjectCsvWriter({
      path: outputPath,
      header: [
        { id: "raceName", title: "raceName" },
        { id: "raceNameJa", title: "raceNameJa" },
        { id: "grade", title: "grade" },
        { id: "date", title: "date" },
        { id: "postTime", title: "postTime" },
        { id: "racecourse", title: "racecourse" },
        { id: "surface", title: "surface" },
        { id: "distanceMeters", title: "distanceMeters" },
        { id: "turnDirection", title: "turnDirection" },
        { id: "raceNumber", title: "raceNumber" },
        { id: "registrationCount", title: "registrationCount" },
        { id: "fullGate", title: "fullGate" },
        { id: "horseName", title: "horseName" },
        { id: "horseNameJa", title: "horseNameJa" },
        { id: "sex", title: "sex" },
        { id: "age", title: "age" },
        { id: "trainingCenter", title: "trainingCenter" },
        { id: "jockey", title: "jockey" },
        { id: "jockeyJa", title: "jockeyJa" },
        { id: "weightKg", title: "weightKg" },
        { id: "gate", title: "gate" },
        { id: "number", title: "number" },
        { id: "status", title: "status" },
        { id: "note", title: "note" },
        { id: "sourceUrl", title: "sourceUrl" },
      ],
    });

    await csvWriter.writeRecords(data);
    console.log(`✅ CSV出力完了: ${data.length}件`);
  }
}
