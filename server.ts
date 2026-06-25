/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";
import { Restaurant, RecommendedRestaurant, RecommendationResponse, MuckBti } from "./src/types";

dotenv.config();
console.log("KAKAO KEY LOADED:", process.env.KAKAO_REST_API_KEY);
console.log("NAVER KEY LOADED:", !!process.env.NAVER_CLIENT_ID, !!process.env.NAVER_CLIENT_SECRET);

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
    aiClient = new GoogleGenAI({ apiKey: key, httpOptions: { headers: { "User-Agent": "aistudio-build" } } });
  }
  return aiClient;
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
  if (qClean.includes("강남") || qClean.includes("역삼") || qClean.includes("대남빌딩")) return { lat: 37.4979, lon: 127.0276, address: "서울시 강남구 역삼동 대남빌딩 인근" };
  if (qClean.includes("홍대") || qClean.includes("서교") || qClean.includes("망원") || qClean.includes("마포") || qClean.includes("소금집")) return { lat: 37.5575, lon: 126.9244, address: "서울특별시 마포구 서교동 홍대거리 인근" };
  if (qClean.includes("여의도") || qClean.includes("영등포") || qClean.includes("여의") || qClean.includes("화목")) return { lat: 37.5216, lon: 126.9242, address: "서울특별시 영등포구 여의도동 여의도역 인근" };
  if (qClean.includes("신사") || qClean.includes("압구정") || qClean.includes("가로수") || qClean.includes("논현")) return { lat: 37.5164, lon: 127.0205, address: "서울특별시 강남구 신사동 가로수길 인근" };
  if (qClean.includes("판교") || qClean.includes("분당") || qClean.includes("성남") || qClean.includes("삼평") || qClean.includes("서현") || qClean.includes("야탑")) return { lat: 37.3948, lon: 127.1111, address: "경기도 성남시 분당구 삼평동 판교역 인근" };
  if (qClean.includes("해운대") || qClean.includes("부산") || qClean.includes("수영") || qClean.includes("우동") || qClean.includes("광안리")) return { lat: 35.1631, lon: 129.1589, address: "부산광역시 해운대구 우동 해운대역 인근" };
  if (qClean.includes("성수") || qClean.includes("성동") || qClean.includes("뚝섬") || qClean.includes("서울숲")) return { lat: 37.5446, lon: 127.0560, address: "서울특별시 성동구 성수동 성수역 인근" };
  if (qClean.includes("서울역") || qClean.includes("종로") || qClean.includes("을지로") || qClean.includes("중구") || qClean.includes("봉래동")) return { lat: 37.5545, lon: 126.9708, address: "서울특별시 중구 봉래동 서울역 인근" };
  if (qClean.includes("제주") || qClean.includes("서귀포") || qClean.includes("이도동")) return { lat: 33.4996, lon: 126.5312, address: "제주특별자치도 제주시 이도동 인근" };
  if (qClean.includes("수원") || qClean.includes("인계") || qClean.includes("행궁") || qClean.includes("팔달")) return { lat: 37.2635, lon: 127.0286, address: "경기도 수원시 팔달구 인계동 인근" };
  if (qClean.includes("인천") || qClean.includes("송도") || qClean.includes("구월") || qClean.includes("부평")) return { lat: 37.4563, lon: 126.7052, address: "인천광역시 남동구 구월동 인근" };
  if (qClean.includes("대전") || qClean.includes("둔산") || qClean.includes("유성")) return { lat: 36.3504, lon: 127.3845, address: "대전광역시 서구 둔산동 인근" };
  if (qClean.includes("대구") || qClean.includes("동성로") || qClean.includes("수성")) return { lat: 35.8714, lon: 128.6014, address: "대구광역시 중구 동성로 인근" };
  if (qClean.includes("광주") || qClean.includes("상무") || qClean.includes("충장")) return { lat: 35.1595, lon: 126.8526, address: "광주광역시 서구 상무지구 인근" };
  if (qClean.includes("속초") || qClean.includes("강릉") || qClean.includes("춘천") || qClean.includes("강원")) return { lat: 37.8228, lon: 128.1555, address: "강원특별자치도 속초시 중앙동 인근" };
  if (qClean.includes("일산") || qClean.includes("고양")) return { lat: 37.6583, lon: 126.8320, address: "경기도 고양시 일산동구 인근" };
  if (qClean.includes("잠실") || qClean.includes("송파") || qClean.includes("롯데타워") || qClean.includes("잠실새내")) return { lat: 37.5133, lon: 127.1022, address: "서울특별시 송파구 잠실동 인근" };
  if (qClean.includes("이태원") || qClean.includes("용산") || qClean.includes("한남")) return { lat: 37.5345, lon: 126.9943, address: "서울특별시 용산구 이태원동 인근" };
  if (qClean.includes("신촌") || qClean.includes("이대") || qClean.includes("서대문")) return { lat: 37.5598, lon: 126.9385, address: "서울특별시 서대문구 신촌역 인근" };
  if (qClean.includes("혜화") || qClean.includes("대학로") || qClean.includes("성균관")) return { lat: 37.5822, lon: 127.0018, address: "서울특별시 종로구 혜화역 대학로 인근" };
  if (qClean.includes("서면") || qClean.includes("영도") || qClean.includes("동래") || qClean.includes("부산진")) return { lat: 35.1578, lon: 129.0591, address: "부산광역시 부산진구 서면역 인근" };
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
  "멕시칸": ["멕시칸", "타코", "브리또", "퀘사디아", "나초"],
  "아시안": ["베트남", "태국", "쌀국수", "팟타이", "아시안", "월남쌈", "포케", "반미", "팟카파오", "똠얌"]
};

