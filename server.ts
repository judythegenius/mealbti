/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";
import { Restaurant, RecommendedRestaurant, RecommendationResponse, MuckBti } from "./src/types";
import http from "http";
import cors from "cors";

dotenv.config();
console.log("KAKAO KEY LOADED:", process.env.KAKAO_REST_API_KEY);
console.log("NAVER KEY LOADED:", !!process.env.NAVER_CLIENT_ID, !!process.env.NAVER_CLIENT_SECRET);
console.log("GEMINI KEY LOADED:", !!process.env.GEMINI_API_KEY); // ← 추가: 키 존재 여부 확인

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 8081;

app.use(cors());
app.use(express.json());

app.get("/terms", (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>먹BTI 서비스 이용약관</title>
  <style>
    body { font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px 20px; color: #333; line-height: 1.7; }
    h1 { font-size: 20px; font-weight: 700; margin-bottom: 8px; }
    h2 { font-size: 15px; font-weight: 700; margin-top: 28px; }
    p, li { font-size: 14px; color: #555; }
  </style>
</head>
<body>
  <h1>먹BTI 서비스 이용약관</h1>
  <p>시행일: 2026년 6월 30일</p>

  <h2>제1조 (목적)</h2>
  <p>본 약관은 먹BTI(이하 "서비스")가 제공하는 식당 추천 서비스의 이용 조건 및 절차에 관한 사항을 규정함을 목적으로 합니다.</p>

  <h2>제2조 (서비스 내용)</h2>
  <p>서비스는 사용자의 식성 성향(먹BTI)을 분석하여 주변 식당을 추천합니다. 추천 결과는 카카오, 네이버, Google Places API를 활용하며 실제 영업 여부와 다를 수 있습니다.</p>

  <h2>제3조 (개인정보 수집)</h2>
  <p>서비스는 식당 추천을 위해 사용자의 위치 정보(위도/경도)를 일시적으로 수집합니다. 수집된 위치 정보는 서버에 저장되지 않으며 추천 결과 제공 후 즉시 폐기됩니다.</p>

  <h2>제4조 (면책조항)</h2>
  <ul>
    <li>추천 식당의 실제 영업시간, 메뉴, 가격은 변경될 수 있습니다.</li>
    <li>서비스는 외부 API(카카오, 네이버, Google)의 데이터를 기반으로 하며 정확성을 보장하지 않습니다.</li>
    <li>서비스 이용 중 발생한 손해에 대해 책임을 지지 않습니다.</li>
  </ul>

  <h2>제5조 (약관 변경)</h2>
  <p>서비스는 필요 시 약관을 변경할 수 있으며 변경 시 서비스 내 공지합니다.</p>

  <h2>문의</h2>
  <p>이용약관 관련 문의는 서비스 내 피드백 기능을 통해 접수해 주세요.</p>
</body>
</html>`);
});

const googlePlaceCache = new Map<string, { data: any; ts: number }>();
const naverExistCache = new Map<string, { exists: boolean; ts: number }>();
const CACHE_TTL = 86400000;

async function getGooglePlaceDetails(name: string, address: string): Promise<{
  hours: string | null;
  menuItems: string[];
} | null> {
  const kstNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const days = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
  const todayKr = days[kstNow.getDay()];
  const dateStr = kstNow.toISOString().slice(0, 10);

  const cacheKey = `${name}_${address}_${dateStr}`;
  const cached = googlePlaceCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return null;

  try {
    const findRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(name + " " + address)}&inputtype=textquery&fields=place_id&language=ko&key=${apiKey}`
    );
    const findData: any = await findRes.json();
    if (!findData.candidates?.length) return null;

    const placeId = findData.candidates[0].place_id;

    const detailRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=opening_hours&language=ko&key=${apiKey}`
    );
    const detailData: any = await detailRes.json();
    const result = detailData.result || {};

    let hours: string | null = null;
    const weekdayText = result.opening_hours?.weekday_text;
    if (weekdayText?.length) {
      console.log(`=== weekdayText:`, JSON.stringify(weekdayText));
      console.log(`=== 오늘 요일: ${todayKr}`);
      const todayLine = weekdayText.find((l: string) => l.startsWith(todayKr));
      console.log(`=== todayLine: ${todayLine}`);
      hours = todayLine ? todayLine.replace(/^.*?:\s*/, "") : null;
    }

    const finalResult = { hours, menuItems: [] };
    googlePlaceCache.set(cacheKey, { data: finalResult, ts: Date.now() });
    console.log(`=== Google Places 성공: ${name} | 시간: ${hours}`);
    return finalResult;

  } catch (e) {
    console.error(`Google Places 실패 (${name}):`, e);
    return null;
  }
}

function calculateHaversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}


async function generateCommentsWithRetry(ai: any, commentPrompt: string, retries = 1): Promise<string> {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await ai.models.generateContent({
        model: "gemini-1.5-flash-8b",
        contents: commentPrompt,
        config: { temperature: 0.8, responseMimeType: "application/json" }
      });
      return res.text || "[]";
    } catch (e: any) {
      const isOverloaded = e?.message?.includes("UNAVAILABLE") || e?.message?.includes("high demand");
      if (isOverloaded && i < retries) {
        await new Promise(r => setTimeout(r, 800)); // 0.8초 대기 후 재시도
        continue;
      }
      throw e;
    }
  }
  return "[]";
}

function getDeterministicRating(name: string): number {
  let sum = 0;
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
  const rating = 4.1 + (sum % 9) / 10;
  return parseFloat(rating.toFixed(1));
}

function extractNeighborhood(addressText: string): string {
  if (!addressText) return "서울";
  const cleaned = addressText.replace(/\(.*?\)/g, "").replace("인근", "").trim();
  const words = cleaned.split(/\s+/);
  const neighborhoodWord = words.find(w => w.endsWith("동") || w.endsWith("역") || w.endsWith("가") || w.endsWith("길"));
  if (neighborhoodWord) return neighborhoodWord;
  const guWord = words.find(w => w.endsWith("구"));
  if (guWord) return guWord;
  return words[words.length - 1] || "서울";
}

async function checkNaverExists(name: string, address: string): Promise<boolean> {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) return true;

  const dateStr = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" })).toISOString().slice(0, 10);
  const cacheKey = `${name}_${address}_${dateStr}`;
  const cached = naverExistCache.get(cacheKey);
  if (cached) return cached.exists;

  try {
    const url = `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(name)}&display=5`;
    const res = await fetch(url, {
      headers: {
        "X-Naver-Client-Id": clientId,
        "X-Naver-Client-Secret": clientSecret
      }
    });
    const data: any = await res.json();

    let exists = false;
    if (data.items && data.items.length > 0) {
      const cleanTarget = name.replace(/\s/g, "");
      exists = data.items.some((item: any) => {
        const cleanTitle = (item.title || "").replace(/<[^>]*>/g, "").replace(/\s/g, "");
        return cleanTitle.includes(cleanTarget.slice(0, 3)) || cleanTarget.includes(cleanTitle.slice(0, 3));
      });
    }

    naverExistCache.set(cacheKey, { exists, ts: Date.now() });
    return exists;
  } catch (e) {
    console.error(`네이버 존재 확인 실패 (${name}):`, e);
    return true;
  }
}

const CATEGORY_KEYWORD_MAP: Record<string, string[]> = {
  "한식": ["한식", "백반", "국밥", "찌개", "한정식", "냉면", "보쌈", "갈비", "삼겹살", "설렁탕", "육개장", "곰탕", "비빔밥", "쌈밥", "순대국", "해장국", "밀면", "감자탕", "불고기", "된장"],
  "중식": ["중식", "짜장면", "짬뽕", "마라탕", "탕수육", "딤섬", "마라샹궈", "꿔바로우", "양꼬치", "훠궈", "깐풍기"],
  "일식": ["일식", "초밥", "스시", "라멘", "돈까스", "우동", "소바", "오마카세", "돈부리", "카츠", "야키토리", "덮밥"],
  "양식": ["양식", "파스타", "스테이크", "브런치", "이탈리안", "샌드위치", "함박", "리조또", "뇨끼", "그라탕", "프렌치"],
  "분식": ["분식", "떡볶이", "김밥", "순대", "튀김", "라볶이", "쫄면", "어묵", "군만두", "떡볶"],
  "치킨": ["치킨", "닭강정", "후라이드", "양념치킨", "간장치킨", "마늘치킨", "반반치킨", "닭발"],
  "피자": ["피자", "화덕피자", "도우", "페퍼로니"],
  "버거": ["버거", "패스트푸드", "햄버거", "수제버거", "치즈버거"],
  "브런치": ["브런치", "에그베네딕트", "팬케이크", "와플", "크로플", "샌드위치", "토스트", "카페밥"],
  "샐러드": ["샐러드", "포케", "그린볼", "웜볼", "채식", "비건", "건강식"],
  "멕시칸": ["멕시칸", "타코", "브리또", "퀘사디아", "나초"],
  "아시안": ["베트남", "태국", "쌀국수", "팟타이", "아시안", "월남쌈", "포케", "반미", "팟카파오", "똠얌"]
};

// server.ts 안의 getMenuKeywordsFromMBTI 함수 전체를 아래로 교체
function getMenuKeywordsFromMBTI(mbti: MuckBti): string[] {
  const { spicy, fullness, meatVeg, speed, drink, health } = mbti;

  const isHigh = (v: number) => v >= 4;
  const isLow  = (v: number) => v <= 2;
  const isMid  = (v: number) => v === 3;
  const score  = (v: number) => v;

  const POOL = {
    spicyHigh:   ["마라탕", "마라샹궈", "불닭볶음면", "낙지볶음", "쭈꾸미볶음", "매운갈비찜", "닭발볶음", "순대볶음", "떡볶이", "탄탄면", "양꼬치", "짬뽕", "불닭", "매운해물탕", "오돌뼈볶음", "꼼장어볶음"],
    spicyMid:    ["제육볶음", "김치찌개", "부대찌개", "찜닭", "순대국", "육개장", "닭볶음탕", "감자탕", "뼈해장국", "오징어볶음", "낙지덮밥", "비빔냉면"],
    spicyLow:    ["칼국수", "설렁탕", "곰탕", "돈까스", "카츠", "초밥", "우동", "소바", "오므라이스", "함박스테이크", "크림파스타", "냉면", "백반", "연어덮밥", "샤브샤브"],

    fullnessHigh: ["국밥", "감자탕", "뼈해장국", "한정식", "돼지국밥", "쌈밥", "육개장", "설렁탕", "갈비탕", "찜닭", "보쌈", "대구탕", "삼겹살", "항정살", "갈비구이", "순대국"],
    fullnessMid:  ["비빔밥", "제육볶음", "돈까스", "불고기", "우동", "냉면", "파스타", "초밥", "라멘", "볶음밥", "덮밥", "쌀국수"],
    fullnessLow:  ["샐러드", "포케", "유부초밥", "김밥", "샌드위치", "브런치", "토스트", "카페밥", "롤", "아보카도토스트", "월남쌈", "라이스페이퍼롤", "소바"],

    speedFast:   ["김밥", "라멘", "분식", "국수", "우동", "돈부리", "제육덮밥", "순대국", "떡볶이", "편의점도시락", "핫도그", "치킨", "버거"],
    speedSlow:   ["오마카세", "코스요리", "파인다이닝", "이탈리안", "프렌치", "스시오마카세", "한정식", "와인바", "샤브샤브", "브런치카페", "이자카야", "철판요리"],

    drinkHigh:   ["파전", "해물파전", "보쌈", "족발", "치킨", "이자카야", "포차", "수육", "곱창", "막창", "삼겹살", "오돌뼈", "닭발", "간장게장", "회", "문어숙회"],
    drinkLow:    ["비빔밥", "국수", "샐러드", "포케", "브런치", "라멘", "우동", "냉면", "쌀국수", "덮밥", "샌드위치"],

    healthLoss:  ["샐러드", "포케", "두부", "샤브샤브", "연어덮밥", "훈제연어", "월남쌈", "채식뷔페", "나물정식", "비빔밥", "쌈밥", "쌀국수", "닭가슴살도시락", "그릭요거트볼"],
    healthGain:  ["소고기", "장어", "삼계탕", "스테이크", "닭갈비", "훠궈", "육회", "갈비탕", "닭볶음탕", "삼겹살", "제육볶음", "곱창", "오리구이", "단백질도시락", "항정살"],
    healthSugar: ["현미밥", "두부", "나물", "채소", "한정식", "사찰음식", "죽", "된장국", "샐러드", "해산물", "맑은국", "쌈밥", "생선구이", "두부조림", "나물비빔밥"],

    korean:      ["한식", "비빔밥", "제육볶음", "김치찌개", "된장찌개", "불고기", "국밥", "갈비", "냉면", "쌈밥"],
    japanese:    ["일식", "초밥", "라멘", "우동", "돈까스", "카츠", "연어덮밥", "오마카세", "야키토리", "텐동"],
    chinese:     ["중식", "짜장면", "짬뽕", "탕수육", "볶음밥", "마파두부", "깐풍기", "마라탕", "양꼬치", "딤섬"],
    western:     ["양식", "파스타", "스테이크", "버거", "샌드위치", "리조또", "함박", "브런치", "피자", "수프"],
    asian:       ["쌀국수", "베트남", "태국", "팟타이", "반미", "월남쌈", "똠얌", "팟카파오", "나시고렝", "쌀국수"],
    grillMeat:   ["삼겹살", "갈비", "항정살", "목살", "쌈밥", "보쌈", "수육", "곱창", "막창", "양꼬치"],
    lightMeal:   ["브런치", "샐러드", "포케", "연어", "아보카도토스트", "크로플", "카페밥", "스무디볼", "그래놀라"],
  };

  const merge = (...arrays: string[][]): string[] => Array.from(new Set(arrays.flat()));

  const weightedMerge = (entries: [string[], number][]): string[] => {
    const result: string[] = [];
    for (const [arr, weight] of entries) {
      const count = Math.round(arr.length * (weight / 10));
      result.push(...arr.slice(0, Math.max(count, 3)));
    }
    return Array.from(new Set(result));
  };

  // ── 1. 건강 목표 최우선 ──────────────────────────────
  if (health === "loss") {
    if (isHigh(spicy)) return merge(POOL.healthLoss, POOL.spicyMid.slice(0, 4));
    if (isHigh(drink)) return merge(POOL.healthLoss, ["파전", "월남쌈", "해물샤브"]);
    return merge(POOL.healthLoss, POOL.lightMeal.slice(0, 5));
  }
  if (health === "gain") {
    if (isHigh(spicy)) return merge(POOL.healthGain, POOL.spicyMid.slice(0, 5));
    if (isHigh(drink)) return merge(POOL.healthGain, ["삼겹살", "곱창", "막창", "수육"]);
    return POOL.healthGain;
  }
  if (health === "sugar") {
    if (isLow(spicy)) return merge(POOL.healthSugar, ["두부조림", "나물비빔밥", "맑은탕"]);
    return POOL.healthSugar;
  }

  // ── 2. 음주 극단 (drink 5) ─────────────────────────
  if (score(drink) === 5) {
    if (isHigh(spicy) && isHigh(meatVeg))
      return merge(["닭발", "곱창", "낙지볶음", "막창", "오돌뼈", "순대볶음"], POOL.drinkHigh.slice(0, 6));
    if (isHigh(spicy))
      return merge(["닭발", "곱창", "낙지볶음", "막창", "쭈꾸미볶음"], POOL.drinkHigh);
    if (isHigh(fullness))
      return merge(["삼겹살", "소갈비", "보쌈", "족발", "수육", "해물탕"], POOL.drinkHigh);
    if (isHigh(meatVeg))
      return merge(POOL.grillMeat, POOL.drinkHigh.slice(0, 6));
    if (isLow(meatVeg))
      return merge(["회", "문어숙회", "멍게", "굴전"], POOL.drinkHigh.slice(0, 5));
    return POOL.drinkHigh;
  }

  // ── 3. 음주 높음 (drink 4) ─────────────────────────
  if (score(drink) === 4) {
    if (isHigh(spicy))
      return merge(["닭발", "낙지볶음", "쭈꾸미", "오돌뼈", "순대볶음"], POOL.drinkHigh.slice(0, 8));
    if (isHigh(fullness))
      return merge(["삼겹살", "항정살", "갈비", "보쌈"], POOL.drinkHigh.slice(0, 8));
    if (isLow(spicy))
      return merge(["이자카야", "파전", "보쌈", "회", "초밥"], POOL.drinkHigh.slice(0, 6));
    return merge(POOL.drinkHigh, POOL.fullnessMid.slice(0, 4));
  }

  // ── 4. 매운맛(자극) 극단 ────────────────────────────
  if (score(spicy) === 5) {
    return weightedMerge([
      [POOL.spicyHigh, 8],
      [isHigh(fullness) ? POOL.fullnessHigh : POOL.fullnessMid, 4],
      [isHigh(meatVeg) ? POOL.grillMeat : [], 3],
    ]);
  }
  if (score(spicy) === 4) {
    if (isHigh(fullness) && isHigh(meatVeg))
      return merge(POOL.spicyHigh.slice(0, 6), POOL.grillMeat.slice(0, 5));
    if (isHigh(fullness))
      return merge(POOL.spicyMid, POOL.spicyHigh.slice(0, 5));
    if (isHigh(meatVeg))
      return merge(["짬뽕", "마라탕", "낙지볶음", "제육볶음", "닭볶음탕"], POOL.spicyHigh.slice(0, 5));
    return merge(POOL.spicyHigh.slice(0, 10), POOL.spicyMid.slice(0, 5));
  }

  // ── 5. 순한맛 극단 ──────────────────────────────────
  if (score(spicy) === 1) {
    if (isLow(fullness) && isLow(meatVeg))
      return merge(["포케", "샐러드", "아보카도토스트", "소바", "유부초밥", "연어덮밥", "브런치"], POOL.spicyLow.slice(0, 5));
    if (isHigh(fullness))
      return merge(["설렁탕", "곰탕", "백반", "한정식", "돈까스", "함박스테이크", "우동", "칼국수"], POOL.spicyLow);
    if (isHigh(speed))
      return merge(["오마카세", "프렌치", "이탈리안", "한정식", "파인다이닝", "브런치카페"], POOL.spicyLow);
    return POOL.spicyLow;
  }
  if (score(spicy) === 2) {
    if (isHigh(fullness))
      return merge(["설렁탕", "곰탕", "갈비탕", "백반", "한정식", "돈까스", "우동", "칼국수"], POOL.spicyLow.slice(0, 6));
    if (isHigh(drink))
      return merge(["초밥", "이자카야", "파전", "보쌈", "냉면", "파스타"], POOL.spicyLow.slice(0, 6));
    return merge(POOL.spicyLow, POOL.lightMeal.slice(0, 4));
  }

  // ── 6. 포만감 극단 ──────────────────────────────────
  if (score(fullness) === 5) {
    if (isMid(spicy) || isHigh(spicy))
      return merge(["감자탕", "순대국", "찜닭", "매운갈비찜", "육개장", "국밥", "뼈해장국", "부대찌개"], POOL.fullnessHigh);
    return POOL.fullnessHigh;
  }
  if (score(fullness) === 4) {
    if (isMid(spicy))
      return merge(["찜닭", "제육볶음", "김치찌개", "부대찌개", "순대국", "갈비탕"], POOL.fullnessMid);
    return merge(POOL.fullnessHigh.slice(0, 8), POOL.fullnessMid.slice(0, 5));
  }
  if (score(fullness) === 1) {
    if (isLow(spicy))
      return merge(["포케", "샐러드", "브런치", "아보카도토스트", "유부초밥", "연어덮밥", "소바"], POOL.fullnessLow);
    return POOL.fullnessLow;
  }
  if (score(fullness) === 2) {
    if (isLow(speed))
      return merge(["김밥", "편의점도시락", "국수", "라멘", "우동", "돈부리", "덮밥"], POOL.fullnessLow);
    return merge(POOL.fullnessLow, POOL.lightMeal.slice(0, 5));
  }

  // ── 7. 고기/야채 극단 (신규) ──────────────────────────
  if (score(meatVeg) === 5) {
    if (isHigh(drink))
      return merge(POOL.grillMeat, POOL.drinkHigh.slice(0, 6));
    return merge(POOL.grillMeat, POOL.healthGain.slice(0, 4));
  }
  if (score(meatVeg) === 4) {
    if (isHigh(spicy))
      return merge(["제육볶음", "닭볶음탕", "낙지볶음"], POOL.grillMeat.slice(0, 6));
    return merge(POOL.grillMeat.slice(0, 8), POOL.fullnessMid.slice(0, 4));
  }
  if (score(meatVeg) === 1) {
    if (isHigh(fullness))
      return merge(["한정식", "나물비빔밥", "사찰음식", "쌈밥"], POOL.lightMeal);
    return POOL.lightMeal;
  }
  if (score(meatVeg) === 2) {
    return merge(POOL.lightMeal, ["비빔밥", "월남쌈", "소바", "냉면"]);
  }

  // ── 8. 속도 극단 (1=빠름, 5=느긋) ────────────────────
  if (score(speed) === 5) {
    if (isLow(spicy))
      return merge(["오마카세", "코스요리", "파인다이닝", "프렌치", "이탈리안", "스시오마카세", "한정식", "와인바"], POOL.speedSlow);
    return merge(POOL.speedSlow, ["한정식", "이자카야", "철판요리", "샤브샤브"]);
  }
  if (score(speed) === 4) {
    if (isHigh(drink))
      return merge(["이자카야", "브런치카페", "한정식", "와인바"], POOL.speedSlow.slice(0, 6));
    return merge(["브런치", "한정식", "이탈리안", "샤브샤브", "초밥", "파스타"], POOL.speedSlow.slice(0, 5));
  }
  if (score(speed) === 1) {
    if (isHigh(fullness))
      return merge(["순대국", "국밥", "라멘", "우동", "돈부리", "제육덮밥", "분식"], POOL.speedFast);
    return POOL.speedFast;
  }
  if (score(speed) === 2) {
    return merge(POOL.speedFast, ["치킨", "버거", "피자", "떡볶이", "순대"]);
  }

  // ── 9. 중간값(3) 폴백 - 성향 합산으로 카테고리 분기 ──
  const safe = (v: number | undefined) => (typeof v === "number" ? v : 3);
  const sum = safe(spicy) + safe(fullness) + safe(meatVeg) + safe(speed) + safe(drink);
  const categories = [POOL.korean, POOL.japanese, POOL.chinese, POOL.western, POOL.asian, POOL.grillMeat, POOL.lightMeal];
  const subBias = (spicy * 2 + drink + fullness) % 3;
  const primary = categories[sum % categories.length];
  const secondary = categories[(sum + subBias + 1) % categories.length];

  return merge(primary, secondary.slice(0, 4));
}


function generateDynamicComment(
  rest: { name: string; category: string; menu_preview: string[] },
  mbti: MuckBti,
  mealType: string
): string {
  const cat = rest.category || "";
  const menus = rest.menu_preview || [];
  const name = rest.name || "";
  const mainMenu = menus[0] || "";
  const subMenu = menus[1] || "";
  const catLeaf = cat.split(" > ").pop() || "맛집";
  const menuLabel = mainMenu || subMenu || catLeaf;

  // ── 시드 기반 일관성 (같은 날 같은 식당은 같은 문구) ──
  const seedText = `${name}-${mealType}-${mainMenu}-${mbti.spicy}-${mbti.fullness}-${mbti.speed}-${new Date().toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}`;
  const seed = Array.from(seedText).reduce((sum, ch) => sum + ch.charCodeAt(0), 0);

  // ── 1순위: 메뉴/카테고리 키워드 정밀 매칭 ──────────────────────────
  const menuComments: Record<string, string[]> = {
    "베트남": [
      `${mainMenu || "쌀국수"}의 맑고 깊은 육수와 라임향이 입 안을 상쾌하게 열어줘요`,
      "베트남 현지의 향긋한 허브 향이 코끝을 자극하는, 가볍지만 풍성한 한 끼예요",
    ],
    "이자카야": [
      `${mealType === "저녁" || mealType === "야식" ? "오늘 저녁" : "오늘"} 일본식 분위기에서 한 잔, ${name}의 안주 라인업이 기대돼요`,
      "야키토리 한 꼬치에 하이볼 한 잔, 오늘 피로를 이렇게 풀어보세요",
    ],
    "쌀국수": [
      `${mainMenu}의 맑고 깊은 육수가 속을 따뜻하게 감싸줄 거예요`,
      "가볍지만 든든한 쌀국수 한 그릇, 오늘 오후를 버티게 해줄 에너지예요",
    ],
    "냉면": [
      "탱글탱글한 면발에 새콤달콤한 육수, 지금 이 계절에 딱 맞는 선택이에요",
      `${mainMenu} 한 그릇이면 더위도 피로도 한방에 날아가요`,
    ],
    "마라탕": [
      "얼얼하게 혀를 감싸는 마라 향, 오늘 스트레스를 불태울 준비 됐나요?",
      `${mainMenu}의 기름진 감칠맛과 화끈한 매운맛이 중독적으로 당기는 날이에요`,
    ],
    "마라샹궈": [
      "재료 직접 골라 담는 재미, 거기다 마라 향까지 — 오늘 여기가 정답이에요",
      "얼얼하고 고소한 마라 기름이 입 안 가득 퍼지는 순간이 기다리고 있어요",
    ],
    "삼겹살": [
      "불판 위에서 지글지글 익어가는 소리만으로도 배고파지는 곳이에요",
      `${mainMenu} 한 점에 쌈 한 장, 오늘 이 조합을 거부할 이유가 없어요`,
    ],
    "곱창": [
      "특유의 고소하고 진한 내장 향이 진짜 단골 맛집의 증거예요",
      `${mainMenu}의 쫄깃한 식감이 소주 한 잔을 절로 부르는 날이에요`,
    ],
    "초밥": [
      "장인이 한 점씩 쥐어낸 샤리와 네타의 온도 차가 입 안에서 완성돼요",
      `${mainMenu}의 윤기 있는 밥알과 신선한 토핑이 오늘 특별한 한 끼를 만들어줄 거예요`,
    ],
    "라멘": [
      "몇 시간 우려낸 진한 육수가 면발에 스며든 걸 한 입에 느껴보세요",
      `${mainMenu}의 농후한 향이 문 앞에서부터 발길을 붙잡아요`,
    ],
    "돈까스": [
      "겉은 바삭, 속은 촉촉한 커틀릿의 정석을 오늘 여기서 만나보세요",
      `${mainMenu}의 두꺼운 두께감이 한 입 베어 물면 육즙을 터뜨려줄 거예요`,
    ],
    "칼국수": [
      "직접 밀어낸 넓적한 면발에 진한 멸치 육수, 어머니 손맛이 그리운 날이에요",
      `${mainMenu} 한 그릇이면 속이 따끈하게 채워지는 느낌이에요`,
    ],
    "비빔밥": [
      "형형색색의 나물과 고슬고슬한 밥, 비벼 먹는 순간 맛의 하모니가 시작돼요",
      `${mainMenu}에 고추장 한 숟가락 넣고 쓱쓱 비비면 오늘 점심 끝이에요`,
    ],
    "갈비": [
      "불 위에서 직화로 구워지는 갈비 향이 코끝을 자극하는 곳이에요",
      `${mainMenu}의 두툼한 살점이 뼈에서 떨어질 때의 쾌감, 오늘 여기서 느껴보세요`,
    ],
    "국밥": [
      "뜨끈한 국물 한 숟가락이면 어제 피로가 싹 풀리는 기적의 한 그릇이에요",
      `${mainMenu}의 묵직한 뼈 육수가 속을 든든하게 채워줄 거예요`,
    ],
    "파스타": [
      "알덴테로 삶아낸 면에 소스가 윤기 있게 코팅된 비주얼부터 시작돼요",
      `${mainMenu}의 풍성한 소스가 입 안을 가득 채우는 이탈리안의 정수예요`,
    ],
    "브런치": [
      `${mainMenu}와 따뜻한 커피 한 잔, 오늘 ${mealType}만큼은 여유롭게 시작해보세요`,
      "예쁜 플레이팅에 담긴 브런치 한 상, 먹기 전에 사진 한 장은 필수예요",
    ],
    "샐러드": [
      "신선한 재료 본연의 맛을 살린 드레싱, 가볍지만 만족스러운 한 끼예요",
      `${mainMenu}의 알록달록한 색감이 입맛을 돋우고 영양도 챙겨줘요`,
    ],
    "포케": [
      "하와이 감성의 신선한 한 그릇, 눈도 입도 같이 행복해지는 점심이에요",
      `${mainMenu}의 신선한 연어와 아보카도가 오늘 컨디션을 끌어올려 줄 거예요`,
    ],
    "족발": [
      "쫀득하게 삶아낸 껍데기와 부드러운 살점의 조화, 오늘 야식 고민 끝이에요",
      `${mainMenu}에 새우젓 한 점 곁들이면 소주 한 병이 순식간에 사라져요`,
    ],
    "보쌈": [
      "부드럽게 삶아낸 수육을 배추에 싸 먹는 그 순간, 한국 음식의 매력이에요",
      `${mainMenu}에 굴젓이나 새우젓을 얹으면 완성되는 조화, 어른들의 음식이에요`,
    ],
    "치킨": [
      "갓 튀겨낸 바삭한 껍데기를 베어 무는 순간의 행복, 오늘 여기서 느껴봐요",
      `${mainMenu}의 매콤달콤한 소스가 손가락을 절로 핥게 만드는 집이에요`,
    ],
    "버거": [
      "두툼한 패티와 신선한 채소가 층층이 쌓인 비주얼, 한 입 크게 베어 물어야 해요",
      `${mainMenu}의 육즙이 터지는 순간, 다른 버거는 생각도 안 날 거예요`,
    ],
    "떡볶이": [
      "쫀득쫀득한 떡이 매콤달콤한 소스를 머금은 그 맛, 한국인의 소울푸드예요",
      `${mainMenu}의 빨간 국물에 어묵 국물 한 모금이면 오늘 한 끼가 완성돼요`,
    ],
    "짜장면": [
      "춘장의 구수한 향이 깊게 밴 소스와 탱탱한 면발, 중화요리의 정석이에요",
      `${mainMenu} 위에 달걀 프라이 하나 얹으면 이 이상의 점심은 없어요`,
    ],
    "짬뽕": [
      "얼큰하고 시원한 국물 한 숟가락이면 왜 이 집이 유명한지 바로 알게 돼요",
      `${mainMenu}의 풍성한 해물과 채소가 국물에 녹아든 깊은 맛이에요`,
    ],
    "곰탕": [
      "몇 날 며칠을 우려낸 뼈 국물의 깊이, 첫 숟가락에 그 정성이 느껴져요",
      `${mainMenu}에 소금 간 살짝 하면 완성되는 담백함, 이게 진짜 한식이에요`,
    ],
    "설렁탕": [
      "뽀얗게 우러난 국물과 부드러운 고기, 오늘 속이 비었다면 여기예요",
      "새벽부터 우려낸 사골 국물 한 그릇이면 오늘 하루 버틸 에너지 충전 완료예요",
    ],
    "오마카세": [
      "셰프의 선택을 믿고 앉아있으면 오늘 저녁이 특별해지는 경험이에요",
      `${mainMenu} 코스 한 편, 계절 식재료로 이야기를 풀어내는 맛의 여정이에요`,
    ],
    "스테이크": [
      "두툼하게 구워낸 고기의 육즙이 칼을 댔을 때 흘러내리는 그 순간이에요",
      `${mainMenu} 한 접시, 오늘만큼은 자신에게 제대로 투자하는 날이에요`,
    ],
    "우동": [
      "탱글하고 굵은 면발이 따뜻한 가쓰오 육수에 잠긴 순간, 일본 감성이 가득해요",
      `${mainMenu} 한 그릇이면 뭔가 부족한 오늘 점심을 채워줄 수 있어요`,
    ],
    "소바": [
      "메밀 특유의 고소하고 담백한 향, 소스에 살짝 찍어 먹는 맛이 예술이에요",
      "깔끔하고 가볍게, 오늘 속 편하게 한 끼 하고 싶을 때 딱 맞는 선택이에요",
    ],
  };

  for (const [keyword, comments] of Object.entries(menuComments)) {
    const matched =
      menus.some(m => m.includes(keyword)) ||
      cat.includes(keyword) ||
      name.includes(keyword);
    if (matched) {
      return comments[seed % comments.length];
    }
  }

  // ── 2순위: 시간대별 분기 ──────────────────────────────────────────
  if (mealType === "아침") {
    const morningPool = [
      `이른 아침, ${name}에서 조용하고 여유로운 한 끼로 하루를 열어보세요`,
      `${mainMenu || "아침 메뉴"} 한 그릇으로 오늘 하루를 든든하게 시작해요`,
      cat.includes("카페") || cat.includes("베이커리")
        ? `${name}의 갓 구운 빵 향과 커피 한 잔으로 오늘 하루를 시작해보세요`
        : `따뜻한 ${mainMenu || catLeaf} 한 그릇, 아침에 이 선택이면 후회 없어요`,
    ];
    return morningPool[seed % morningPool.length];
  }

  if (mealType === "야식") {
    const latePool = [
      mbti.drink >= 4
        ? `${mainMenu || "안주"} 한 접시에 한 잔 걸치기 딱 좋은 밤이에요`
        : `늦은 밤 ${name}에서 오늘 하루의 마무리를 맛있게 해보세요`,
      cat.includes("치킨")
        ? "야식의 왕, 치킨. 오늘 밤 자책 없이 즐겨도 돼요"
        : `${name}의 ${menuLabel}, 내일 걱정은 내일 하고 오늘 밤은 맛있게 먹어요`,
      `야식으로 ${menuLabel}이 당기는 밤, 오늘은 이 선택이 맞아요`,
    ];
    return latePool[seed % latePool.length];
  }

  if (mealType === "저녁") {
    const eveningPool = [
      mbti.drink >= 4
        ? `${mainMenu || "메뉴"} 한 점에 가볍게 한 잔, 오늘 저녁 이 이상 필요 없어요`
        : `${name}에서 오늘 하루 마무리로 딱 맞는 저녁이에요`,
      `퇴근 후 ${name}의 ${menuLabel}, 오늘 수고한 자신에게 주는 작은 선물이에요`,
      `저녁은 ${menuLabel}으로 든든하게, ${name}에서 하루를 마무리해요`,
    ];
    return eveningPool[seed % eveningPool.length];
  }

  // 점심 (default)
  const lunchPool = [
    `${name}의 ${menuLabel}, 오늘 점심 고민을 딱 끊어줄 선택이에요`,
    `${mainMenu || catLeaf} 한 그릇으로 오후 업무까지 버텨낼 에너지 충전이에요`,
    `점심엔 역시 ${menuLabel}, ${name}에서 빠르게 해결하고 여유 시간도 챙겨요`,
  ];

  // ── 3순위: 건강 목표 ──────────────────────────────────────────────
  if (mbti.health === "loss") {
    return `가볍고 깔끔하게, 오늘 식단 목표를 지켜가면서도 만족스러운 한 끼예요`;
  }
  if (mbti.health === "gain") {
    return `${mainMenu || "고단백 메뉴"} 한 상으로 오늘 운동 후 영양을 빠르게 보충해보세요`;
  }
  if (mbti.health === "sugar") {
    return `정갈하고 자극 없는 ${name}의 한 상, 혈당 걱정 없이 맛있게 드세요`;
  }

 // ── 4순위: 성향 조합 (각각 풀로 만들어 seed로 분산) ────────────────
  if (mbti.spicy >= 4 && mbti.fullness >= 4) {
    const pool = [
      `${name}에서 화끈하고 든든하게, 오늘 가장 확실한 한 끼예요`,
      `매콤하면서도 든든한 ${menuLabel}, ${name}이 오늘 정답이에요`,
      `자극적이면서 배도 부르게, ${name}의 ${menuLabel}이 딱이에요`,
    ];
    return pool[seed % pool.length];
  }
  if (mbti.spicy >= 4) {
    const pool = [
      `${mainMenu || "매콤한 메뉴"}의 칼칼한 맛이 입 안을 깨우는 경험이에요`,
      `${name}의 ${menuLabel}, 매운맛이 당기는 오늘 딱 맞는 선택이에요`,
      `화끈한 한 입이 필요할 때, ${name}이 그 답을 줄 거예요`,
    ];
    return pool[seed % pool.length];
  }
  if (mbti.spicy <= 2 && mbti.meatVeg <= 2) {
    const pool = [
      `자극 없이 재료 본연의 맛을 살린 ${name}, 오늘 속이 편해질 거예요`,
      `순하고 담백한 ${menuLabel}, ${name}에서 부담 없이 즐겨보세요`,
      `${name}의 ${menuLabel}은 자극 없이 깔끔하게 마무리되는 한 끼예요`,
    ];
    return pool[seed % pool.length];
  }
  if (mbti.fullness >= 4) {
    const pool = [
      `${mainMenu || "메인 메뉴"} 한 상 앞에 앉으면 빈속 걱정은 끝이에요`,
      `든든하게 채우고 싶은 날, ${name}의 ${menuLabel}이 후회 없을 거예요`,
      `${name}에서 푸짐하게, 오늘은 양 걱정 없이 드셔도 돼요`,
    ];
    return pool[seed % pool.length];
  }
  if (mbti.drink >= 4 && mealType === "저녁") {
    const pool = [
      `${mainMenu || "메뉴"} 한 점에 가볍게 한 잔, 오늘 저녁 이 이상 필요 없어요`,
      `${name}에서 안주 삼아 한 잔, 오늘 하루 마무리로 충분해요`,
    ];
    return pool[seed % pool.length];
  }
  if (mbti.speed <= 2) {
    const pool = [
      `주문하면 금방 나오는 ${name}, 오늘 ${mealType} 고민 끝이에요`,
      `${name}에서 빠르게 해결하고 여유 시간을 만들어보세요`,
      `${mainMenu || catLeaf} 한 그릇, 빠르게 먹고 에너지 충전 완료예요`,
    ];
    return pool[seed % pool.length];
  }
  if (mbti.speed >= 4) {
    const pool = [
      `${name}에서 서두르지 않고 음식 하나하나를 제대로 즐기는 시간이에요`,
      `오늘은 ${menuLabel}을 천천히 음미하며 여유롭게 즐겨보세요`,
      `${name}의 분위기 속에서 느긋하게 한 끼, 오늘은 그럴 자격이 있어요`,
      `빠르게 먹기보다 ${menuLabel}의 맛을 차분히 느끼고 싶은 날이에요`,
    ];
    return pool[seed % pool.length];
  }

  return lunchPool[seed % lunchPool.length];
}

// 불안정 도메인 차단 + timeout 포함 이미지 프록시
const BLOCKED_IMAGE_DOMAINS = ["imgcdn.bdtong.co.kr", "blogfiles.naver.net", "egloos.com"];

app.get("/api/image-proxy", async (req, res) => {
  const url = req.query.url as string;
  if (!url) return res.status(400).send("url param required");

  let parsed: URL;
  try { parsed = new URL(url); } catch { return res.status(400).send("invalid url"); }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return res.status(400).send("invalid protocol");
  }
  if (BLOCKED_IMAGE_DOMAINS.some(d => parsed.hostname.includes(d))) {
    return res.status(403).send("blocked domain");
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/137 Safari/537.36",
        "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "Accept-Language": "ko-KR,ko;q=0.9",
        "Referer": "https://www.naver.com/",
      },
    });
    clearTimeout(timeout);
    if (!response.ok) return res.status(response.status).send("upstream error");
    const contentType = response.headers.get("content-type") || "image/jpeg";
    if (!contentType.startsWith("image/")) return res.status(415).send("not an image");
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("Access-Control-Allow-Origin", "*"); 
    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (e: any) {
    const isTimeout = e?.name === "AbortError";
    const isDns = e?.cause?.code === "ENOTFOUND";
    if (!isTimeout && !isDns) console.error("Image proxy error:", e?.cause?.code || e?.message);
    res.status(502).send(isTimeout ? "timeout" : isDns ? "dns failed" : "proxy error");
  }
});

app.post("/api/reverse-geocode", async (req, res) => {
  const { latitude, longitude } = req.body;
  if (!latitude || !longitude) return res.status(400).json({ error: "Missing coordinates" });
  const latNum = parseFloat(latitude);
  const lonNum = parseFloat(longitude);

  const apiKey = process.env.KAKAO_REST_API_KEY;
  if (apiKey) {
    try {
      const url = `https://dapi.kakao.com/v2/local/geo/coord2address.json?x=${longitude}&y=${latitude}`;
      const response = await fetch(url, { headers: { Authorization: `KakaoAK ${apiKey}` } });
      const data: any = await response.json();
      if (data.documents && data.documents.length > 0) {
        const addr = data.documents[0].address;
        const roadAddr = data.documents[0].road_address;
        const addressText = roadAddr ? roadAddr.address_name : addr.address_name;
        return res.json({ address: addressText });
      }
    } catch (e) { console.error("Kakao reverse geocode error:", e); }
  }
