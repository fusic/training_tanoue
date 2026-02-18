/**
 * 馬の過去戦歴スクレイピング処理
 */

import { Page } from "puppeteer";

export interface RaceHistory {
  date: string;
  racecourse: string;
  raceName: string;
  distance: string;
  surface: string;
  weather: string;
  trackCondition: string;
  frameNumber: string;
  horseNumber: string;
  popularity: string;
  finish: string;
  jockey: string;
  weight: string;
  time: string;
  margin: string;
}

export class HorseHistoryScraper {
  /**
   * 指定した馬の過去戦歴を取得
   */
  static async scrapeHistory(
    page: Page,
    horseUrl: string,
    maxRaces: number = 10,
  ): Promise<RaceHistory[]> {
    console.log(`  📊 過去戦歴取得: ${horseUrl}`);

    try {
      await page.goto(horseUrl, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });
      await this.delay(2000);

      const histories = await page.evaluate((max) => {
        const historyList: any[] = [];

        // 戦績テーブルを取得
        const table = document.querySelector(".db_h_race_results");
        if (!table) {
          console.log("戦績テーブルが見つかりません");
          return historyList;
        }

        const rows = table.querySelectorAll("tbody tr");
        const limitRows = Math.min(rows.length, max);

        for (let i = 0; i < limitRows; i++) {
          const cols = rows[i].querySelectorAll("td");
          if (cols.length < 10) continue;

          const history: any = {};

          // 日付
          history.date = cols[0]?.textContent?.trim() || "";

          // 競馬場
          history.racecourse = cols[1]?.textContent?.trim() || "";

          // レース名
          const raceNameElem = cols[4]?.querySelector("a");
          history.raceName = raceNameElem?.textContent?.trim() || "";

          // 距離・馬場
          const distanceText = cols[14]?.textContent?.trim() || "";
          history.distance = distanceText;

          // 芝orダート
          if (distanceText.includes("ダ") || distanceText.includes("ダート")) {
            history.surface = "Dirt";
          } else if (distanceText.includes("芝")) {
            history.surface = "Turf";
          } else {
            history.surface = "";
          }

          // 天気
          history.weather = cols[2]?.textContent?.trim() || "";

          // 馬場状態
          history.trackCondition = cols[3]?.textContent?.trim() || "";

          // 枠番
          history.frameNumber = cols[7]?.textContent?.trim() || "";

          // 馬番
          history.horseNumber = cols[8]?.textContent?.trim() || "";

          // 人気
          history.popularity = cols[10]?.textContent?.trim() || "";

          // 着順
          history.finish = cols[11]?.textContent?.trim() || "";

          // 騎手
          history.jockey = cols[12]?.textContent?.trim() || "";

          // 斤量
          history.weight = cols[13]?.textContent?.trim() || "";

          // タイム
          history.time = cols[17]?.textContent?.trim() || "";

          // 着差
          history.margin = cols[18]?.textContent?.trim() || "";

          historyList.push(history);
        }

        return historyList;
      }, maxRaces);

      console.log(`  ✅ ${histories.length}件の戦歴を取得`);
      return histories as RaceHistory[];
    } catch (error) {
      console.error(`  ❌ 戦歴取得エラー: ${error}`);
      return [];
    }
  }

  private static delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
