#!/usr/bin/env node
/**
 * netkeiba重賞レーススクレイピングツール
 * 2026年2月21日・22日のG1-G3レース情報を収集
 */

import * as path from "path";
import { NetkeibaScraper } from "./scraper";
import { CsvWriter } from "./csv-writer";

// 対象日付
const TARGET_DATES = ["2026-02-21", "2026-02-22"];

// 出力ファイルパス
const OUTPUT_FILE = path.join(__dirname, "../../jra_races_2026_02_21_22.csv");

/**
 * メイン処理
 */
async function main() {
  console.log("=".repeat(60));
  console.log("🏇 netkeiba 重賞レーススクレイピング");
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

    // CSV出力
    await CsvWriter.write(raceData, OUTPUT_FILE);

    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ 処理完了: ${elapsedTime}秒`);
    console.log(`📁 出力先: ${OUTPUT_FILE}`);
  } catch (error) {
    console.error("\n❌ エラーが発生しました:", error);
    process.exit(1);
  }

  console.log("=".repeat(60));
}

// 実行
main();
