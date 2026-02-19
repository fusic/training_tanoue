#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
netkeibaスクレイピングスクリプト
2026年2月21日・22日のJRA全レース情報と出走馬データを収集
"""

import time
import csv
import logging
from datetime import datetime
from typing import List, Dict, Optional
import re

from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from webdriver_manager.chrome import ChromeDriverManager
from bs4 import BeautifulSoup

# ログ設定
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('scraper.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# 定数
WAIT_TIME = 10  # 要素待機時間（秒）
SLEEP_TIME = 2  # ページ間の待機時間（秒）
BASE_URL = "https://race.netkeiba.com"
TARGET_DATES = ["2026-02-21", "2026-02-22"]

# 競馬場マッピング
RACECOURSE_MAP = {
    '札幌': 'Sapporo',
    '函館': 'Hakodate',
    '福島': 'Fukushima',
    '新潟': 'Niigata',
    '東京': 'Tokyo',
    '中山': 'Nakayama',
    '中京': 'Chukyo',
    '京都': 'Kyoto',
    '阪神': 'Hanshin',
    '小倉': 'Kokura'
}

# 性別マッピング
SEX_MAP = {
    '牡': 'M',
    '牝': 'F',
    'セ': 'G',
    '騸': 'G'
}

# トレセンマッピング
TRAINING_CENTER_MAP = {
    '美': 'Miho',
    '栗': 'Ritto',
    '美浦': 'Miho',
    '栗東': 'Ritto'
}


class NetkeibaRaceScraper:
    """netkeibaレース情報スクレイパー"""
    
    def __init__(self):
        self.driver = None
        self.races_data = []
        
    def setup_driver(self):
        """Seleniumドライバーのセットアップ"""
        logger.info("Chromeドライバーをセットアップ中...")
        
        chrome_options = Options()
        chrome_options.add_argument('--headless')  # ヘッドレスモード
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        chrome_options.add_argument('--disable-gpu')
        chrome_options.add_argument('--window-size=1920,1080')
        chrome_options.add_argument('--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36')
        
        service = Service(ChromeDriverManager().install())
        self.driver = webdriver.Chrome(service=service, options=chrome_options)
        logger.info("ドライバーのセットアップ完了")
        
    def close_driver(self):
        """ドライバーのクローズ"""
        if self.driver:
            self.driver.quit()
            logger.info("ドライバーをクローズしました")
    
    def get_race_calendar(self, date_str: str) -> List[str]:
        """指定日のレースURLリストを取得"""
        logger.info(f"{date_str}のレース情報を取得中...")
        
        # 日付をnetkeibaのフォーマットに変換 (YYYYMMDD)
        date_formatted = date_str.replace('-', '')
        
        # カレンダーページのURL
        calendar_url = f"{BASE_URL}/top/race_list.html?kaisai_date={date_formatted}"
        
        try:
            self.driver.get(calendar_url)
            time.sleep(SLEEP_TIME)
            
            # レースリンクを取得
            race_links = self.driver.find_elements(By.CSS_SELECTOR, 'a[href*="/race/"]')
            race_urls = []
            
            for link in race_links:
                href = link.get_attribute('href')
                if href and '/race/' in href and href not in race_urls:
                    race_urls.append(href)
            
            logger.info(f"{date_str}: {len(race_urls)}レース見つかりました")
            return race_urls
            
        except Exception as e:
            logger.error(f"レースカレンダー取得エラー ({date_str}): {e}")
            return []
    
    def parse_race_info(self, race_url: str) -> Optional[Dict]:
        """レース詳細情報を取得"""
        logger.info(f"レース情報を取得中: {race_url}")
        
        try:
            self.driver.get(race_url)
            time.sleep(SLEEP_TIME)
            
            # ページソースを取得してBeautifulSoupで解析
            soup = BeautifulSoup(self.driver.page_source, 'html.parser')
            
            # レース基本情報
            race_info = {}
            
            # レース名
            race_title = soup.find('div', class_='RaceName')
            if race_title:
                race_info['race_name_ja'] = race_title.get_text(strip=True)
            
            # レース詳細（距離、馬場、回り方向など）
            race_data = soup.find('div', class_='RaceData01')
            if race_data:
                text = race_data.get_text(strip=True)
                
                # 距離抽出
                distance_match = re.search(r'(\d+)m', text)
                if distance_match:
                    race_info['distance'] = distance_match.group(1)
                
                # 馬場抽出
                if 'ダート' in text or 'ダ' in text:
                    race_info['surface'] = 'Dirt'
                else:
                    race_info['surface'] = 'Turf'
                
                # 回り方向
                if '左' in text:
                    race_info['turn_direction'] = 'Left-handed'
                elif '右' in text:
                    race_info['turn_direction'] = 'Right-handed'
            
            # 発走時刻
            race_data02 = soup.find('div', class_='RaceData02')
            if race_data02:
                time_match = re.search(r'(\d{2}:\d{2})', race_data02.get_text())
                if time_match:
                    race_info['post_time'] = time_match.group(1)
            
            # 競馬場
            racecourse_span = soup.find('span', text=re.compile(r'[0-9]+回'))
            if racecourse_span:
                racecourse_text = racecourse_span.get_text()
                for jp_name, en_name in RACECOURSE_MAP.items():
                    if jp_name in racecourse_text:
                        race_info['racecourse'] = en_name
                        break
            
            # レース番号
            race_num_match = re.search(r'/race/(\d+)/(\d{12})', race_url)
            if race_num_match:
                race_info['race_id'] = race_num_match.group(2)
                # レース番号は最後の2桁
                race_info['race_number'] = race_num_match.group(2)[-2:]
            
            # グレード判定
            grade = ''
            if 'GⅠ' in race_info.get('race_name_ja', '') or 'G1' in race_info.get('race_name_ja', ''):
                grade = 'G1'
            elif 'GⅡ' in race_info.get('race_name_ja', '') or 'G2' in race_info.get('race_name_ja', ''):
                grade = 'G2'
            elif 'GⅢ' in race_info.get('race_name_ja', '') or 'G3' in race_info.get('race_name_ja', ''):
                grade = 'G3'
            elif 'L' in text or 'リステッド' in race_info.get('race_name_ja', ''):
                grade = 'L'
            elif 'OP' in text or 'オープン' in text:
                grade = 'OP'
            race_info['grade'] = grade
            
            return race_info
            
        except Exception as e:
            logger.error(f"レース情報解析エラー: {e}")
            return None
    
    def parse_horse_entries(self, race_url: str, race_info: Dict) -> List[Dict]:
        """出走馬情報を取得"""
        logger.info(f"出走馬情報を取得中...")
        
        horses = []
        
        try:
            # 出馬表ページに移動
            shutuba_url = race_url.replace('/race/', '/race/shutuba.html?race_id=')
            self.driver.get(shutuba_url)
            time.sleep(SLEEP_TIME)
            
            soup = BeautifulSoup(self.driver.page_source, 'html.parser')
            
            # 出走馬テーブルを取得
            horse_table = soup.find('table', class_='Shutuba_Table')
            if not horse_table:
                logger.warning("出走馬テーブルが見つかりません")
                return horses
            
            rows = horse_table.find_all('tr')
            
            for row in rows[1:]:  # ヘッダー行をスキップ
                try:
                    cols = row.find_all('td')
                    if len(cols) < 10:
                        continue
                    
                    horse_data = race_info.copy()
                    
                    # 枠番
                    waku = cols[0].get_text(strip=True)
                    horse_data['gate'] = waku if waku.isdigit() else ''
                    
                    # 馬番
                    umaban = cols[1].get_text(strip=True)
                    horse_data['number'] = umaban if umaban.isdigit() else ''
                    
                    # 馬名
                    horse_link = cols[3].find('a')
                    if horse_link:
                        horse_data['horse_name_ja'] = horse_link.get_text(strip=True)
                        horse_data['source_url'] = BASE_URL + horse_link.get('href', '')
                    
                    # 性齢
                    sei_rei = cols[4].get_text(strip=True)
                    if sei_rei:
                        sex_match = re.match(r'([牡牝セ騸])(\d+)', sei_rei)
                        if sex_match:
                            horse_data['sex'] = SEX_MAP.get(sex_match.group(1), '')
                            horse_data['age'] = sex_match.group(2)
                    
                    # 斤量
                    weight = cols[5].get_text(strip=True)
                    if weight:
                        horse_data['weight_kg'] = weight
                    
                    # 騎手
                    jockey = cols[6].get_text(strip=True)
                    if jockey:
                        horse_data['jockey_ja'] = jockey
                    
                    # 厩舎（調教拠点）
                    stable = cols[7].get_text(strip=True)
                    for key, value in TRAINING_CENTER_MAP.items():
                        if key in stable:
                            horse_data['training_center'] = value
                            break
                    
                    # デフォルト値設定
                    horse_data['status'] = 'LikelyRunner'
                    horse_data['note'] = ''
                    
                    horses.append(horse_data)
                    
                except Exception as e:
                    logger.error(f"馬情報解析エラー: {e}")
                    continue
            
            logger.info(f"{len(horses)}頭の馬情報を取得しました")
            return horses
            
        except Exception as e:
            logger.error(f"出走馬取得エラー: {e}")
            return horses
    
    def scrape_all_races(self):
        """全レース情報をスクレイピング"""
        self.setup_driver()
        
        try:
            for date_str in TARGET_DATES:
                logger.info(f"\n{'='*50}")
                logger.info(f"{date_str}のレース情報を収集開始")
                logger.info(f"{'='*50}\n")
                
                # レースURLリストを取得
                race_urls = self.get_race_calendar(date_str)
                
                for i, race_url in enumerate(race_urls, 1):
                    logger.info(f"\n[{i}/{len(race_urls)}] レース処理中...")
                    
                    # レース基本情報を取得
                    race_info = self.parse_race_info(race_url)
                    if not race_info:
                        continue
                    
                    race_info['date'] = date_str
                    
                    # 出走馬情報を取得
                    horses = self.parse_horse_entries(race_url, race_info)
                    
                    # データを保存
                    self.races_data.extend(horses)
                    
                    logger.info(f"レース完了: {race_info.get('race_name_ja', 'N/A')}")
                    time.sleep(SLEEP_TIME)
            
            logger.info(f"\n全データ取得完了: {len(self.races_data)}件")
            
        finally:
            self.close_driver()
    
    def save_to_csv(self, output_file: str = '../jra_races_2026_02_21_22.csv'):
        """CSVファイルに保存"""
        logger.info(f"CSVファイルに保存中: {output_file}")
        
        if not self.races_data:
            logger.warning("保存するデータがありません")
            return
        
        # CSVヘッダー
        headers = [
            'raceName', 'raceNameJa', 'grade', 'date', 'postTime', 
            'racecourse', 'surface', 'distanceMeters', 'turnDirection',
            'raceNumber', 'registrationCount', 'fullGate',
            'horseName', 'horseNameJa', 'sex', 'age', 'trainingCenter',
            'jockey', 'jockeyJa', 'weightKg', 'gate', 'number',
            'status', 'note', 'sourceUrl'
        ]
        
        with open(output_file, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=headers)
            writer.writeheader()
            
            for data in self.races_data:
                row = {
                    'raceName': '',  # 英語名は別途マッピングが必要
                    'raceNameJa': data.get('race_name_ja', ''),
                    'grade': data.get('grade', ''),
                    'date': data.get('date', ''),
                    'postTime': data.get('post_time', ''),
                    'racecourse': data.get('racecourse', ''),
                    'surface': data.get('surface', ''),
                    'distanceMeters': data.get('distance', ''),
                    'turnDirection': data.get('turn_direction', ''),
                    'raceNumber': data.get('race_number', ''),
                    'registrationCount': '',  # 出馬表から計算可能
                    'fullGate': '',
                    'horseName': '',  # 英語名は別途必要
                    'horseNameJa': data.get('horse_name_ja', ''),
                    'sex': data.get('sex', ''),
                    'age': data.get('age', ''),
                    'trainingCenter': data.get('training_center', ''),
                    'jockey': '',  # 英語名は別途必要
                    'jockeyJa': data.get('jockey_ja', ''),
                    'weightKg': data.get('weight_kg', ''),
                    'gate': data.get('gate', ''),
                    'number': data.get('number', ''),
                    'status': data.get('status', ''),
                    'note': data.get('note', ''),
                    'sourceUrl': data.get('source_url', '')
                }
                writer.writerow(row)
        
        logger.info(f"CSV保存完了: {output_file}")


def main():
    """メイン処理"""
    logger.info("="*60)
    logger.info("netkeibaスクレイピング開始")
    logger.info(f"対象日: {', '.join(TARGET_DATES)}")
    logger.info("="*60)
    
    start_time = time.time()
    
    scraper = NetkeibaRaceScraper()
    
    try:
        # スクレイピング実行
        scraper.scrape_all_races()
        
        # CSV保存
        scraper.save_to_csv()
        
        elapsed_time = time.time() - start_time
        logger.info(f"\n処理完了: {elapsed_time:.2f}秒")
        
    except Exception as e:
        logger.error(f"エラーが発生しました: {e}", exc_info=True)
    
    logger.info("="*60)


if __name__ == "__main__":
    main()
