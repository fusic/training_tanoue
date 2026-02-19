#!/usr/bin/env node
/**
 * netkeiba重賞レーススクレイピングツール（過去戦歴付き）
 * 2026年2月21日・22日のG1-G3レース情報 + 各馬の過去戦歴を収集
 */

import * as path from "path";
import * as fs from "fs";
import { NetkeibaScraper } from "./scraper";
import { CsvWriter } from "./csv-writer";
import { HorseHistoryScraper } from "./horse-history";
import { HorseHistory } from "./types";

// 対象日付
const TARGET_DATES = ["2026-02-21", "2026-02-22"];

// 出力ファイルパス
const OUTPUT_FILE_RACES = path.join(
  __dirname,
  "../../jra_races_2026_02_21_22.csv",
);
const OUTPUT_FILE_HISTORY = path.join(
  __dirname,
  "../../jra_horse_history_2026_02_21_22.json",
);

/**
 * メイン処理
 */
async function main() {
  console.log("=".repeat(60));
  console.log("🏇 netkeiba 重賞レーススクレイピング（過去戦歴付き）");
  console.log(`📅 対象日: ${TARGET_DATES.join(", ")}`);
  console.log(`🎯 対象: G1・G2・G3重賞レースのみ`);
  console.log("=".repeat(60));

  const startTime = Date.now();

  try {
    // スクレイピング実行
    const scraper = new NetkeibaScraper();
    const raceData = await scraper.scrapeRaces(TARGET_DATES);

    if (raceData.length === 0) {
      console.warn("\n⚠️  取得できたデータがありません");
      return;
    }

    // レース情報をCSV出力
    await CsvWriter.write(raceData, OUTPUT_FILE_RACES);

    // 過去戦歴を取得
    console.log("\n" + "=".repeat(60));
    console.log("📊 各馬の過去戦歴を取得中...");
    console.log("=".repeat(60));

    const horseHistories: HorseHistory[] = [];
    const uniqueHorses = new Map<string, string>(); // horseNameJa -> sourceUrl

    // ユニークな馬を抽出
    raceData.forEach((race) => {
      if (
        race.horseNameJa &&
        race.sourceUrl &&
        !uniqueHorses.has(race.horseNameJa)
      ) {
        uniqueHorses.set(race.horseNameJa, race.sourceUrl);
      }
    });

    console.log(`\n🐴 ${uniqueHorses.size}頭の馬の戦歴を取得します`);

    // 再度ブラウザを起動して戦歴取得
    const historyScraper = new NetkeibaScraper();
    await historyScraper.launch();

    let count = 0;
    for (const [horseName, horseUrl] of uniqueHorses.entries()) {
      count++;
      console.log(`\n[${count}/${uniqueHorses.size}] ${horseName}`);

      try {
        const histories = await HorseHistoryScraper.scrapeHistory(
          (historyScraper as any).page,
          horseUrl,
          10, // 過去10戦まで
        );

        horseHistories.push({
          horseNameJa: horseName,
          sourceUrl: horseUrl,
          raceHistories: histories,
        });

        // 負荷軽減のため待機
        await new Promise((resolve) => setTimeout(resolve, 3000));
      } catch (error) {
        console.error(`  ❌ ${horseName}の戦歴取得失敗: ${error}`);
      }
    }

    await historyScraper.close();

    // 過去戦歴をJSON出力
    fs.writeFileSync(
      OUTPUT_FILE_HISTORY,
      JSON.stringify(horseHistories, null, 2),
      "utf-8",
    );
    console.log(`\n✅ 過去戦歴出力完了: ${OUTPUT_FILE_HISTORY}`);
    console.log(`   取得馬数: ${horseHistories.length}頭`);

    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ 全処理完了: ${elapsedTime}秒`);
    console.log(`📁 レース情報: ${OUTPUT_FILE_RACES}`);
    console.log(`📁 過去戦歴: ${OUTPUT_FILE_HISTORY}`);
  } catch (error) {
    console.error("\n❌ エラーが発生しました:", error);
    process.exit(1);
  }

  console.log("=".repeat(60));
}

// 実行
main();