function getMenuKeywordsFromMBTI(mbti: MuckBti): string[] {
  if (mbti.health === "loss") return ["샐러드", "포케", "샤브샤브", "두부", "닭가슴살", "비빔밥", "쌈밥", "월남쌈", "쌀국수", "회", "채식", "베트남", "태국", "훈제연어", "해산물", "나물정식"];
  if (mbti.health === "gain") return ["소고기", "장어", "삼계탕", "스테이크", "닭갈비", "훠궈", "육회", "곱창", "갈비탕", "단백질", "헬스도시락", "닭볶음탕"];
  if (mbti.health === "sugar") return ["현미밥", "두부", "나물", "채소", "저당", "한정식", "사찰음식", "죽", "된장국", "샐러드", "해산물", "맑은국"];

  if (mbti.spicy >= 4 && mbti.fullness >= 4) return ["마라탕", "불닭", "낙지볶음", "쭈꾸미", "매운갈비찜", "화끈한찌개", "떡볶이", "닭발", "순대국", "감자탕"];
  if (mbti.spicy >= 4) return ["마라탕", "짬뽕", "쭈꾸미", "낙지볶음", "불닭", "떡볶이", "에티오피아", "마라샹궈", "탄탄면", "양꼬치"];
  if (mbti.spicy <= 2 && mbti.fullness <= 2) return ["샌드위치", "브런치", "크림파스타", "오므라이스", "우동", "소바", "연어덮밥", "카페밥", "토스트", "롤"];
  if (mbti.spicy <= 2) return ["칼국수", "돈까스", "초밥", "백반", "크림파스타", "우동", "오므라이스", "함박스테이크", "카츠", "소바"];

  if (mbti.salty >= 4 && mbti.drink >= 4) return ["족발", "간장게장", "보쌈", "감자탕", "순대국", "곱창", "막창", "안주", "파전", "해물탕"];
  if (mbti.salty >= 4) return ["족발", "간장게장", "보쌈", "감자탕", "된장찌개", "순대국", "짬뽕", "김치찌개", "갈치조림", "고등어구이"];
  if (mbti.salty <= 2 && mbti.fullness <= 2) return ["샤브샤브", "월남쌈", "쌀국수", "연어", "두부", "소바", "냉면", "유부초밥", "아보카도", "포케"];
  if (mbti.salty <= 2) return ["샤브샤브", "백숙", "맑은탕", "월남쌈", "쌀국수", "연어", "일식", "냉면", "비빔밥", "닭백숙"];

  if (mbti.fullness >= 4 && mbti.drink >= 4) return ["삼겹살", "곱창", "양꼬치", "막창", "소갈비", "해물탕", "보쌈", "족발", "닭갈비", "수육"];
  if (mbti.fullness >= 4) return ["국밥", "감자탕", "한정식", "뷔페", "돼지국밥", "쌈밥", "육개장", "설렁탕", "갈비탕", "찜닭"];
  if (mbti.fullness <= 2) return ["김밥", "샌드위치", "브런치", "토스트", "카페밥", "덮밥", "유부초밥", "롤", "비빔밥", "포케"];

  if (mbti.drink >= 4 && mbti.speed >= 4) return ["치킨", "피자", "파전", "곱창", "막창", "안주", "포차", "이자카야", "닭발", "오돌뼈"];
  if (mbti.drink >= 4) return ["파전", "해물", "보쌈", "치킨", "이자카야", "포차", "곱창", "삼겹살", "수육", "막걸리"];

  if (mbti.speed <= 2 && mbti.fullness >= 3) return ["오마카세", "코스요리", "한정식", "파인다이닝", "이탈리안", "프렌치", "일식코스", "스시오마카세"];
  if (mbti.speed <= 2) return ["브런치카페", "비스트로", "이탈리안", "파인다이닝", "한정식", "퓨전", "일식", "와인바"];
  if (mbti.speed >= 4) return ["분식", "김밥", "라멘", "덮밥", "패스트푸드", "편의점도시락", "국수", "우동", "솥밥", "돈부리"];

  return ["한식", "파스타", "국밥", "초밥", "버거", "쌀국수", "비빔밥", "카레", "태국음식", "중식"];
}