res.json({ address: "위치 정보를 가져오지 못했어요." });
});

app.get("/api/autocomplete", async (req, res) => {
  const query = req.query.q as string;
  if (!query || query.trim().length === 0) return res.json({ items: [] });

  const apiKey = process.env.KAKAO_REST_API_KEY;
  if (!apiKey || apiKey === "your_kakao_rest_api_key_here") return res.json({ items: [] });

  try {
    const addressUrl = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(query)}&size=5`;
    const keywordUrl = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=10`;
    const [addressResponse, keywordResponse] = await Promise.all([
      fetch(addressUrl, { headers: { Authorization: `KakaoAK ${apiKey}` } }).catch(() => null),
      fetch(keywordUrl, { headers: { Authorization: `KakaoAK ${apiKey}` } }).catch(() => null)
    ]);
    let addressData: any = { documents: [] };
    let keywordData: any = { documents: [] };
    if (addressResponse && addressResponse.ok) addressData = await addressResponse.json().catch(() => ({ documents: [] }));
    if (keywordResponse && keywordResponse.ok) keywordData = await keywordResponse.json().catch(() => ({ documents: [] }));

    const addrItems = (addressData.documents || []).map((doc: any) => ({
      place_name: doc.address_name, category_name: "지역 / 주소", address_name: doc.address_name,
      lat: parseFloat(doc.y), lon: parseFloat(doc.x)
    }));
    const kwItems = (keywordData.documents || []).map((doc: any) => ({
      place_name: doc.place_name, category_name: doc.category_name, address_name: doc.road_address_name || doc.address_name,
      lat: parseFloat(doc.y), lon: parseFloat(doc.x)
    }));
    const combined = [...addrItems, ...kwItems];
    const seen = new Set<string>();
    const items = [];
    for (const item of combined) {
      const key = `${item.lat.toFixed(5)}_${item.lon.toFixed(5)}`;
      if (!seen.has(key)) { seen.add(key); items.push(item); }
    }
    return res.json({ items: items.slice(0, 10) });
  } catch (e) {
    console.error("Autocomplete error:", e);
    return res.json({ items: [] });
  }
});

