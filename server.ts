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

dotenv.config();
console.log("KAKAO KEY LOADED:", process.env.KAKAO_REST_API_KEY);
console.log("NAVER KEY LOADED:", !!process.env.NAVER_CLIENT_ID, !!process.env.NAVER_CLIENT_SECRET);
console.log("GEMINI KEY LOADED:", !!process.env.GEMINI_API_KEY); // ← 추가: 키 존재 여부 확인

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

app.use(express.json());

// ===================== Helpers =====================

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

function getMockRestaurants(lat: number, lon: number, maxRadiusM: number = 1000, regionAddress: string = ""): Restaurant[] {
  const hubs = [
    {
      name: "gangnam", centerLat: 37.4979, centerLon: 127.0276,
      templates: [
        { name: "땀땀 강남본점", category: "아시아음식 > 베트남요리", address: "서울 강남구 역삼동 817-31", menu_preview: ["소곱창 쌀국수", "숯불 직화 소고기 국수", "짜조"] },
        { name: "창고43 강남점", category: "한식 > 소고기구이", address: "서울 강남구 테헤란로 109", menu_preview: ["한우 설화등심", "창고 스페셜", "깍두기볶음밥"] },
        { name: "정돈 강남점", category: "일식 > 돈까스", address: "서울 강남구 역삼동 811-4", menu_preview: ["안심 돈카츠", "등심 돈카츠", "새우 카츠 세트"] },
        { name: "무월식탁 강남점", category: "한식 > 가정식", address: "서울 강남구 역삼동 812-15", menu_preview: ["한방바베큐보쌈", "간장새우덮밥", "낙지삼겹살덮밥"] },
        { name: "혜장국", category: "한식 > 국밥", address: "서울 서초구 반포대로30길 106", menu_preview: ["한우 육개장", "차돌 수육", "내장탕"] },
        { name: "샐러디 역삼점", category: "음식점 > 샐러드", address: "서울 강남구 테헤란로22길 15", menu_preview: ["칠리베이컨 웜볼", "우삼겹 웜랩", "시저치킨 샐러드"] },
        { name: "마라공방 강남역점", category: "중식 > 마라탕", address: "서울 강남구 테헤란로1길 10", menu_preview: ["마라탕", "마라샹궈", "꿔바로우"] },
        { name: "구스아일랜드 브루하우스", category: "술집 > 호프/맥주", address: "서울 강남구 역삼로 118", menu_preview: ["수제맥주", "구스 IPA", "바비큐 플래터"] },
        { name: "신선설농탕 서초점", category: "한식 > 설렁탕", address: "서울 서초구 반포동 748-1", menu_preview: ["설농탕", "도가니탕", "만두설농탕"] },
        { name: "슬로우파크", category: "카페/양식 > 브런치", address: "서울 서초구 방배중앙로 204", menu_preview: ["에그 베네딕트", "프렌치 토스트", "더치 베이비"] }
      ]
    },
    {
      name: "hongdae", centerLat: 37.5575, centerLon: 126.9244,
      templates: [
        { name: "소금집하우스 망원", category: "양식 > 샌드위치", address: "서울 마포구 월드컵로19길 14", menu_preview: ["잠봉뵈르 샌드위치", "피그앤피그", "수제 소시지"] },
        { name: "우동카덴", category: "일식 > 우동", address: "서울 마포구 양화로7길 4.5", menu_preview: ["청우동", "붓카케 우동", "텐토지 우동"] },
        { name: "을밀대 마포본점", category: "한식 > 평양냉면", address: "서울 마포구 숭문길 24", menu_preview: ["물냉면", "비빔냉면", "녹두전"] },
        { name: "하카타분코", category: "일식 > 라멘", address: "서울 마포구 독막로19길 43", menu_preview: ["인라멘", "청라멘", "차슈덮밥"] },
        { name: "합정옥", category: "한식 > 곰탕", address: "서울 마포구 양화로1길 21", menu_preview: ["곰탕", "속대국", "수육"] },
        { name: "이치류 홍대본점", category: "일식 > 양고기구이", address: "서울 마포구 잔다리로3안길 44", menu_preview: ["생살치살", "양갈비", "오뎅탕"] },
        { name: "마산달래아구찜", category: "한식 > 아구찜", address: "서울 마포구 어울마당로 143-1", menu_preview: ["아구찜", "해물탕", "볶음밥"] }
      ]
    },
    {
      name: "yeouido", centerLat: 37.5216, centerLon: 126.9242,
      templates: [
        { name: "진주집", category: "한식 > 국수", address: "서울 영등포구 국제금융로6길 33", menu_preview: ["냉콩국수", "닭칼국수", "접시만두"] },
        { name: "화목순대국 여의도점", category: "한식 > 순대국", address: "서울 영등포구 여의대방로 383", menu_preview: ["순대국밥", "내장탕", "머리고기"] },
        { name: "희정식당", category: "한식 > 부대찌개", address: "서울 영등포구 여의나루로 117", menu_preview: ["희정 부대찌개", "T본 스테이크", "모듬구이"] },
        { name: "미진 일식 여의도점", category: "일식 > 소바", address: "서울 영등포구 국제금융로2길 37", menu_preview: ["메밀소바", "초밥 정식", "돈까스"] },
        { name: "창고43 여의도강변점", category: "한식 > 소고기구이", address: "서울 영등포구 여의서로 43", menu_preview: ["창고 스페셜", "한우 등심", "깍두기볶음밥"] },
        { name: "바스버거 여의도점", category: "음식점 > 수제버거", address: "서울 영등포구 국제금융로2길 36", menu_preview: ["바스버거", "더블바스버거", "트러플칩스"] }
      ]
    },
    {
      name: "sinsa", centerLat: 37.5164, centerLon: 127.0205,
      templates: [
        { name: "한추", category: "술집 > 치킨/호프", address: "서울 강남구 논현로175길 68", menu_preview: ["고추튀김", "한추떡볶이", "후라이드치킨"] },
        { name: "신사전", category: "한식 > 요리주점", address: "서울 강남구 도산대로11길 18", menu_preview: ["치즈감자전", "모듬전", "벌집꿀막걸리"] },
        { name: "김북순큰남비집 신사본점", category: "한식 > 김치찌개", address: "서울 강남구 압구정로2길 15", menu_preview: ["목살김치찌개", "참치김치찌개", "초란뚝배기탕"] },
        { name: "은행골 신사점", category: "일식 > 초밥", address: "서울 강남구 강남대로152길 42", menu_preview: ["특상초밥", "특선초밥", "도로초밥"] },
        { name: "쮸즈 신사점", category: "중식 > 딤섬", address: "서울 강남구 도산대로17길 13", menu_preview: ["소룡포", "하가우", "탄탄면"] },
        { name: "레이브릭스", category: "카페/양식 > 브런치", address: "서울 강남구 도산대로15길 18", menu_preview: ["시나몬플랫화이트", "팬케이크", "아이스크림 크로플"] }
      ]
    },
    {
      name: "pangyo", centerLat: 37.3948, centerLon: 127.1111,
      templates: [
        { name: "스시쿤", category: "일식 > 오마카세", address: "경기 성남시 분당구 대왕판교로 660", menu_preview: ["런치 오마카세", "디너 스페셜", "모듬 사시미"] },
        { name: "낙생육가", category: "한식 > 삼겹살", address: "경기 성남시 분당구 판교역로 231", menu_preview: ["삼겹살 구이", "목살구이", "김치찌개찌개"] },
        { name: "동청담 판교본점", category: "중식 > 짜장면", address: "경기 성남시 분당구 판교역로 240", menu_preview: ["수제 유니짜장", "탕수육", "삼선짬뽕"] },
        { name: "커스텀샐러드 판교점", category: "음식점 > 샐러드", address: "경기 성남시 분당구 판교역로192번길 14", menu_preview: ["샐러디 웜볼", "아보카도 샐러드", "그릭요거트"] },
        { name: "평양면옥 분당점", category: "한식 > 평양냉면", address: "경기 성남시 분당구 지원로 3", menu_preview: ["평양식 물냉면", "평양만두", "제육"] }
      ]
    },
    {
      name: "haeundae", centerLat: 35.1631, centerLon: 129.1589,
      templates: [
        { name: "해운대 소문난암소갈비집", category: "한식 > 소고기구이", address: "부산 해운대구 중동2로10번길 32-10", menu_preview: ["생갈비", "양념갈비", "감자사리"] },
        { name: "금수복국 해운대본점", category: "한식 > 복어", address: "부산 해운대구 중동1로43번길 23", menu_preview: ["은복지리", "까치복국", "복튀김"] },
        { name: "해운대 가야밀면", category: "한식 > 밀면", address: "부산 해운대구 좌동순환로 27", menu_preview: ["물밀면", "비빔밀면", "고기만두"] },
        { name: "초량밀면 해운대점", category: "한식 > 밀면", address: "부산 해운대구 구남로 20", menu_preview: ["물밀면 대", "비빔밀면", "왕만두"] },
        { name: "해운대 원조할매국밥", category: "한식 > 국밥", address: "부산 해운대구 구남로21번길 27", menu_preview: ["소고기국밥", "따로국밥", "소고기국수"] },
        { name: "해운대 혜성막창집", category: "한식 > 곱창구이", address: "부산 해운대구 중동1로19번길 29", menu_preview: ["소막창구이", "대창구이", "곱창전골"] }
      ]
    }
  ];

  let bestHub = hubs[0];
  let minHubDist = Infinity;
  for (const h of hubs) {
    const dist = calculateHaversine(lat, lon, h.centerLat, h.centerLon);
    if (dist < minHubDist) { minHubDist = dist; bestHub = h; }
  }

  let selectedTemplates = bestHub.templates;

  if (minHubDist > 15000) {
    selectedTemplates = [
      { name: "본죽&비빔밥", category: "한식 > 죽/비빔밥", address: "중앙대로 352길", menu_preview: ["낙지김치죽", "단호박야채죽", "불고기비빔밥"] },
      { name: "써브웨이", category: "음식점 > 샌드위치", address: "중앙광장로 24", menu_preview: ["이탈리안 비엠티", "에그마요", "플랫브레드"] },
      { name: "홍콩반점0410", category: "중식 > 짜장면", address: "대학가 중앙로 18", menu_preview: ["짜장면", "짬뽕밥", "찹쌀탕수육"] },
      { name: "엽기떡볶이", category: "한식 > 분식", address: "맛거리시장 골목 12", menu_preview: ["동대문 엽기떡볶이", "엽기닭볶음탕", "튀김만두"] },
      { name: "굽네치킨", category: "음식점 > 치킨", address: "대로변길 8-2", menu_preview: ["오븐고추바사삭", "오리지널 치킨", "갈비천왕"] },
      { name: "스타벅스", category: "카페/양식 > 커피전문점", address: "중앙스퀘어빌딩 1층", menu_preview: ["아이스 카페 아메리카노", "돌체 콜드 브루", "블루베리 쿠키치즈케이크"] },
      { name: "청진동해장국", category: "한식 > 해장국", address: "전통시장 터길 9", menu_preview: ["뼈다귀해장국", "선지해장국", "우거지탕"] },
      { name: "가마치통닭", category: "음식점 > 치킨", address: "정성거리 36", menu_preview: ["가마치옛날통닭", "순살양념", "똥집튀김"] }
    ];
  }

  return selectedTemplates.map((t, idx) => {
    const angle = (idx * 2 * Math.PI) / selectedTemplates.length;
    const radiusInKm = (maxRadiusM / 1000) * (0.05 + (idx / selectedTemplates.length) * 0.85);
    const latOffset = (radiusInKm / 111.3) * Math.cos(angle);
    const lonOffset = (radiusInKm / (111.3 * Math.cos(lat * Math.PI / 180))) * Math.sin(angle);
    const rLat = lat + latOffset;
    const rLon = lon + lonOffset;
    const distM = Math.round(calculateHaversine(lat, lon, rLat, rLon));

    let baseRegion = "";
    if (regionAddress) {
      const words = regionAddress.replace(/\(.*?\)/g, "").replace("인근", "").trim().split(/\s+/);
      const filtered = words.filter(w =>
        w.endsWith("시") || w.endsWith("구") || w.endsWith("동") || w.endsWith("군") ||
        w.endsWith("구역") || w.endsWith("동가") || w.endsWith("읍") || w.endsWith("면") ||
        w.endsWith("특별시") || w.endsWith("광역시") || w.endsWith("도")
      );
      if (filtered.length > 0) baseRegion = filtered.slice(0, 3).join(" ");
    }
    if (!baseRegion || baseRegion.split(" ").length < 2) {
      if (lat > 37.0 && lat < 38.0 && lon > 126.5 && lon < 127.5) baseRegion = "서울 마포구 서교동";
      else if (lat > 35.0 && lat < 35.5 && lon > 129.0 && lon < 129.3) baseRegion = "부산 해운대구 우동";
      else baseRegion = "서울 강남구 역삼동";
    }

    const originalWords = t.address.split(" ");
    const suffixWords = originalWords.filter(w =>
      !w.endsWith("서울") && !w.endsWith("경기") && !w.endsWith("부산") && !w.endsWith("인천") &&
      !w.endsWith("대구") && !w.endsWith("대전") && !w.endsWith("광주") && !w.endsWith("제주") &&
      !w.endsWith("특별자치도") && !w.endsWith("광역시") && !w.endsWith("특별시") &&
      !w.endsWith("시") && !w.endsWith("구") && !w.endsWith("동") && !w.endsWith("군") && !w.endsWith("읍") && !w.endsWith("면")
    );
    const suffix = suffixWords.length > 0 ? suffixWords.join(" ") : `${12 + idx * 5}길`;
    const localizedAddress = `${baseRegion} ${suffix}`.replace(/\s+/g, " ");

    return {
      name: t.name,
      category: t.category,
      distance_meters: distM,
      address: localizedAddress,
      menu_preview: t.menu_preview,
      kakao_url: `https://map.kakao.com/link/search/${encodeURIComponent(t.name)}`,
      x: rLon.toString(),
      y: rLat.toString()
    };
  });
}