function generateDynamicComment(rest: { category: string }, mbti: MuckBti, mealType: string): string {
  const cat = rest.category || "";
  const candidates: string[] = [];

  if (mbti.health === "loss" && (cat.includes("샐러드") || cat.includes("베트남") || cat.includes("두부")))
    candidates.push("가볍고 깔끔하게, 몸도 기분도 리셋되는 한 끼예요 🥗");
  if (mbti.health === "gain" && (cat.includes("고기") || cat.includes("갈비") || cat.includes("단백")))
    candidates.push("오늘 운동 보상은 여기서, 든든한 단백질 충전소예요 💪");
  if (mbti.spicy >= 4 && (cat.includes("마라") || cat.includes("매운") || cat.includes("낙지")))
    candidates.push("얼얼하게 번지는 매운맛으로 하루 스트레스 날려버리세요 🌶️");
  if (mbti.spicy <= 2 && (cat.includes("브런치") || cat.includes("카페") || cat.includes("양식")))
    candidates.push("자극 없이 부드럽게, 오늘 입맛에 딱 맞는 선택이에요 ☕");
  if (mbti.fullness >= 4 && (cat.includes("국밥") || cat.includes("갈비") || cat.includes("찜")))
    candidates.push("든든하게 속을 채워줄 오늘의 최선이에요. 배부르게 드세요 🍲");
  if (mbti.salty >= 4 && (cat.includes("족발") || cat.includes("찌개") || cat.includes("장")))
    candidates.push("짭짤하고 깊은 감칠맛, 오늘 그 한입이 딱 당기실 거예요 🧂");
  if (mbti.salty <= 2 && (cat.includes("샤브") || cat.includes("두부") || cat.includes("맑은")))
    candidates.push("자극 없이 깔끔하게, 담백한 한 끼로 속을 편하게 해보세요 🍵");
  if (mbti.drink >= 4 && mealType === "저녁" && (cat.includes("주점") || cat.includes("안주") || cat.includes("포차")))
    candidates.push("반주 한 잔 곁들이기 딱 좋은 안주 라인업이에요 🍺");
  if (mbti.speed >= 4 && (cat.includes("분식") || cat.includes("패스트") || cat.includes("버거")))
    candidates.push("빠르게 먹고 빠르게 충전, 오늘 여기서 해결하세요 ⚡");
  if (mbti.speed <= 2 && (cat.includes("코스") || cat.includes("오마카세") || cat.includes("파인")))
    candidates.push("여유롭게 즐기는 한 상, 오늘은 천천히 음미해보세요 🕊️");

  // 카테고리 기반 보편 코멘트도 후보로 추가 (성향 매칭이 없을 때 대비)
  if (cat.includes("브런치") || cat.includes("카페")) candidates.push("공간까지 맛있는 곳, 여유로운 한 끼 즐겨보세요 ✨");
  if (cat.includes("한식")) candidates.push("오늘 같은 날엔 역시 집밥 같은 한식이 최고예요 🍚");
  if (cat.includes("일식")) candidates.push("정갈하고 섬세한 일식으로 기분 좋게 채워보세요 🍣");
  if (cat.includes("중식")) candidates.push("풍성한 중식 한 상으로 오늘도 힘차게 달려보세요 🥢");
  if (cat.includes("양식")) candidates.push("오늘은 조금 특별하게, 양식으로 기분 전환 어때요 🍝");
  if (cat.includes("치킨")) candidates.push("바삭하고 든든한 한 끼, 오늘 기분 업 시켜줄 거예요 🍗");

  if (candidates.length === 0) return `먹BTI 성향과 잘 맞는 ${cat.split(" > ").pop()} 맛집이에요 ✨`;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

// ===================== Routes =====================

app.post("/api/reverse-geocode", async (req, res) => {
  const { latitude, longitude } = req.body;
  if (!latitude || !longitude) {
    return res.status(400).json({ error: "Missing coordinates latitude/longitude" });
  }
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
    } catch (e) {
      console.error("Kakao address conversion API error:", e);
    }
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
      const geoKey = `${item.lat.toFixed(5)}_${item.lon.toFixed(5)}`;
      const nameKey = `${item.place_name}_${item.address_name}`;
      if (!seen.has(geoKey) && !seen.has(nameKey)) {
        seen.add(geoKey); seen.add(nameKey); items.push(item);
      }
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
    } catch (e) {
      console.error("Kakao Address Geocode error:", e);
    }
    try {
      const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=1`;
      const response = await fetch(url, { headers: { Authorization: `KakaoAK ${apiKey}` } });
      const data: any = await response.json();
      if (data.documents && data.documents.length > 0) {
        const doc = data.documents[0];
        return res.json({ lat: parseFloat(doc.y), lon: parseFloat(doc.x), address: doc.place_name + " (" + doc.address_name + ")" });
      }
    } catch (e) {
      console.error("Kakao Keyword Geocode error:", e);
    }
  }

  const offlineMatch = findOfflineGeocode(query);
  if (offlineMatch) return res.json(offlineMatch);

  if (process.env.GEMINI_API_KEY) {
    try {
      const ai = getAi();
      const systemPrompt = `너는 아주 똑똑한 한국 지리 및 행정구역 공간 정보 검색 엔진이다.
유저가 입력한 한국 내 행정지명, 명소, 지하철역, 도로명 등의 주소 검색어('${query}')에 속한 실제 지리적 위경도 정보와 가장 가깝고 정리된 표준 정규 지번/도로명 주소를 분석하여 반환하라.

반드시 JSON 형식만 출력해야 하며, 응답 앞뒤에 마크다운 백틱(\`\`\`json)을 절대 넣지 마라.

[출력 데이터 예시]
{
  "lat": 37.5575,
  "lon": 126.9244,
  "address": "서울특별시 마포구 서교동 홍대거리 인근"
}`;
      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: `검색어: ${query}`,
        config: { systemInstruction: systemPrompt, temperature: 0.1, responseMimeType: "application/json" }
      });
      const responseText = response.text;
      if (responseText) {
        let cleaned = responseText.trim();
        if (cleaned.startsWith("```")) cleaned = cleaned.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
        const parsed = JSON.parse(cleaned);
        if (parsed.lat && parsed.lon && parsed.address) {
          return res.json({ lat: parseFloat(parsed.lat), lon: parseFloat(parsed.lon), address: parsed.address });
        }
      }
    } catch (e: any) {
      const isRateLimit = e?.message?.includes("429") || e?.status === "RESOURCE_EXHAUSTED" || JSON.stringify(e).includes("Quota exceeded");
      console.log(isRateLimit ? "[Info] Gemini Geocoding rate-limited (429)." : "[Info] Gemini Geocoding API failed:", e?.message || e);
    }
  }

  let hashVal = 0;
  for (let i = 0; i < query.length; i++) hashVal = query.charCodeAt(i) + ((hashVal << 5) - hashVal);
  const latDelta = ((Math.abs(hashVal) % 150) / 1000) - 0.075;
  const lonDelta = (((Math.abs(hashVal) >> 3) % 150) / 1000) - 0.075;
  const solvedLat = 37.5500 + latDelta;
  const solvedLon = 126.9800 + lonDelta;

  res.json({
    lat: parseFloat(solvedLat.toFixed(5)),
    lon: parseFloat(solvedLon.toFixed(5)),
    address: `${query} (가까운 가상 미식구역)`
  });
});