app.post("/api/geocode", async (req, res) => {
  const { query } = req.body;
  if (!query || query.trim().length === 0) return res.status(400).json({ error: "Query is required" });

  const apiKey = process.env.KAKAO_REST_API_KEY;
  if (apiKey && apiKey !== "your_kakao_rest_api_key_here") {
    try {
      const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(query)}&size=1`;
      const response = await fetch(url, { headers: { Authorization: `KakaoAK ${apiKey}` } });
      const data: any = await response.json();
      if (data.documents && data.documents.length > 0) {
        const doc = data.documents[0];
        return res.json({ lat: parseFloat(doc.y), lon: parseFloat(doc.x), address: doc.address_name });
      }
    } catch (e) { console.error("Kakao geocode error:", e); }
    try {
      const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=1`;
      const response = await fetch(url, { headers: { Authorization: `KakaoAK ${apiKey}` } });
      const data: any = await response.json();
      if (data.documents && data.documents.length > 0) {
        const doc = data.documents[0];
        return res.json({ lat: parseFloat(doc.y), lon: parseFloat(doc.x), address: doc.place_name + " (" + doc.address_name + ")" });
      }
    } catch (e) { console.error("Kakao keyword geocode error:", e); }
  }
  return res.status(404).json({ error: "주소를 찾지 못했어요." });
});