let aiClient: GoogleGenAI | null = null;
function getAi(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY is missing from environment secrets.");
    aiClient = new GoogleGenAI({ apiKey: key });
  }
  return aiClient;
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

interface Hotspot { name: string; lat: number; lon: number; address: string; }

const OFFLINE_HOTSPOTS: Hotspot[] = [
  { name: "gangnam", lat: 37.4979, lon: 127.0276, address: "서울시 강남구 역삼동 대남빌딩 인근" },
  { name: "hongdae", lat: 37.5575, lon: 126.9244, address: "서울특별시 마포구 서교동 홍대거리 인근" },
  { name: "yeouido", lat: 37.5216, lon: 126.9242, address: "서울특별시 영등포구 여의도동 여의도역 인근" },
  { name: "sinsa", lat: 37.5164, lon: 127.0205, address: "서울특별시 강남구 신사동 가로수길 인근" },
  { name: "pangyo", lat: 37.3948, lon: 127.1111, address: "경기도 성남시 분당구 삼평동 판교역 인근" },
  { name: "haeundae", lat: 35.1631, lon: 129.1589, address: "부산광역시 해운대구 우동 해운대역 인근" },
  { name: "seongsu", lat: 37.5446, lon: 127.0560, address: "서울특별시 성동구 성수동 성수역 인근" },
  { name: "seoul_station", lat: 37.5545, lon: 126.9708, address: "서울특별시 중구 봉래동 서울역 인근" },
  { name: "jeju", lat: 33.4996, lon: 126.5312, address: "제주특별자치도 제주시 이도동 인근" }
];