app.post("/api/recommend", async (req, res) => {
  console.log("API /api/recommend called");
  const {
    muckBti, latitude, longitude, groupSize, yesterdayFood,
    searchRadiusM, addressText, excludeNames, categoryOverride
  } = req.body;

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
      rawNearby = merged.filter((r) => {
        if (seen.has(r.name)) return false;
        seen.add(r.name);
        return true;
      });
    } catch (e) {
      console.error("Kakao Keyword Search API error:", e);
    }
  }

  if (rawNearby.length === 0) {
    isDemoMode = true;
    const allMocks = getMockRestaurants(latNum, lonNum, radius, addressText || "");
    rawNearby = allMocks.filter(r => r.distance_meters <= radius);
  }

  if (rawNearby.length === 0) {
    return res.status(404).json({ error: "NO_RESTAURANTS_FOUND", message: "주변에 조건에 맞는 식당이 없습니다." });
  }

  if (excludeNames && Array.isArray(excludeNames) && excludeNames.length > 0) {
    rawNearby = rawNearby.filter(r => !excludeNames.includes(r.name));
  }

  if (rawNearby.length === 0) {
    return res.status(404).json({ error: "NO_RESTAURANTS_FOUND", message: "오늘 이미 추천된 식당 외에 더 보여드릴 곳이 없어요. 반경을 넓혀보세요." });
  }

