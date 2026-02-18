/**
 * netkeibaスクレイピング処理
 */

import puppeteer, { Browser, Page } from "puppeteer";
import {
  RaceInfo,
  HorseEntry,
  RaceData,
  RACECOURSE_MAP,
  SEX_MAP,
  TRAINING_CENTER_MAP,
  SURFACE_MAP,
} from "./types";

const BASE_URL = "https://race.netkeiba.com";
const WAIT_TIME = 10000; // 10秒待機
const PAGE_LOAD_TIMEOUT = 30000; // 30秒タイムアウト
const REQUEST_DELAY = 3000; // リクエスト間の遅延（ミリ秒）

export class NetkeibaScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;

  /**
   * ブラウザを起動
   */
  async launch(): Promise<void> {
    console.log("🚀 ブラウザを起動中...");
    this.browser = await puppeteer.launch({
      headless: true, // ヘッドレスモードで控えめに動作（バン対策）
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-blink-features=AutomationControlled", // 自動化検出を回避
      ],
    });
    this.page = await this.browser.newPage();

    // ブラウザコンソールのログをNode.jsコンソールに出力
    this.page.on("console", (msg) => {
      const type = msg.type();
      const text = msg.text();
      if (type === "log") {
        console.log(`[Browser] ${text}`);
      } else if (type === "error") {
        console.error(`[Browser Error] ${text}`);
      }
    });

    // より現実的なUser-Agentを設定（バン対策）
    await this.page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    );

    // ViewportをPCサイズに設定
    await this.page.setViewport({ width: 1920, height: 1080 });

    // 自動化検出を回避（webdriver フラグを無効化）
    await this.page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", {
        get: () => false,
      });
    });

    console.log("✅ ブラウザ起動完了");
  }

  /**
   * ブラウザを閉じる
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      console.log("✅ ブラウザをクローズしました");
    }
  }

  /**
   * 指定日の重賞レースURLリストを取得
   */
  async getRaceUrls(date: string): Promise<string[]> {
    if (!this.page) throw new Error("ブラウザが起動していません");

    console.log(`\n📅 ${date}のレース情報を取得中...`);
    const dateFormatted = date.replace(/-/g, "");
    const calendarUrl = `${BASE_URL}/top/race_list.html?kaisai_date=${dateFormatted}`;

    try {
      // リクエスト前に遅延（バン対策）
      await this.delay(REQUEST_DELAY);

      await this.page.goto(calendarUrl, {
        waitUntil: "networkidle2",
        timeout: PAGE_LOAD_TIMEOUT,
      });
      // BANされないよう、ページ読み込み後に待機
      await this.delay(2000 + Math.random() * 2000); // 2-4秒のランダム待機

      // レースリンクを取得（重賞のみフィルタリング）
      const raceUrls = await this.page.evaluate(() => {
        const links: string[] = [];

        // すべてのレースリストコンテナを取得（複数の競馬場がある）
        const raceLists = document.querySelectorAll(".RaceList_DataList");
        console.log(`レースリストコンテナ数: ${raceLists.length}`);

        raceLists.forEach((raceList, listIndex) => {
          const raceItems = raceList.querySelectorAll("li.RaceList_DataItem");
          console.log(`リスト${listIndex + 1}のレース数: ${raceItems.length}`);

          raceItems.forEach((item, itemIndex) => {
            // レース名を取得
            const titleElement = item.querySelector(
              ".RaceList_ItemTitle .ItemTitle",
            );
            const raceName = titleElement?.textContent?.trim() || "";

            // グレードアイコンをチェック
            const gradeIcon = item.querySelector(".Icon_GradeType");
            const isGrade = gradeIcon !== null;

            // グレードの種類を判定（G1-G3のみ）
            let gradeType = "";
            if (gradeIcon) {
              const classList = gradeIcon.classList;
              if (classList.contains("Icon_GradeType1")) gradeType = "G1";
              else if (classList.contains("Icon_GradeType2")) gradeType = "G2";
              else if (classList.contains("Icon_GradeType3")) gradeType = "G3";
              // リステッド、オープン特別などは除外
            }

            // URLを取得
            const link = item.querySelector(
              'a[href*="shutuba.html"]',
            ) as HTMLAnchorElement;
            if (link && raceName) {
              // href属性から相対URLを取得
              let href = link.getAttribute("href") || "";

              // race_idを抽出（例: ../race/shutuba.html?race_id=202605010711&rf=race_list）
              const raceIdMatch = href.match(/race_id=(\d+)/);
              if (!raceIdMatch) {
                console.log(`  ⚠ race_idが見つかりません: ${href}`);
                return;
              }

              const raceId = raceIdMatch[1];
              const fullUrl = `https://race.netkeiba.com/race/shutuba.html?race_id=${raceId}`;

              console.log(
                `レース発見: ${raceName} (${gradeType || "平場"}) - ${raceId}`,
              );

              // G1-G3のみを追加（リステッドは除外）
              if (
                isGrade &&
                (gradeType === "G1" ||
                  gradeType === "G2" ||
                  gradeType === "G3") &&
                !links.includes(fullUrl)
              ) {
                links.push(fullUrl);
                console.log(`  ✓ 重賞として追加: ${gradeType}`);
              }
            }
          });
        });

        console.log(`=== 合計 ${links.length}件の重賞レースを発見 ===`);
        return links;
      });

      console.log(`✅ ${raceUrls.length}件の重賞レースを発見`);
      return raceUrls;
    } catch (error) {
      console.error(`❌ レース一覧取得エラー: ${error}`);
      return [];
    }
  }

  /**
   * レース基本情報を取得
   */
  async parseRaceInfo(raceUrl: string, date: string): Promise<RaceInfo | null> {
    if (!this.page) throw new Error("ブラウザが起動していません");

    console.log(`\n🏇 レース情報取得: ${raceUrl}`);

    try {
      // リクエスト前に遅延（バン対策）
      await this.delay(REQUEST_DELAY);

      await this.page.goto(raceUrl, {
        waitUntil: "networkidle2",
        timeout: PAGE_LOAD_TIMEOUT,
      });
      // BANされないよう、ページ読み込み後に待機
      await this.delay(2000 + Math.random() * 2000); // 2-4秒のランダム待機

      const raceInfo = await this.page.evaluate(
        (maps: { racecourse: Record<string, string> }) => {
          const info: any = {};

          // レース名
          const raceNameElem = document.querySelector(".RaceName");
          if (raceNameElem) {
            info.raceNameJa = raceNameElem.textContent?.trim() || "";
          }

          // レース詳細データ
          const raceData01 = document.querySelector(".RaceData01");
          if (raceData01) {
            const text = raceData01.textContent || "";

            // 距離
            const distanceMatch = text.match(/(\d+)m/);
            if (distanceMatch) {
              info.distanceMeters = distanceMatch[1];
            }

            // 馬場
            if (text.includes("ダート") || text.includes("ダ")) {
              info.surface = "Dirt";
            } else if (text.includes("芝")) {
              info.surface = "Turf";
            }

            // 回り方向
            if (text.includes("左")) {
              info.turnDirection = "Left-handed";
            } else if (text.includes("右")) {
              info.turnDirection = "Right-handed";
            }
          }

          // 発走時刻
          const raceData02 = document.querySelector(".RaceData02");
          if (raceData02) {
            const timeMatch = raceData02.textContent?.match(/(\d{2}:\d{2})/);
            if (timeMatch) {
              info.postTime = timeMatch[1];
            }
          }

          // 競馬場
          const raceKaisaiElements =
            document.querySelectorAll(".RaceKaisaiDate");
          for (const elem of Array.from(raceKaisaiElements)) {
            const text = elem.textContent || "";
            for (const [jpName, enName] of Object.entries(maps.racecourse)) {
              if (text.includes(jpName)) {
                info.racecourse = enName;
                info.racecourseJa = jpName;
                break;
              }
            }
            if (info.racecourse) break;
          }

          // グレード判定
          let grade = "";
          const raceNameText = info.raceNameJa || "";
          if (raceNameText.includes("GⅠ") || raceNameText.includes("G1")) {
            grade = "G1";
          } else if (
            raceNameText.includes("GⅡ") ||
            raceNameText.includes("G2")
          ) {
            grade = "G2";
          } else if (
            raceNameText.includes("GⅢ") ||
            raceNameText.includes("G3")
          ) {
            grade = "G3";
          }
          info.grade = grade;

          return info;
        },
        { racecourse: RACECOURSE_MAP },
      );

      // レース番号・IDを取得（クエリパラメータから）
      const raceIdMatch = raceUrl.match(/race_id=(\d+)/);
      if (raceIdMatch) {
        raceInfo.raceId = raceIdMatch[1];
        raceInfo.raceNumber = raceIdMatch[1].slice(-2);
      }

      raceInfo.date = date;
      raceInfo.raceName = ""; // 英語名は別途必要

      console.log(`✅ ${raceInfo.raceNameJa} (${raceInfo.grade})`);
      return raceInfo as RaceInfo;
    } catch (error) {
      console.error(`❌ レース情報取得エラー: ${error}`);
      return null;
    }
  }

  /**
   * 出走馬情報を取得
   */
  async parseHorseEntries(raceInfo: RaceInfo): Promise<RaceData[]> {
    if (!this.page) throw new Error("ブラウザが起動していません");

    console.log(`🐴 出走馬情報取得中...`);

    // 出馬表URLに変換
    const shutubaUrl = `${BASE_URL}/race/shutuba.html?race_id=${raceInfo.raceId}`;

    try {
      // リクエスト前に遅延（バン対策）
      await this.delay(REQUEST_DELAY);

      await this.page.goto(shutubaUrl, {
        waitUntil: "networkidle2",
        timeout: PAGE_LOAD_TIMEOUT,
      });
      await this.delay(2000);

      const horses = await this.page.evaluate(
        (baseUrl, maps) => {
          const horseList: any[] = [];
          const table = document.querySelector(".Shutuba_Table");
          if (!table) return horseList;

          const rows = table.querySelectorAll("tr");

          for (let i = 1; i < rows.length; i++) {
            const cols = rows[i].querySelectorAll("td");
            if (cols.length < 8) continue;

            const horse: any = {};

            // 枠番
            const waku = cols[0]?.textContent?.trim() || "";
            horse.gate = waku;

            // 馬番
            const umaban = cols[1]?.textContent?.trim() || "";
            horse.number = umaban;

            // 馬名
            const horseLink = cols[3]?.querySelector("a");
            if (horseLink) {
              horse.horseNameJa = horseLink.textContent?.trim() || "";
              const href = horseLink.getAttribute("href");
              if (href) {
                horse.sourceUrl = baseUrl + href;
              }
            }

            // 性齢
            const seirei = cols[4]?.textContent?.trim() || "";
            const seireiMatch = seirei.match(/([牡牝セ騸])(\d+)/);
            if (seireiMatch) {
              horse.sex = maps.sex[seireiMatch[1]] || "";
              horse.age = seireiMatch[2];
            }

            // 斤量
            horse.weightKg = cols[5]?.textContent?.trim() || "";

            // 騎手
            horse.jockeyJa = cols[6]?.textContent?.trim() || "";

            // 厩舎（調教拠点）
            const stable = cols[7]?.textContent?.trim() || "";
            for (const [key, value] of Object.entries(maps.training)) {
              if (stable.includes(key)) {
                horse.trainingCenter = value;
                break;
              }
            }

            horse.horseName = ""; // 英語名は別途必要
            horse.jockey = ""; // 英語名は別途必要
            horse.status = "LikelyRunner";
            horse.note = "";

            horseList.push(horse);
          }

          return horseList;
        },
        BASE_URL,
        { sex: SEX_MAP, training: TRAINING_CENTER_MAP },
      );

      console.log(`✅ ${horses.length}頭の情報を取得`);

      // RaceInfoとHorseEntryを結合
      const raceDataList: RaceData[] = horses.map((horse) => ({
        ...raceInfo,
        ...horse,
        registrationCount: horses.length.toString(),
        fullGate: "",
      }));

      return raceDataList;
    } catch (error) {
      console.error(`❌ 出走馬情報取得エラー: ${error}`);
      return [];
    }
  }

  /**
   * 指定期間の重賞レースデータを全取得
   */
  async scrapeRaces(dates: string[]): Promise<RaceData[]> {
    await this.launch();

    const allRaceData: RaceData[] = [];

    try {
      for (const date of dates) {
        console.log(`\n${"=".repeat(60)}`);
        console.log(`📆 ${date}のデータ取得開始`);
        console.log(`${"=".repeat(60)}`);

        const raceUrls = await this.getRaceUrls(date);

        for (let i = 0; i < raceUrls.length; i++) {
          console.log(`\n[${i + 1}/${raceUrls.length}] 処理中...`);

          const raceInfo = await this.parseRaceInfo(raceUrls[i], date);
          if (!raceInfo) continue;

          const horses = await this.parseHorseEntries(raceInfo);
          allRaceData.push(...horses);

          // 負荷軽減のための待機
          console.log(`⏳ ${WAIT_TIME / 1000}秒待機中...`);
          await this.delay(WAIT_TIME);
        }
      }

      console.log(`\n✅ 全データ取得完了: ${allRaceData.length}件`);
      return allRaceData;
    } finally {
      await this.close();
    }
  }

  /**
   * 遅延処理
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