function findClosestOfflineHotspot(lat: number, lon: number): Hotspot {
  let closest = OFFLINE_HOTSPOTS[0];
  let minDistance = Infinity;
  for (const spot of OFFLINE_HOTSPOTS) {
    const dist = calculateHaversine(lat, lon, spot.lat, spot.lon);
    if (dist < minDistance) { minDistance = dist; closest = spot; }
  }
  return closest;
}

function findOfflineGeocode(query: string): { lat: number; lon: number; address: string } | null {
  const qClean = query.toLowerCase().replace(/\s+/g, "");
  if (qClean.includes("강남") || qClean.includes("역삼")) return { lat: 37.4979, lon: 127.0276, address: "서울시 강남구 역삼동 대남빌딩 인근" };
  if (qClean.includes("홍대") || qClean.includes("서교") || qClean.includes("망원") || qClean.includes("마포")) return { lat: 37.5575, lon: 126.9244, address: "서울특별시 마포구 서교동 홍대거리 인근" };
  if (qClean.includes("여의도") || qClean.includes("영등포")) return { lat: 37.5216, lon: 126.9242, address: "서울특별시 영등포구 여의도동 여의도역 인근" };
  if (qClean.includes("신사") || qClean.includes("압구정") || qClean.includes("가로수") || qClean.includes("논현")) return { lat: 37.5164, lon: 127.0205, address: "서울특별시 강남구 신사동 가로수길 인근" };
  if (qClean.includes("판교") || qClean.includes("분당") || qClean.includes("성남")) return { lat: 37.3948, lon: 127.1111, address: "경기도 성남시 분당구 삼평동 판교역 인근" };
  if (qClean.includes("해운대") || qClean.includes("부산")) return { lat: 35.1631, lon: 129.1589, address: "부산광역시 해운대구 우동 해운대역 인근" };
  if (qClean.includes("성수") || qClean.includes("성동")) return { lat: 37.5446, lon: 127.0560, address: "서울특별시 성동구 성수동 성수역 인근" };
  if (qClean.includes("서울역") || qClean.includes("종로") || qClean.includes("을지로") || qClean.includes("중구")) return { lat: 37.5545, lon: 126.9708, address: "서울특별시 중구 봉래동 서울역 인근" };
  if (qClean.includes("제주")) return { lat: 33.4996, lon: 126.5312, address: "제주특별자치도 제주시 이도동 인근" };
  if (qClean.includes("수원")) return { lat: 37.2635, lon: 127.0286, address: "경기도 수원시 팔달구 인계동 인근" };
  if (qClean.includes("인천")) return { lat: 37.4563, lon: 126.7052, address: "인천광역시 남동구 구월동 인근" };
  if (qClean.includes("대전")) return { lat: 36.3504, lon: 127.3845, address: "대전광역시 서구 둔산동 인근" };
  if (qClean.includes("대구")) return { lat: 35.8714, lon: 128.6014, address: "대구광역시 중구 동성로 인근" };
  if (qClean.includes("광주")) return { lat: 35.1595, lon: 126.8526, address: "광주광역시 서구 상무지구 인근" };
  if (qClean.includes("잠실") || qClean.includes("송파")) return { lat: 37.5133, lon: 127.1022, address: "서울특별시 송파구 잠실동 인근" };
  if (qClean.includes("이태원") || qClean.includes("용산") || qClean.includes("한남")) return { lat: 37.5345, lon: 126.9943, address: "서울특별시 용산구 이태원동 인근" };
  if (qClean.includes("신촌") || qClean.includes("이대")) return { lat: 37.5598, lon: 126.9385, address: "서울특별시 서대문구 신촌역 인근" };
  if (qClean.includes("서면") || qClean.includes("부산진")) return { lat: 35.1578, lon: 129.0591, address: "부산광역시 부산진구 서면역 인근" };
  return null;
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
  const { spicy, fullness, salty, speed, drink, health } = mbti;

  // ── 점수 구간 헬퍼 ──────────────────────────────────────────────
  const isHigh = (v: number) => v >= 4;
  const isLow  = (v: number) => v <= 2;
  const isMid  = (v: number) => v === 3;
  const score  = (v: number) => v; // 명시적 참조용

  // ── 메뉴 풀 정의 ────────────────────────────────────────────────
  const POOL = {
    // 매운맛
    spicyHigh:   ["마라탕", "마라샹궈", "불닭볶음면", "낙지볶음", "쭈꾸미볶음", "매운갈비찜", "닭발볶음", "순대볶음", "떡볶이", "탄탄면", "양꼬치", "짬뽕", "불닭", "매운해물탕", "오돌뼈볶음", "꼼장어볶음"],
    spicyMid:    ["제육볶음", "김치찌개", "부대찌개", "찜닭", "순대국", "육개장", "닭볶음탕", "감자탕", "뼈해장국", "오징어볶음", "낙지덮밥", "비빔냉면"],
    spicyLow:    ["칼국수", "설렁탕", "곰탕", "돈까스", "카츠", "초밥", "우동", "소바", "오므라이스", "함박스테이크", "크림파스타", "냉면", "백반", "연어덮밥", "샤브샤브"],

    // 포만감
    fullnessHigh: ["국밥", "감자탕", "뼈해장국", "한정식", "돼지국밥", "쌈밥", "육개장", "설렁탕", "갈비탕", "찜닭", "보쌈", "대구탕", "삼겹살", "항정살", "갈비구이", "순대국"],
    fullnessMid:  ["비빔밥", "제육볶음", "돈까스", "불고기", "우동", "냉면", "파스타", "초밥", "라멘", "볶음밥", "덮밥", "쌀국수"],
    fullnessLow:  ["샐러드", "포케", "유부초밥", "김밥", "샌드위치", "브런치", "토스트", "카페밥", "롤", "아보카도토스트", "월남쌈", "라이스페이퍼롤", "소바"],

    // 짠맛
    saltyHigh:   ["간장게장", "양념게장", "보쌈", "족발", "갈치조림", "고등어구이", "된장찌개", "순대국", "김치찌개", "굴전", "파전", "젓갈비빔밥", "멍게비빔밥", "문어숙회", "낙지볶음"],
    saltyMid:    ["삼겹살", "제육볶음", "불고기", "갈비", "치킨", "짜장면", "비빔밥", "냉면", "라멘", "파스타"],
    saltyLow:    ["샤브샤브", "백숙", "맑은탕", "두부찌개", "닭곰탕", "해물샤브", "월남쌈", "소바", "냉면", "연어", "포케", "쌀국수", "아보카도"],

    // 속도 (1=빠름, 5=느긋)
    speedFast:   ["김밥", "라멘", "분식", "국수", "우동", "돈부리", "제육덮밥", "순대국", "떡볶이", "편의점도시락", "핫도그", "치킨", "버거"],
    speedSlow:   ["오마카세", "코스요리", "파인다이닝", "이탈리안", "프렌치", "스시오마카세", "한정식", "와인바", "샤브샤브", "브런치카페", "이자카야", "철판요리"],

    // 음주
    drinkHigh:   ["파전", "해물파전", "보쌈", "족발", "치킨", "이자카야", "포차", "수육", "곱창", "막창", "삼겹살", "오돌뼈", "닭발", "간장게장", "회", "문어숙회"],
    drinkLow:    ["비빔밥", "국수", "샐러드", "포케", "브런치", "라멘", "우동", "냉면", "쌀국수", "덮밥", "샌드위치"],

    // 건강 목표별
    healthLoss:  ["샐러드", "포케", "두부", "샤브샤브", "연어덮밥", "훈제연어", "월남쌈", "채식뷔페", "나물정식", "비빔밥", "쌈밥", "쌀국수", "닭가슴살도시락", "그릭요거트볼"],
    healthGain:  ["소고기", "장어", "삼계탕", "스테이크", "닭갈비", "훠궈", "육회", "갈비탕", "닭볶음탕", "삼겹살", "제육볶음", "곱창", "오리구이", "단백질도시락", "항정살"],
    healthSugar: ["현미밥", "두부", "나물", "채소", "한정식", "사찰음식", "죽", "된장국", "샐러드", "해산물", "맑은국", "쌈밥", "생선구이", "두부조림", "나물비빔밥"],

    // 특수 카테고리
    korean:      ["한식", "비빔밥", "제육볶음", "김치찌개", "된장찌개", "불고기", "국밥", "갈비", "냉면", "쌈밥"],
    japanese:    ["일식", "초밥", "라멘", "우동", "돈까스", "카츠", "연어덮밥", "오마카세", "야키토리", "텐동"],
    chinese:     ["중식", "짜장면", "짬뽕", "탕수육", "볶음밥", "마파두부", "깐풍기", "마라탕", "양꼬치", "딤섬"],
    western:     ["양식", "파스타", "스테이크", "버거", "샌드위치", "리조또", "함박", "브런치", "피자", "수프"],
    asian:       ["쌀국수", "베트남", "태국", "팟타이", "반미", "월남쌈", "똠얌", "팟카파오", "나시고렝", "쌀국수"],
    grillMeat:   ["삼겹살", "갈비", "항정살", "목살", "쌈밥", "보쌈", "수육", "곱창", "막창", "양꼬치"],
    lightMeal:   ["브런치", "샐러드", "포케", "연어", "아보카도토스트", "크로플", "카페밥", "스무디볼", "그래놀라"],
  };

  // ── 배열 합치기 + 중복 제거 헬퍼 ───────────────────────────────
  const merge = (...arrays: string[][]): string[] =>
    Array.from(new Set(arrays.flat()));

  // ── 가중치 기반 선택 헬퍼 ───────────────────────────────────────
  // 높은 점수 축이 메뉴를 더 많이 기여하도록
  const weightedMerge = (entries: [string[], number][]): string[] => {
    const result: string[] = [];
    for (const [arr, weight] of entries) {
      const count = Math.round(arr.length * (weight / 10));
      result.push(...arr.slice(0, Math.max(count, 3)));
    }
    return Array.from(new Set(result));
  };

  // ── 1. 건강 목표 최우선 ──────────────────────────────────────────
  if (health === "loss") {
    if (isHigh(spicy)) return merge(POOL.healthLoss, POOL.spicyMid.slice(0, 4));
    if (isHigh(drink)) return merge(POOL.healthLoss, ["파전", "월남쌈", "해물샤브"]);
    return merge(POOL.healthLoss, POOL.saltyLow.slice(0, 5));
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

  // ── 2. 음주 극단 (drink 5) ───────────────────────────────────────
  if (score(drink) === 5) {
    if (isHigh(spicy) && isHigh(salty))
      return merge(["닭발", "곱창", "낙지볶음", "막창", "오돌뼈", "순대볶음"], POOL.drinkHigh.slice(0, 6));
    if (isHigh(spicy))
      return merge(["닭발", "곱창", "낙지볶음", "막창", "쭈꾸미볶음"], POOL.drinkHigh);
    if (isHigh(fullness))
      return merge(["삼겹살", "소갈비", "보쌈", "족발", "수육", "해물탕"], POOL.drinkHigh);
    if (isHigh(salty))
      return merge(["간장게장", "파전", "굴전", "회", "문어숙회", "멍게"], POOL.drinkHigh);
    return POOL.drinkHigh;
  }

  // ── 3. 음주 높음 (drink 4) ───────────────────────────────────────
  if (score(drink) === 4) {
    if (isHigh(spicy))
      return merge(["닭발", "낙지볶음", "쭈꾸미", "오돌뼈", "순대볶음"], POOL.drinkHigh.slice(0, 8));
    if (isHigh(fullness))
      return merge(["삼겹살", "항정살", "갈비", "보쌈"], POOL.drinkHigh.slice(0, 8));
    if (isLow(spicy))
      return merge(["이자카야", "파전", "보쌈", "회", "초밥"], POOL.drinkHigh.slice(0, 6));
    return merge(POOL.drinkHigh, POOL.saltyMid.slice(0, 4));
  }

  // ── 4. 매운맛 극단 ──────────────────────────────────────────────
  if (score(spicy) === 5) {
    return weightedMerge([
      [POOL.spicyHigh, 8],
      [isHigh(fullness) ? POOL.fullnessHigh : POOL.fullnessMid, 4],
      [isHigh(salty) ? POOL.saltyHigh : [], 3],
    ]);
  }

  if (score(spicy) === 4) {
    if (isHigh(fullness) && isHigh(salty))
      return merge(POOL.spicyHigh.slice(0, 6), ["순대국", "감자탕", "김치찌개", "된장찌개", "갈치조림"]);
    if (isHigh(fullness))
      return merge(POOL.spicyMid, POOL.spicyHigh.slice(0, 5));
    if (isHigh(salty))
      return merge(["짬뽕", "마라탕", "낙지볶음", "김치찌개", "갈치조림", "고등어조림"], POOL.spicyHigh.slice(0, 5));
    return merge(POOL.spicyHigh.slice(0, 10), POOL.spicyMid.slice(0, 5));
  }

  // ── 5. 순한맛 극단 ──────────────────────────────────────────────
  if (score(spicy) === 1) {
    if (isLow(fullness) && isLow(salty))
      return merge(["포케", "샐러드", "아보카도토스트", "소바", "유부초밥", "연어덮밥", "브런치"], POOL.spicyLow.slice(0, 5));
    if (isHigh(fullness))
      return merge(["설렁탕", "곰탕", "백반", "한정식", "돈까스", "함박스테이크", "우동", "칼국수"], POOL.spicyLow);
    if (isHigh(speed)) // 느긋
      return merge(["오마카세", "프렌치", "이탈리안", "한정식", "파인다이닝", "브런치카페"], POOL.spicyLow);
    return POOL.spicyLow;
  }

  if (score(spicy) === 2) {
    if (isHigh(fullness))
      return merge(["설렁탕", "곰탕", "갈비탕", "백반", "한정식", "돈까스", "우동", "칼국수"], POOL.spicyLow.slice(0, 6));
    if (isHigh(drink))
      return merge(["초밥", "이자카야", "파전", "보쌈", "냉면", "파스타"], POOL.spicyLow.slice(0, 6));
    return merge(POOL.spicyLow, POOL.saltyLow.slice(0, 4));
  }

  // ── 6. 포만감 극단 ──────────────────────────────────────────────
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
    if (isLow(speed)) // 빠름
      return merge(["김밥", "편의점도시락", "국수", "라멘", "우동", "돈부리", "덮밥"], POOL.fullnessLow);
    return merge(POOL.fullnessLow, POOL.lightMeal.slice(0, 5));
  }

  // ── 7. 짠맛 극단 ────────────────────────────────────────────────
  if (score(salty) === 5) {
    if (isHigh(drink))
      return merge(["간장게장", "양념게장", "굴전", "파전", "멍게", "성게비빔밥", "문어숙회", "회"], POOL.saltyHigh);
    return POOL.saltyHigh;
  }

  if (score(salty) === 4) {
    if (isHigh(spicy))
      return merge(["김치찌개", "된장찌개", "순대국", "갈치조림", "짬뽕", "낙지볶음", "고등어조림"], POOL.saltyHigh.slice(0, 6));
    return merge(POOL.saltyHigh.slice(0, 8), POOL.saltyMid.slice(0, 4));
  }

  if (score(salty) === 1) {
    if (isHigh(fullness))
      return merge(["샤브샤브", "백숙", "맑은탕", "두부찌개", "닭곰탕", "해물샤브"], POOL.saltyLow);
    return POOL.saltyLow;
  }

  if (score(salty) === 2) {
    return merge(POOL.saltyLow, ["닭백숙", "두부조림", "버섯전골", "맑은조개탕"]);
  }

  // ── 8. 속도 극단 (1=빠름, 5=느긋) ──────────────────────────────
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

  // ── 9. 중간값(3) 올중간 - 성향 합산으로 7가지 카테고리 분기 ─────
  const sum = spicy + fullness + salty + speed + drink;
  const categories = [
    POOL.korean,
    POOL.japanese,
    POOL.chinese,
    POOL.western,
    POOL.asian,
    POOL.grillMeat,
    POOL.lightMeal,
  ];

  // sum이 같더라도 개별 값 조합으로 추가 분기
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

  // ── 메뉴명 기반 섬세한 코멘트 풀 ──────────────────────────────────

  const menuComments: Record<string, string[]> = {
    "베트남": [
  `${mainMenu || "쌀국수"}의 맑고 깊은 육수와 라임향이 입 안을 상쾌하게 열어줘요`,
  "베트남 현지의 향긋한 허브 향이 코끝을 자극하는, 가볍지만 풍성한 한 끼예요",
  `${name}의 진한 육수베이스가 속을 따뜻하게 채워주면서도 가볍게 마무리돼요`
],
"이자카야": [
  `${mealType === "저녁" || mealType === "야식" ? "오늘 저녁" : "오늘"} 일본식 분위기에서 한 잔, ${name}의 안주 라인업이 기대돼요`,
  "야키토리 한 꼬치에 하이볼 한 잔, 오늘 피로를 이렇게 풀어보세요",
  `${mainMenu || "안주"} 한 접시와 함께하는 시간, 혼술도 분위기 있게 즐길 수 있어요`
],
"일본식주점": [
  "은은한 조명 아래 사케 한 잔과 정갈한 안주, 오늘 저녁의 완성이에요",
  `${name}의 섬세한 일식 안주가 오늘 밤을 특별하게 만들어줄 거예요`,
  "퇴근 후 이자카야 감성, 오늘 하루 수고한 자신에게 주는 선물이에요"
],
"동남아": [
  "동남아 특유의 향긋한 향신료 향이 일상에서 잠깐 여행을 떠나게 해줘요",
  `${mainMenu || "메인 메뉴"}의 이국적인 소스가 입맛을 새롭게 자극해줄 거예요`,
  "매콤하고 새콤한 동남아 풍미, 오늘 기분 전환이 필요한 날이에요"
],
"주점": [
  `${mealType === "저녁" || mealType === "야식" ? "오늘 저녁은" : "오늘은"} ${name}에서 좋은 안주와 함께 편하게 쉬어가요`,
  `${mainMenu || "안주"} 한 접시에 가볍게 한 잔, 오늘 이 조합이 딱이에요`,
  "맛있는 안주와 시원한 한 잔, 오늘 하루의 마무리를 여기서 해보세요"
],
    "쌀국수": [
      `${mainMenu}의 맑고 깊은 육수가 속을 따뜻하게 감싸줄 거예요`,
      "쌀국수 특유의 부드러운 면발과 향긋한 고수 향이 오늘 하루를 리셋시켜줄 거예요",
      "가볍지만 든든한 쌀국수 한 그릇, 오늘 오후를 버티게 해줄 에너지예요"
    ],
    "냉면": [
      "탱글탱글한 면발에 새콤달콤한 육수, 지금 이 계절에 딱 맞는 선택이에요",
      `${mainMenu} 한 그릇이면 더위도 피로도 한방에 날아가요`,
      "질 좋은 메밀 향이 코끝을 자극하는, 정직한 맛집이에요"
    ],
    "마라탕": [
      "얼얼하게 혀를 감싸는 마라 향, 오늘 스트레스를 불태울 준비 됐나요?",
      `${mainMenu}의 기름진 감칠맛과 화끈한 매운맛이 중독적으로 당기는 날이에요`,
      "한 숟가락 뜨는 순간 입 안 가득 퍼지는 마라 향, 오늘 여기가 맞아요"
    ],
    "삼겹살": [
      "불판 위에서 지글지글 익어가는 소리만으로도 배고파지는 곳이에요",
      `${mainMenu} 한 점에 쌈 한 장, 오늘 이 조합을 거부할 이유가 없어요`,
      "두툼하게 썬 고기와 김치의 조화, 오늘 저녁은 여기서 마음껏 드세요"
    ],
    "곱창": [
      "특유의 고소하고 진한 내장 향이 진짜 단골 맛집의 증거예요",
      `${mainMenu}의 쫄깃한 식감이 소주 한 잔을 절로 부르는 날이에요`,
      "어른들이 아는 진짜 맛, 한 점 씹을 때마다 깊은 감칠맛이 올라와요"
    ],
    "초밥": [
      "장인이 한 점씩 쥐어낸 샤리와 네타의 온도 차가 입 안에서 완성돼요",
      `${mainMenu}의 윤기 있는 밥알과 신선한 토핑이 오늘 특별한 한 끼를 만들어줄 거예요`,
      "군더더기 없이 정갈한 스시 한 점, 오늘만큼은 느긋하게 음미해보세요"
    ],
    "라멘": [
      "몇 시간 우려낸 진한 육수가 면발에 스며든 걸 한 입에 느껴보세요",
      `${mainMenu}의 농후한 돈코츠 향이 문 앞에서부터 발길을 붙잡아요`,
      "탱탱하게 삶아낸 면과 부드러운 차슈, 오늘 위로가 필요한 날이에요"
    ],
    "돈까스": [
      "겉은 바삭, 속은 촉촉한 커틀릿의 정석을 오늘 여기서 만나보세요",
      `${mainMenu}의 두꺼운 두께감이 한 입 베어 물면 육즙을 터뜨려줄 거예요`,
      "경양식 돈까스 특유의 소스와 함께라면 밥 한 공기 거뜬해요"
    ],
    "칼국수": [
      "직접 밀어낸 넓적한 면발에 진한 멸치 육수, 어머니 손맛이 그리운 날이에요",
      `${mainMenu} 한 그릇이면 속이 따끈하게 채워지는 느낌이에요`,
      "졸깃한 생면과 구수한 국물이 빈속을 포근하게 감싸줘요"
    ],
    "비빔밥": [
      "형형색색의 나물과 고슬고슬한 밥, 비벼 먹는 순간 맛의 하모니가 시작돼요",
      `${mainMenu}에 고추장 한 숟가락 넣고 쓱쓱 비비면 오늘 점심 끝이에요`,
      "신선한 채소와 참기름 향이 어우러진 한 그릇, 건강하게 충전하는 날이에요"
    ],
    "갈비": [
      "불 위에서 직화로 구워지는 갈비 향이 코끝을 자극하는 곳이에요",
      `${mainMenu}의 두툼한 살점이 뼈에서 떨어질 때의 쾌감, 오늘 여기서 느껴보세요`,
      "양념이 잘 밴 갈비 한 대, 오늘 수고한 자신에게 주는 선물이에요"
    ],
    "국밥": [
      "뜨끈한 국물 한 숟가락이면 어제 피로가 싹 풀리는 기적의 한 그릇이에요",
      `${mainMenu}의 묵직한 뼈 육수가 속을 든든하게 채워줄 거예요`,
      "새벽부터 우려낸 국물의 깊이, 한 끼가 이렇게 위로가 될 줄 몰랐을 거예요"
    ],
    "파스타": [
      "알덴테로 삶아낸 면에 소스가 윤기 있게 코팅된 비주얼부터 시작돼요",
      `${mainMenu}의 풍성한 소스가 입 안을 가득 채우는 이탈리안의 정수예요`,
      "오늘만큼은 서울 한복판에서 유럽 어딘가의 점심을 즐겨보세요"
    ],
    "브런치": [
      `${mainMenu}와 따뜻한 커피 한 잔, 오늘 아침만큼은 여유롭게 시작해보세요`,
      "예쁜 플레이팅에 담긴 브런치 한 상, 먹기 전에 사진 한 장은 필수예요",
      "에그 베네딕트의 흘러내리는 홀랜다이즈 소스가 오늘 아침을 특별하게 만들어줄 거예요"
    ],
    "샐러드": [
      "신선한 재료 본연의 맛을 살린 드레싱, 가볍지만 만족스러운 한 끼예요",
      `${mainMenu}의 알록달록한 색감이 입맛을 돋우고 영양도 챙겨줘요`,
      "오늘은 몸이 원하는 걸 먹는 날, 신선한 한 그릇으로 속을 깨끗하게 비워보세요"
    ],
    "족발": [
      "쫀득하게 삶아낸 껍데기와 부드러운 살점의 조화, 오늘 야식 고민 끝이에요",
      `${mainMenu}에 새우젓 한 점 곁들이면 소주 한 병이 순식간에 사라져요`,
      "콜라겐 듬뿍 함유된 족발, 맛있게 먹으면서 피부까지 챙기는 현명한 선택이에요"
    ],
    "보쌈": [
      "부드럽게 삶아낸 수육을 배추에 싸 먹는 그 순간, 진짜 한국 음식의 매력이에요",
      `${mainMenu}에 굴젓이나 새우젓을 얹으면 완성되는 조화, 어른들의 음식이에요`,
      "담백하게 삶은 돼지고기와 김치의 시원한 신맛, 오늘 이 맛이 생각날 거예요"
    ],
    "치킨": [
      "갓 튀겨낸 바삭한 껍데기를 베어 무는 순간의 행복, 오늘 여기서 느껴봐요",
      `${mainMenu}의 매콤달콤한 소스가 손가락을 절로 핥게 만드는 집이에요`,
      "황금빛으로 튀겨낸 치킨 한 마리, 오늘 수고한 자신에게 주는 작은 축제예요"
    ],
    "버거": [
      "두툼한 패티와 신선한 채소가 층층이 쌓인 비주얼, 한 입 크게 베어 물어야 해요",
      `${mainMenu}의 육즙이 터지는 순간, 다른 버거는 생각도 안 날 거예요`,
      "수제 패티의 고기 향과 갓 구운 번의 조화, 패스트푸드와는 차원이 달라요"
    ],
    "떡볶이": [
      "쫀득쫀득한 떡이 매콤달콤한 소스를 머금은 그 맛, 한국인의 소울푸드예요",
      `${mainMenu}의 빨간 국물에 어묵 국물 한 모금이면 오늘 한 끼가 완성돼요`,
      "매운 걸 좋아하는 사람이라면 이 집 떡볶이 소스에 반할 거예요"
    ],
    "짜장면": [
      "춘장의 구수한 향이 깊게 밴 소스와 탱탱한 면발, 중화요리의 정석이에요",
      `${mainMenu} 위에 달걀 프라이 하나 얹으면 이 이상의 점심은 없어요`,
      "면과 소스를 비벼 먹기 전 잠깐 비주얼 감상, 그게 또 재미예요"
    ],
    "짬뽕": [
      "얼큰하고 시원한 국물 한 숟가락이면 왜 이 집이 유명한지 바로 알게 돼요",
      `${mainMenu}의 풍성한 해물과 채소가 국물에 녹아든 깊은 맛이에요`,
      "빨간 국물 위에 떠 있는 해산물의 비주얼만으로도 입에 침이 고이는 집이에요"
    ],
    "오마카세": [
      "셰프의 선택을 믿고 앉아있으면 오늘 저녁이 특별해지는 경험이에요",
      `${mainMenu} 코스 한 편, 계절 식재료로 이야기를 풀어내는 맛의 여정이에요`,
      "한 접시 한 접시 설명을 들으며 먹는 시간, 오늘만큼은 시간을 사는 거예요"
    ],
    "곰탕": [
      "몇 날 며칠을 우려낸 뼈 국물의 깊이, 첫 숟가락에 그 정성이 느껴져요",
      `${mainMenu}에 소금 간 살짝 하면 완성되는 담백함, 이게 진짜 한식이에요`,
      "뽀얗게 우러난 국물과 부드러운 고기, 오늘 속이 비었다면 여기예요"
    ],
  };

  // 메뉴 키워드 매칭
  for (const [keyword, comments] of Object.entries(menuComments)) {
    const matched = menus.some(m => m.includes(keyword)) || cat.includes(keyword) || name.includes(keyword);
    if (matched) {
      return comments[Math.floor(Math.random() * comments.length)];
    }
  }

  // ── 카테고리 + 성향 복합 코멘트 (메뉴 키워드 미매칭 시) ──────────────

  // 아침/브런치 시간대
  if (mealType === "아침") {
    if (cat.includes("카페") || cat.includes("베이커리")) return `${name}의 갓 구운 빵 향과 커피 한 잔으로 오늘 하루를 시작해보세요`;
    if (cat.includes("한식")) return `${mainMenu || "따뜻한 국물"} 한 그릇으로 아침을 든든하게 채워보세요`;
    return `이른 아침, ${name}에서 조용하고 여유로운 한 끼로 하루를 열어보세요`;
  }

  // 야식 시간대
  if (mealType === "야식") {
    if (mbti.drink >= 4) return `${mainMenu || "안주"} 한 접시에 한 잔 걸치기 딱 좋은 밤이에요`;
    if (cat.includes("치킨")) return "야식의 왕, 치킨. 오늘 밤 자책 없이 즐겨도 돼요";
    return `늦은 밤 ${name}에서 오늘 하루의 마무리를 맛있게 해보세요`;
  }

  // 건강 목표별
  if (mbti.health === "loss") {
    if (cat.includes("한식") || cat.includes("가정식")) return `${mainMenu || "담백한 메뉴"}로 칼로리 걱정 없이 든든하게 한 끼 해결해요`;
    return `가볍고 깔끔하게, 오늘 식단 목표를 지켜가면서도 맛있는 한 끼예요`;
  }
  if (mbti.health === "gain") {
    return `${mainMenu || "고단백 메뉴"} 한 상으로 오늘 운동 후 영양을 빠르게 보충해보세요`;
  }
  if (mbti.health === "sugar") {
    return `정갈하고 자극 없는 ${name}의 한 상, 혈당 걱정 없이 맛있게 드세요`;
  }

  // 성향별 복합
  if (mbti.spicy >= 4 && mbti.fullness >= 4) {
    return `${name}에서 화끈하고 든든하게, 오늘 가장 확실한 한 끼예요`;
  }
  if (mbti.spicy >= 4) {
    return `${mainMenu || "매콤한 메뉴"}의 칼칼한 맛이 입 안을 깨우는 경험이에요`;
  }
  if (mbti.spicy <= 2 && mbti.salty <= 2) {
    return `자극 없이 재료 본연의 맛을 살린 ${name}, 오늘 속이 편해질 거예요`;
  }
  if (mbti.fullness >= 4) {
    return `${mainMenu || "메인 메뉴"} 한 상 앞에 앉으면 빈속 걱정은 끝이에요`;
  }
  if (mbti.drink >= 4 && mealType === "저녁") {
    return `${mainMenu || "메뉴"} 한 점에 가볍게 한 잔, 오늘 저녁 이 이상 필요 없어요`;
  }
 if (mbti.speed <= 2) {
  const speedComments = [
    `${name}에서 빠르게 해결하고 여유 시간을 만들어보세요`,
    `주문하면 금방 나오는 ${name}, 오늘 ${mealType} 고민 끝이에요`,
    `${mainMenu || catLeaf} 한 그릇, 빠르게 먹고 에너지 충전 완료예요`
  ];
  return speedComments[Math.floor(Math.random() * speedComments.length)];
}
if (mbti.speed >= 4) {
  return `${name}에서 서두르지 않고 음식 하나하나를 제대로 즐기는 시간이에요`;
}

  if (mbti.speed <= 2) {
    return `${name}에서 서두르지 않고 음식 하나하나를 제대로 즐기는 시간이에요`;
  }

  // 최종 fallback - 식당명 + 카테고리 활용
  const catLeaf = cat.split(" > ").pop() || "맛집";
  const fallbacks = [
    `${name}의 ${catLeaf}, 오늘 선택을 후회하지 않을 거예요`,
    `${mainMenu || catLeaf} 한 그릇으로 오늘 하루 충전 완료예요`,
    `${name}에서만 느낄 수 있는 그 맛, 오늘 직접 확인해보세요`,
    `${catLeaf} 중에서도 ${name}이 오늘 당신의 먹BTI에 딱 맞아요`,
  ];
  return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}