// 1. 먼저 점수 계산
const scored = rawNearby.map((rest) => {
  let score = 0;

  if (yesterdayFood && yesterdayFood.trim().length > 0) {
    const keywords = yesterdayFood.replace(/[^가-힣a-zA-Z\s]/g, "").split(/\s+/);
    const foodSynonyms: Record<string, string[]> = {
      "돈까스": ["돈까스", "돈카츠", "경양식", "커틀릿"],
      "초밥": ["초밥", "스시", "오마카세"],
      "삼겹살": ["삼겹살", "돼지구이", "고기집"],
      "치킨": ["치킨", "닭", "프라이드"],
      "피자": ["피자", "이탈리안"],
      "라멘": ["라멘", "라면", "일식면"]
    };
    const expandedKeywords = keywords.flatMap(kw => foodSynonyms[kw] || [kw]);
    const matchesYesterday = expandedKeywords.some(kw =>
      kw && (rest.name.includes(kw) || rest.category.includes(kw) || rest.menu_preview.some(m => m.includes(kw)))
    );
    if (matchesYesterday) return { rest, score: -999 };
  }

  if (categoryOverride && Array.isArray(categoryOverride) && categoryOverride.length > 0) {
    const allowedKeywords = categoryOverride.flatMap((c: string) => CATEGORY_KEYWORD_MAP[c] || [c]);
    const catMatches = allowedKeywords.some(k => rest.category.includes(k));
    if (!catMatches) return { rest, score: -999 };
    score += 10;
  }

  const previews = rest.menu_preview;

  if (muckBti.spicy >= 4) {
    const triggers = ["매운", "매콤", "불", "닭발", "낙지", "탕", "마라", "얼큰", "짬뽕", "찌개"];
    if (previews.some(m => triggers.some(t => m.includes(t))) || triggers.some(t => rest.category.includes(t))) score += 3;
  } else if (muckBti.spicy <= 2) {
    const triggers = ["샐러드", "냉면", "순두부", "돈까스", "스시", "브런치", "크림", "파스타"];
    if (previews.some(m => triggers.some(t => m.includes(t))) || triggers.some(t => rest.category.includes(t))) score += 3;
  }

  if (muckBti.fullness >= 4) {
    const triggers = ["갈비", "한우", "보쌈", "육개장", "국밥", "해장국", "고기", "삼겹살"];
    if (previews.some(m => triggers.some(t => m.includes(t))) || triggers.some(t => rest.category.includes(t))) score += 3;
  } else if (muckBti.fullness <= 2) {
    const triggers = ["샐러드", "브런치", "식빵", "어묵", "가벼운"];
    if (previews.some(m => triggers.some(t => m.includes(t))) || triggers.some(t => rest.category.includes(t))) score += 3;
  }

  if (muckBti.salty >= 4) {
    const triggers = ["젓갈", "장조림", "족발", "간장", "절임", "짭짤"];
    if (previews.some(m => triggers.some(t => m.includes(t))) || triggers.some(t => rest.category.includes(t))) score += 3;
  } else if (muckBti.salty <= 2) {
    const triggers = ["샤브샤브", "백숙", "맑은탕", "담백", "두부"];
    if (previews.some(m => triggers.some(t => m.includes(t))) || triggers.some(t => rest.category.includes(t))) score += 3;
  }

  if (muckBti.drink >= 4 && (rest.category.includes("주점") || rest.category.includes("맥주") || rest.category.includes("안주") || rest.category.includes("닭발"))) {
    score += 1;
  }

  score += Math.max(0, (1000 - rest.distance_meters) / 1000);

  const isBar = rest.category.includes("호프") || rest.category.includes("주점") || rest.category.includes("맥주") || rest.category.includes("안주");

  if (detectedMealType === "아침" || detectedMealType === "점심") {
    if (isBar) return { rest, score: -999 };
    if (rest.category.includes("샐러드") || rest.category.includes("브런치") || rest.category.includes("두부")) score += 2;
    else score += 2;
  } else if (detectedMealType === "저녁") {
    if (!isBar) score += 1;
  } else {
    if (isBar) score += 2;
  }

  return { rest, score };
});