function estimatePriceRange(category: string, menuPreview: string[], mealType: string): string {
  const text = `${category} ${menuPreview.join(" ")}`;
  if (/오마카세|스테이크|한우|소고기|양갈비|갈비|사시미/.test(text)) return "30,000원 이상";
  if (/브런치|파스타|피자|수제버거|돈까스|초밥|쌀국수|샌드위치|샐러드/.test(text)) return "12,000~25,000원";
  if (/카페|커피|디저트|죽|분식|김밥|떡볶이|국밥|설렁탕|해장국|짜장면|라멘|우동|냉면|칼국수/.test(text)) return "8,000~15,000원";
  if (mealType === "야식") return "15,000~30,000원";
  return "10,000~20,000원";
}

function getCategoryFallbackImage(category: string, menuPreview: string[]): string | null {
  const text = `${category} ${menuPreview.join(" ")}`.toLowerCase();
  const fallbackMap: { pattern: RegExp; url: string }[] = [
    { pattern: /짬뽕|짜장|마라|탕수육|중식|딤섬|양꼬치/, url: "https://images.unsplash.com/photo-1585032226651-759b368d7246?w=800&q=80" },
    { pattern: /초밥|스시|라멘|돈까스|우동|일식|소바/, url: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800&q=80" },
    { pattern: /삼겹살|갈비|구이|곱창|막창/, url: "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=800&q=80" },
    { pattern: /국밥|설렁탕|곰탕|순대국|해장국/, url: "https://images.unsplash.com/photo-1583224964978-2257b960c3d3?w=800&q=80" },
    { pattern: /파스타|피자|스테이크|양식|브런치/, url: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&q=80" },
    { pattern: /샐러드|포케|건강식/, url: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80" },
    { pattern: /치킨|버거|피자/, url: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&q=80" },
    { pattern: /떡볶이|분식|김밥/, url: "https://images.unsplash.com/photo-1635363638580-c2809d049eee?w=800&q=80" },
    { pattern: /냉면|쌀국수|베트남/, url: "https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=800&q=80" },
  ];
  for (const item of fallbackMap) {
    if (item.pattern.test(text)) return item.url;
  }
  return null;
}

function stripBranchSuffix(name: string): string {
  const cleaned = name.replace(/<\/?[^>]+(>|$)/g, "").replace(/\s+/g, " ").trim();
  const withoutTrailingBranch = cleaned.replace(/\s+[^\s]+점$/u, "").trim();
  return withoutTrailingBranch || cleaned;
}

function extractDistrict(address: string): string {
  return (address || "").split(/\s+/).find(part => part.endsWith("구")) || "";
}

function estimateBusinessHours(category: string, menuPreview: string[], mealType: string): string {
  const text = `${category} ${menuPreview.join(" ")}`.toLowerCase();
  if (/술집|호프|맥주|이자카야|요리주점|포차|막걸리|bar/.test(text)) return "17:00 - 익일 01:00";
  if (/카페|커피|브런치|디저트|베이커리/.test(text)) return "08:00 - 22:00";
  if (/국밥|해장국|설렁탕|순대국|감자탕/.test(text)) return "07:00 - 22:00";
  if (/고기|구이|갈비|삼겹살|소고기|한우/.test(text)) return "11:00 - 22:00";
  if (mealType === "아침") return "08:00 - 21:00";
  if (mealType === "야식") return "17:00 - 24:00";
  return "11:00 - 21:00";
}

app.post("/api/recommend", async (req, res) => {
  console.log("API /api/recommend called");
  const { muckBti, latitude, longitude, mealType, groupSize, yesterdayFood, searchRadiusM, addressText, excludeNames, categoryOverride } = req.body;

  if (!latitude || !longitude) {
    return res.status(400).json({ error: "COORDINATES_REQUIRED", message: "GPS 위경도 좌표가 반드시 확보되어야 합니다." });
  }

  const latNum = parseFloat(latitude);
  const lonNum = parseFloat(longitude);
  const radius = Math.min(Math.max(searchRadiusM || 1000, 100), 3000);

  const kstDate = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const hour = kstDate.getHours();
  let detectedMealType: "아침" | "점심" | "저녁" | "야식" = "점심";
  if (hour >= 5 && hour < 11) detectedMealType = "아침";
  else if (hour >= 11 && hour < 16) detectedMealType = "점심";
  else if (hour >= 16 && hour < 21) detectedMealType = "저녁";
  else detectedMealType = "야식";
  if (["아침", "점심", "저녁", "야식"].includes(mealType)) {
    detectedMealType = mealType;
  }

  const menuKeywords = (categoryOverride && Array.isArray(categoryOverride) && categoryOverride.length > 0)
    ? categoryOverride.flatMap((c: string) => CATEGORY_KEYWORD_MAP[c] || [c])
    : getMenuKeywordsFromMBTI(muckBti);

  const locationPrefix = extractNeighborhood(addressText);

  let rawNearby: Restaurant[] = [];
  let isDemoMode = false;

  const kakaoApiKey = process.env.KAKAO_REST_API_KEY;
  if (kakaoApiKey && kakaoApiKey !== "your_kakao_rest_api_key_here") {
    try {
      const searchPromises = menuKeywords.map(async (keyword) => {
        const searchQuery = `${keyword}`; // locationPrefix 제거
        const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(searchQuery)}&x=${longitude}&y=${latitude}&radius=${radius}&size=10&category_group_code=FD6`;
        const response = await fetch(url, { headers: { Authorization: `KakaoAK ${kakaoApiKey}` } });
        const data: any = await response.json();
        if (data.documents && data.documents.length > 0) {
          return data.documents
            .filter((doc: any) => doc.category_group_code === "FD6")
            .map((doc: any) => ({
              name: doc.place_name,
              category: doc.category_name.replace(/^음식점\s*>\s*/, ""),
              distance_meters: parseInt(doc.distance) || Math.floor(Math.random() * radius),
              address: doc.road_address_name || doc.address_name,
              menu_preview: [doc.category_name.split(" > ").pop() || ""].filter(Boolean),
              kakao_url: doc.place_url,
              x: doc.x,
              y: doc.y
            }));
        }
        return [];
      });

      const merged = (await Promise.all(searchPromises)).flat();
      const seen = new Set<string>();
      rawNearby = merged.filter((r) => { if (seen.has(r.name)) return false; seen.add(r.name); return true; });
    } catch (e) { console.error("Kakao search error:", e); }
  }

 if (rawNearby.length === 0) {
  return res.status(404).json({ 
    error: "NO_RESTAURANTS_FOUND", 
    message: "주변에 조건에 맞는 식당을 찾지 못했어요. 반경을 넓히거나 다른 조건으로 시도해보세요." 
  });
}

  if (rawNearby.length === 0) return res.status(404).json({ error: "NO_RESTAURANTS_FOUND", message: "주변에 조건에 맞는 식당이 없습니다." });

  if (excludeNames && Array.isArray(excludeNames) && excludeNames.length > 0) {
    rawNearby = rawNearby.filter(r => !excludeNames.includes(r.name));
  }
  if (rawNearby.length === 0) return res.status(404).json({ error: "NO_RESTAURANTS_FOUND", message: "오늘 이미 추천된 식당 외에 더 보여드릴 곳이 없어요. 반경을 넓혀보세요." });

  // 점수 계산
  const scored = rawNearby.map((rest) => {
    let score = 0;
    if (yesterdayFood && yesterdayFood.trim().length > 0) {
      const keywords = yesterdayFood.replace(/[^가-힣a-zA-Z\s]/g, "").split(/\s+/);
      const matchesYesterday = keywords.some(kw => kw && (rest.name.includes(kw) || rest.category.includes(kw)));
      if (matchesYesterday) return { rest, score: -999 };
    }
    if (categoryOverride && Array.isArray(categoryOverride) && categoryOverride.length > 0) {
      const allowedKeywords = categoryOverride.flatMap((c: string) => CATEGORY_KEYWORD_MAP[c] || [c]);
      const catMatches = allowedKeywords.some(k => rest.category.includes(k));
      if (!catMatches) return { rest, score: -999 };
      score += 10;
    }
    if (muckBti.spicy >= 4) {
      if (["매운", "탕", "마라", "짬뽕", "찌개"].some(t => rest.category.includes(t))) score += 3;
    } else if (muckBti.spicy <= 2) {
      if (["샐러드", "브런치", "크림", "파스타", "우동"].some(t => rest.category.includes(t))) score += 3;
    }
    if (muckBti.fullness >= 4) {
      if (["갈비", "국밥", "고기", "삼겹살"].some(t => rest.category.includes(t))) score += 3;
    }
    // 고기 중심 (4~5)
if (muckBti.meatVeg >= 4) {
  if (["고기", "삼겹살", "갈비", "소고기", "돼지", "닭", "스테이크", "곱창"].some(t => rest.category.includes(t))) score += 3;
}
// 야채 중심 (1~2)
if (muckBti.meatVeg <= 2) {
  if (["샐러드", "샤브샤브", "채식", "브런치", "건강", "비빔밥"].some(t => rest.category.includes(t))) score += 3;
  if (["고기", "삼겹살", "갈비", "소고기", "곱창"].some(t => rest.category.includes(t))) score -= 2;
}

// 교체
const isBar = rest.category.includes("호프") || rest.category.includes("주점") || rest.category.includes("맥주") || rest.category.includes("술집");

// 술 선호도 낮으면 주점 완전 제외
if (muckBti.drink <= 2 && isBar) return { rest, score: -999 };

// 술 선호도 높으면 점수 보너스
if (muckBti.drink >= 4 && isBar) score += 2;

score += Math.max(0, (1000 - rest.distance_meters) / 1000);

if ((detectedMealType === "아침" || detectedMealType === "점심") && isBar) return { rest, score: -999 };
if (detectedMealType === "야식") {
  const isDaytimeOnly = rest.category.includes("브런치") || rest.category.includes("카페") || rest.category.includes("샐러드");
  if (isDaytimeOnly) return { rest, score: -999 };
  if (isBar) score += 2;
}
    return { rest, score };
  });

// 동점 구간에 랜덤 셔플 적용 (재검색 시 다른 결과)
  const requestSeed = Date.now(); // 매 요청마다 다른 시드
  const validScored = scored.filter(item => item.score > -100);
  
  // score 내림차순 정렬 후, 동점 그룹 내에서 랜덤 셔플
  validScored.sort((a, b) => {
    const diff = b.score - a.score;
    if (Math.abs(diff) < 0.5) {
      // 동점 범위면 랜덤하게 섞음
      const hashA = (a.rest.name.charCodeAt(0) * requestSeed) % 1000;
      const hashB = (b.rest.name.charCodeAt(0) * requestSeed) % 1000;
      return hashA - hashB;
    }
    return diff;
  });
  
const sortedCandidates = validScored;
  const extendedCandidates: typeof sortedCandidates = [];
  const usedCategories = new Set<string>();
  for (const item of sortedCandidates) {
    const mainCategory = item.rest.category.split(" > ")[0];
    if (!usedCategories.has(mainCategory) || extendedCandidates.length === 0) {
      extendedCandidates.push(item);
      usedCategories.add(mainCategory);
    }
    if (extendedCandidates.length === 12) break;
  }
  if (extendedCandidates.length < 12) {
    for (const item of sortedCandidates) {
      if (extendedCandidates.length === 12) break;
      if (!extendedCandidates.includes(item)) extendedCandidates.push(item);
    }
  }

  // ★ 네이버에 실제로 검색되는지 확인해서 폐업/미등록 걸러내기
  const existenceChecks = await Promise.all(
    extendedCandidates.map(async (item) => ({
      item,
      exists: await checkNaverExists(item.rest.name, item.rest.address)
    }))
  );
  const filteredAndSorted = existenceChecks
    .filter(({ exists }) => exists)
    .map(({ item }) => item)
    .slice(0, 5);


  // ★ 사진(네이버) + 영업시간/가격(Google) 매칭 로직
const naverClientId = process.env.NAVER_CLIENT_ID;
const naverClientSecret = process.env.NAVER_CLIENT_SECRET;
const naverMatchMap = new Map<string, { rating: number; photo_urls: string[]; hours: string | null; menu_items: string[]; menu_guess: string }>();
const topRestaurantsToMatch = filteredAndSorted.map(item => item.rest);
await Promise.all(
    topRestaurantsToMatch.map(async (rest) => {
let finalPhotoUrls: string[] = [];
let finalHours = "";
let finalMenuItems: string[] = [];

try {
  const googleDetails = await getGooglePlaceDetails(rest.name, rest.address);
  if (googleDetails) {
    finalHours = googleDetails.hours || "";
    finalMenuItems = googleDetails.menuItems || [];
  }

  if (naverClientId && naverClientSecret) {
    const categoryLeaf = rest.category.split(" > ").pop() || "";
    const topMenu = rest.menu_preview?.[0] || "";
    const imageQuery = topMenu ? `${rest.name} ${topMenu}` : `${rest.name} ${categoryLeaf}`;
    const imageUrl = `https://openapi.naver.com/v1/search/image.json?query=${encodeURIComponent(imageQuery)}&display=3&filter=large`;
    const imageRes = await fetch(imageUrl, {
      headers: {
        "X-Naver-Client-Id": naverClientId,
        "X-Naver-Client-Secret": naverClientSecret
      }
    });
    const imageData: any = await imageRes.json();
    if (imageData.items && imageData.items.length > 0) {
      const origin = `${req.protocol}://${req.get("host")}`;
      finalPhotoUrls = imageData.items.slice(0, 3).map((item: any) =>
        `${origin}/api/image-proxy?url=${encodeURIComponent(item.link)}`
      );
    }
  }

  if (finalPhotoUrls.length === 0) {
    const fallback = getCategoryFallbackImage(rest.category, rest.menu_preview);
    if (fallback) finalPhotoUrls = [fallback];
  }

  naverMatchMap.set(rest.name, {
    rating: getDeterministicRating(rest.name),
    photo_urls: finalPhotoUrls,
    hours: finalHours && finalHours.trim().length > 0 ? finalHours : null,
    menu_items: finalMenuItems,
    menu_guess: ""
  });

} catch (e) {
  console.error(`매칭 실패 (${rest.name}):`, e);
  const fallback = getCategoryFallbackImage(rest.category, rest.menu_preview || []);
  naverMatchMap.set(rest.name, {
    rating: 4.0,
    photo_urls: fallback ? [fallback] : [],
    hours: null,
    menu_items: [],
    menu_guess: ""
  });
}
    })
  );
  
  let curateResults: { name: string; recommended_menu: string; toss_comment: string; category: string; address: string }[] =
    filteredAndSorted.map(({ rest }) => {
                const categoryLeaf = rest.category.split(" > ").pop() || "";
          const topMenu = rest.menu_preview?.[0] || "";
          const imageQuery = topMenu
            ? `${rest.name} ${topMenu}`
            : `${rest.name} ${categoryLeaf}`;

      const realMenus = rest.menu_preview.filter(m => m.length >= 2 && m !== categoryLeaf && !m.includes(">") && !/^[가-힣]{1,2}$/.test(m));
      return {
        name: rest.name,
        recommended_menu: realMenus[0] || "",
        toss_comment: generateDynamicComment(rest, muckBti, detectedMealType),
        category: rest.category,
        address: rest.address
      };
    });

    const mergedRestaurants: RecommendedRestaurant[] = curateResults.map((cur) => {
    const original = rawNearby.find(r => r.name === cur.name);
    const naverMatch = naverMatchMap.get(cur.name) || { rating: null, photo_urls: [], hours: null, menu_items: [], menu_guess: "" };
    const finalAddress = cur.address || (original ? original.address : `${addressText || "지정 구역"} 인근`);
    const distM = original ? original.distance_meters : Math.floor(180 + Math.random() * 450);
    const walkMin = Math.max(1, Math.round(distM / 80));
    const commonFranchises = ["스타벅스", "써브웨이", "엽기떡볶이", "본죽", "굽네치킨", "홍콩반점", "가마치통닭"];
    const isFranchise = commonFranchises.some(f => cur.name.includes(f));
    const addressWords = finalAddress.split(" ");
    const regionWord = addressWords.find(w => w.endsWith("구") || w.endsWith("동")) || "";
    const queryForMap = regionWord ? `${regionWord} ${cur.name}`.trim() : cur.name;

    // 구글에서 가져오는 메뉴 금액 사용 
    const finalPriceRange = (naverMatch.menu_items || [])[0] || null;

return {
  name: cur.name,
  recommended_menu: cur.recommended_menu,
  menu_preview: original?.menu_preview || [],
  toss_comment: cur.toss_comment,
  distance_meters: distM,
  walk_min: walkMin,
  category: cur.category,
  address: finalAddress,
  kakao_url: `https://m.map.kakao.com/actions/searchView?q=${encodeURIComponent(queryForMap)}`,
naver_url: `nmap://place?lat=${original?.y || ""}&lng=${original?.x || ""}&name=${encodeURIComponent(cur.name)}&appname=com.mealbti.app`,
naver_web_url: `https://map.naver.com/p/search/${encodeURIComponent(queryForMap)}`,
  verified_photo_urls: naverMatch.photo_urls || [],
  business_hours: naverMatch.hours,
};
  });
  
  res.json({ restaurants: mergedRestaurants, meal_type: detectedMealType, location_source: req.body.location_source || "gps", address: addressText || "추천 반경 인근" });
});

async function startServer() {
  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: {
          server: httpServer,   // host/port 대신 이렇게
        },
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
  const distPath = path.join(process.cwd(), "dist");
  app.use(express.static(distPath));

  // OG 태그 동적 생성 - 공유 링크용
  app.get("*", async (req, res) => {
    const mbtiParam = req.query.mbti as string;
    const indexPath = path.join(distPath, "index.html");
    const fs = await import("fs");
    let html = fs.readFileSync(indexPath, "utf-8");

    if (mbtiParam) {
      const parts = mbtiParam.split(",");
      const spicy = parseInt(parts[0]) || 3;
      const health = parts[5] || "none";

      // 캐릭터명 간단 매칭
      const characterNames: Record<string, string> = {
        "loss": "가벼운 식단 관리형 🥗",
        "gain": "든든한 고단백 헬스형 🍗",
        "sugar": "속 편한 웰빙 건강족 🍵",
      };
      const spicyName = spicy >= 4 ? "화끈한 매콤 모험가 ⚡" : spicy <= 2 ? "달콤 브런치파 🥞" : "균형잡힌 미식가 🍚";
      const charName = characterNames[health] || spicyName;

      const ogTitle = `친구의 먹BTI는 [${charName}]!`;
      const ogDesc = `나는 어떤 먹BTI일까? 30초만에 나의 식성 캐릭터를 확인해보세요 👀`;
      const ogImage = `https://mealbti.onrender.com/appsintoss-logo.png`;

      html = html
        .replace(/<title>.*?<\/title>/, `<title>${ogTitle}</title>`)
        .replace(
          "</head>",
          `<meta property="og:title" content="${ogTitle}" />
<meta property="og:description" content="${ogDesc}" />
<meta property="og:image" content="${ogImage}" />
<meta property="og:url" content="https://mealbti.onrender.com/?mbti=${mbtiParam}" />
<meta property="og:type" content="website" />
<meta name="twitter:card" content="summary_large_image" />
</head>`
        );
    }

    res.send(html);
  });
}
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error(err);
  process.exit(1);
});