// ===================== Routes =====================

// ★ 이미지 프록시 엔드포인트 추가 - Naver 이미지 CORS 우회
app.get("/api/image-proxy", async (req, res) => {
  const url = req.query.url as string;
  if (!url) return res.status(400).send("url param required");

  // URL 유효성만 체크 (도메인 제한 제거)
  try { new URL(url); } catch { return res.status(400).send("invalid url"); }

  try {
    const response = await fetch(url, {
      headers: { "Referer": "https://search.naver.com/", "User-Agent": "Mozilla/5.0" }
    });
    if (!response.ok) return res.status(response.status).send("upstream error");
    const contentType = response.headers.get("content-type") || "image/jpeg";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400");
    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (e) {
    console.error("Image proxy error:", e);
    res.status(500).send("proxy error");
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
  const closestSpot = findClosestOfflineHotspot(latNum, lonNum);
  res.json({ address: closestSpot.address });
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

  const offlineMatch = findOfflineGeocode(query);
  if (offlineMatch) return res.json(offlineMatch);

  let hashVal = 0;
  for (let i = 0; i < query.length; i++) hashVal = query.charCodeAt(i) + ((hashVal << 5) - hashVal);
  const latDelta = ((Math.abs(hashVal) % 150) / 1000) - 0.075;
  const lonDelta = (((Math.abs(hashVal) >> 3) % 150) / 1000) - 0.075;
  res.json({ lat: parseFloat((37.5500 + latDelta).toFixed(5)), lon: parseFloat((126.9800 + lonDelta).toFixed(5)), address: `${query} (가까운 가상 미식구역)` });
});

app.post("/api/recommend", async (req, res) => {
  console.log("API /api/recommend called");
  const { muckBti, latitude, longitude, groupSize, yesterdayFood, searchRadiusM, addressText, excludeNames, categoryOverride } = req.body;

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
        const searchQuery = `${locationPrefix} ${keyword}`;
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
    isDemoMode = true;
    const allMocks = getMockRestaurants(latNum, lonNum, radius, addressText || "");
    rawNearby = allMocks.filter(r => r.distance_meters <= radius);
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
    if (muckBti.drink >= 4 && (rest.category.includes("주점") || rest.category.includes("맥주"))) score += 1;
    score += Math.max(0, (1000 - rest.distance_meters) / 1000);
    const isBar = rest.category.includes("호프") || rest.category.includes("주점") || rest.category.includes("맥주");
    if ((detectedMealType === "아침" || detectedMealType === "점심") && isBar) return { rest, score: -999 };
    if (detectedMealType === "야식" && isBar) score += 2;
    return { rest, score };
  });

  const sortedCandidates = scored.filter(item => item.score > -100).sort((a, b) => b.score - a.score);
  const filteredAndSorted: typeof sortedCandidates = [];
  const usedCategories = new Set<string>();
  for (const item of sortedCandidates) {
    const mainCategory = item.rest.category.split(" > ")[0];
    if (!usedCategories.has(mainCategory) || filteredAndSorted.length === 0) {
      filteredAndSorted.push(item);
      usedCategories.add(mainCategory);
    }
    if (filteredAndSorted.length === 3) break;
  }
  if (filteredAndSorted.length < 3) {
    for (const item of sortedCandidates) {
      if (filteredAndSorted.length === 3) break;
      if (!filteredAndSorted.includes(item)) filteredAndSorted.push(item);
    }
  }

  // ★ 타입 수정: menu_guess 포함
  const naverClientId = process.env.NAVER_CLIENT_ID;
  const naverClientSecret = process.env.NAVER_CLIENT_SECRET;
  const naverMatchMap = new Map<string, { rating: number; photo_url: string | null; menu_guess: string }>();
  const topRestaurantsToMatch = filteredAndSorted.map(item => item.rest);

  if (naverClientId && naverClientSecret) {
    await Promise.all(
      topRestaurantsToMatch.map(async (rest) => {
        try {
          // 1. 핵심 상호명 추출 (뒤에 붙은 'xx점', 'xx본점', '서울xx점' 등을 완전히 제거)
          const simplifiedName = rest.name
            .replace(/\s*([가-힣\w]+)?(점|지점|본점|사옥점|유통점)$/g, "")
            .trim();

          const nameToUse = simplifiedName || rest.name;

          // 행정동/구 추출 (예: "서울 영등포구 문래동" -> "문래동")
          const addressParts = rest.address.split(" ");
          const regionWord = addressParts.find(w => w.endsWith("동") || w.endsWith("가") || w.endsWith("구")) || "";

          // 시도해볼 검색어 배열 생성 (정교한 순서대로)
          const searchQueries = [
            nameToUse,                                  // 1순위: 깔끔한 핵심 상호명 (예: "혜화동돈까스극장")
            `${regionWord} ${nameToUse}`.trim(),        // 2순위: 동네이름 + 상호명 (예: "문래동 라이브볼")
            rest.name                                   // 3순위: 카카오 원본 풀네임 (Fallback)
          ];

          // 중복 검색어 제거
          const uniqueQueries = Array.from(new Set(searchQueries)).filter(Boolean);

          let finalLocalData: any = { items: [] };
          let usedQuery = "";

          // 성공할 때까지 순차적으로 네이버 API 호출
          for (const query of uniqueQueries) {
            const localUrl = `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(query)}&display=5`;
            const localRes = await fetch(localUrl, {
              headers: {
                "X-Naver-Client-Id": naverClientId,
                "X-Naver-Client-Secret": naverClientSecret
              }
            });
            const localData: any = await localRes.json();
            
            if (localData.items && localData.items.length > 0) {
              finalLocalData = localData;
              usedQuery = query;
              break; // 매칭 성공하면 반복문 탈출!
            }
          }

 // Local 매칭 성공 여부 로그
if (finalLocalData.items && finalLocalData.items.length > 0) {
  console.log(`[Naver Local] ${rest.name} 매칭 성공 (사용한 검색어: "${usedQuery}"):`, finalLocalData.items[0].title);
} else {
  console.log(`[Naver Local] ${rest.name} 매칭 실패, 이미지 검색은 별도 시도`);
}

// Local 성공 여부와 무관하게 Image 검색은 항상 시도
let photoUrl: string | null = null;
try {
  const imageQuery = (finalLocalData.items?.length > 0)
    ? finalLocalData.items[0].title.replace(/<\/?[^>]+(>|$)/g, "") + " 음식"
    : rest.name + " 맛집";

  const imageUrl = `https://openapi.naver.com/v1/search/image.json?query=${encodeURIComponent(imageQuery)}&display=5&filter=large`;
  const imageRes = await fetch(imageUrl, {
    headers: {
      "X-Naver-Client-Id": naverClientId,
      "X-Naver-Client-Secret": naverClientSecret
    }
  });
  const imageData: any = await imageRes.json();
  console.log(`[Naver Image] ${rest.name}:`, imageData.items?.[0]?.link || "이미지 없음");
  if (imageData.items && imageData.items.length > 0) {
    const pstaticItem = imageData.items.find((item: any) => 
      item.link.includes("pstatic.net") || item.link.includes("naver.net")
    );
    const bestItem = pstaticItem || imageData.items[0];
    photoUrl = `/api/image-proxy?url=${encodeURIComponent(bestItem.link)}`;
  }
} catch (imgErr) {
  console.error(`Naver Image search failed for ${rest.name}:`, imgErr);
}

// 항상 Map에 저장
naverMatchMap.set(rest.name, {
  rating: getDeterministicRating(rest.name),
  photo_url: photoUrl,
  menu_guess: finalLocalData.items?.[0]?.category?.split(">").pop()?.trim() || ""
});
      } catch (e) {
        console.error(`Naver match failed for ${rest.name}:`, e);
      }
    })
  );
}
  
  let curateResults: { name: string; recommended_menu: string; toss_comment: string; category: string; address: string }[] =
    filteredAndSorted.map(({ rest }) => {
      const categoryLeaf = rest.category.split(" > ").pop() || "";
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
    const naverMatch = naverMatchMap.get(cur.name) || { rating: null, photo_url: null, menu_guess: "" };
    const finalAddress = cur.address || (original ? original.address : `${addressText || "지정 구역"} 인근`);
    const distM = original ? original.distance_meters : Math.floor(180 + Math.random() * 450);
    const walkMin = Math.max(1, Math.round(distM / 80));
    const commonFranchises = ["스타벅스", "써브웨이", "엽기떡볶이", "본죽", "굽네치킨", "홍콩반점", "가마치통닭"];
    const isFranchise = commonFranchises.some(f => cur.name.includes(f));
    const addressWords = finalAddress.split(" ");
    const regionWord = addressWords.find(w => w.endsWith("구") || w.endsWith("동")) || "";
    const queryForMap = (isFranchise && regionWord) ? `${regionWord} ${cur.name}`.trim() : cur.name;

    return {
      name: cur.name,
      recommended_menu: cur.recommended_menu,
      toss_comment: cur.toss_comment,
      distance_meters: distM,
      walk_min: walkMin,
      category: cur.category,
      address: finalAddress,
      kakao_url: `https://map.kakao.com/link/search/${encodeURIComponent(queryForMap)}`,
      naver_url: `https://map.naver.com/v5/search/${encodeURIComponent(queryForMap)}`,
      verified_photo_url: naverMatch.photo_url,
      verified_rating: naverMatch.rating || getDeterministicRating(cur.name)
    };
  });

  res.json({ restaurants: mergedRestaurants, meal_type: detectedMealType, location_source: req.body.location_source || "gps", address: addressText || "추천 반경 인근" });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
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
      const spicyName = spicy >= 4 ? "화끈한 매콤 모험가 🌶️" : spicy <= 2 ? "달콤 브런치파 🥞" : "균형잡힌 미식가 🍚";
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

startServer();