// 2. 정렬 + 최종 3곳 선정
const sortedCandidates = scored
  .filter(item => item.score > -100)
  .sort((a, b) => (b.score === a.score ? Math.random() - 0.5 : b.score - a.score));

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

// 3. 최종 선정된 식당들만 Naver 매칭
const naverClientId = process.env.NAVER_CLIENT_ID;
const naverClientSecret = process.env.NAVER_CLIENT_SECRET;
const naverMatchMap = new Map<string, { rating: number; photo_url: string | null }>();
const topRestaurantsToMatch = filteredAndSorted.map(item => item.rest);

await Promise.all(
  topRestaurantsToMatch.map(async (rest) => {
    if (naverClientId && naverClientSecret) {
      try {
        const searchQuery = `${rest.name} ${rest.address.split(" ").slice(0, 2).join(" ")}`;
        const localUrl = `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(searchQuery)}&display=1`;
        const localRes = await fetch(localUrl, { headers: { "X-Naver-Client-Id": naverClientId, "X-Naver-Client-Secret": naverClientSecret } });
        const localData: any = await localRes.json();
        if (localData.items && localData.items.length > 0) {
  const matchedItem = localData.items[0];
  const cleanedTitle = matchedItem.title.replace(/<\/?[^>]+(>|$)/g, "");
  let photoUrl: string | null = null;
  
  // ... (중간 이미지 검색 fetch 로직 생략) ...

  // 1. 네이버가 준 상세 카테고리(ex: "일식>초밥,롤")에서 맨 뒤 단어만 쏙 뽑기
  const naverCategory = matchedItem.category || "";
  const naverMenuGuess = naverCategory.split(">").pop() || "";

  // 2. Map에 menu_guess도 함께 저장하기
  naverMatchMap.set(rest.name, { 
    rating: getDeterministicRating(rest.name), 
    photo_url: photoUrl,
    menu_guess: naverMenuGuess // <-- 이 줄 추가!
  });
}
      } catch (e) {
        console.error(`Naver match failed for ${rest.name}:`, e);
      }
    } else {
      const hashVal = rest.name.charCodeAt(0) + rest.name.charCodeAt(rest.name.length - 1);
      if (hashVal % 2 === 0) naverMatchMap.set(rest.name, { rating: getDeterministicRating(rest.name), photo_url: null });
    }
  })
);

let curateResults: { name: string; recommended_menu: string; toss_comment: string; category: string; address: string }[] =
  filteredAndSorted.map(({ rest }) => {
    const categoryLeaf = rest.category.split(" > ").pop() || "";
    const realMenus = rest.menu_preview.filter(m =>
      m.length >= 2 &&
      m !== categoryLeaf &&
      !m.includes(">") &&
      !/^[가-힣]{1,2}$/.test(m)
    );

    // [수정] 네이버에서 가공해 둔 세부 카테고리 메뉴가 있다면 가져오기
    const naverMatch = naverMatchMap.get(rest.name);
    const naverMenu = naverMatch && 'menu_guess' in naverMatch ? (naverMatch as any).menu_guess : "";

    // 기존 realMenus에 값이 없다면 네이버 세부 카테고리를 최종 메뉴로 낙점!
    const recommended_menu = realMenus[0] || naverMenu || "";

    return {
      name: rest.name,
      recommended_menu,                 
      toss_comment: generateDynamicComment(rest, muckBti, detectedMealType),
      category: rest.category,  
      address: rest.address
    };
});

  let recSource: "gemini" | "fallback" = "fallback";

  if (process.env.GEMINI_API_KEY && curateResults.length > 0) {
    try {
      const ai = getAi();
      const commentPrompt = `사용자 먹BTI: 맵기${muckBti.spicy} 포만감${muckBti.fullness} 음주${muckBti.drink} 건강목표${muckBti.health} 식사시간${detectedMealType}
아래 식당 3곳에 토스 앱 스타일의 위트있고 친근한 추천 코멘트를 각각 한 문장씩 작성해줘. 마크다운 없이 JSON만 반환.
${curateResults.map(r => `- ${r.name} (${r.category})`).join("\n")}
형식: [{"name":"식당명","comment":"코멘트"}]`;

      const geminiResponse = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: commentPrompt,
        config: { temperature: 0.7, responseMimeType: "application/json" }
      });

      let cleaned = (geminiResponse.text || "[]").trim();
      if (cleaned.startsWith("```")) cleaned = cleaned.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed) && parsed.length > 0) {
        curateResults = curateResults.map(r => {
          const match = parsed.find((p: any) => p.name === r.name);
          return match && match.comment ? { ...r, toss_comment: match.comment } : r;
        });
        recSource = "gemini";
      }
    } catch (e: any) {
      const isRateLimit = e?.message?.includes("429") || JSON.stringify(e).includes("Quota exceeded");
      console.log(isRateLimit ? "[429] Gemini 코멘트 생성 스킵, 동적 코멘트 유지" : "[Error] Gemini 코멘트 실패, 동적 코멘트 유지");
    }
  }

  const mergedRestaurants: RecommendedRestaurant[] = curateResults.map((cur) => {
    const original = rawNearby.find(r => r.name === cur.name);
    const naverMatch = naverMatchMap.get(cur.name) || { rating: null, photo_url: null };

    const finalAddress = cur.address || (original ? original.address : `${addressText || "지정 구역"} 인근`);
    const finalCategory = cur.category;
    const distM = original ? original.distance_meters : Math.floor(180 + Math.random() * 450);
    const walkMin = Math.max(1, Math.round(distM / 80));

    const addressWords = finalAddress.split(" ");
    const filteredRegionWords = addressWords.filter(w =>
      (w.endsWith("구") || w.endsWith("동") || w.endsWith("군") || w.endsWith("읍") || w.endsWith("면")) &&
      !w.includes("해당") && !w.includes("인근") && !w.includes("구역")
    );
    const cleanAddressContext = filteredRegionWords.length > 0 ? filteredRegionWords.pop() || "" : "";

    const commonFranchises = ["스타벅스", "써브웨이", "엽기떡볶이", "본죽", "굽네치킨", "홍콩반점", "가마치통닭", "청진동해장국"];
    const isFranchise = commonFranchises.some(f => cur.name.includes(f));
    const queryForMap = (isFranchise && cleanAddressContext) ? `${cleanAddressContext} ${cur.name}`.trim() : cur.name;

    return {
      name: cur.name,
      recommended_menu: cur.recommended_menu,
      toss_comment: cur.toss_comment,
      distance_meters: distM,
      walk_min: walkMin,
      category: finalCategory,
      address: finalAddress,
      kakao_url: `https://map.kakao.com/link/search/${encodeURIComponent(queryForMap)}`,
      naver_url: `https://map.naver.com/v5/search/${encodeURIComponent(queryForMap)}`,
      verified_photo_url: naverMatch.photo_url,
      verified_rating: naverMatch.rating || getDeterministicRating(cur.name)
    };
  });

  const responsePayload: RecommendationResponse = {
    restaurants: mergedRestaurants,
    meal_type: detectedMealType,
    location_source: req.body.location_source || "gps",
    address: addressText || "추천 반경 인근",
    recommendation_source: recSource
  };

  console.log(`[Curation Source] ${recSource} (Demo mode: ${isDemoMode})`);
  res.json(responsePayload);
});

// Serve frontend assets
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server starting on port ${PORT}`);
  });
}

startServer();