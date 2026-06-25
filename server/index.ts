import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { resolve } from "path";

const envPath = resolve(process.cwd(), "server/.env");
// eslint-disable-next-line no-console
console.log("Loading env from", envPath);
dotenv.config({ path: envPath });

const app = express();
app.use(cors());
app.use(express.json());

const kakaoAdminKey = process.env.KAKAO_API_KEY;

if (!kakaoAdminKey) {
  // eslint-disable-next-line no-console
  console.warn("Warning: KAKAO_API_KEY is not configured in server/.env");
}

const sampleRecommendations = [
  {
    id: "1",
    name: "비건 스페셜 브런치",
    imageUrl:
      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80",
    distance: "1.2km",
    duration: "10분",
    rating: 4.8,
    tags: ["추천 메뉴", "가벼운 식사", "모임에 적합"],
    reason: "현재 위치에서 가까운 건강식 브런치 추천이에요.",
  },
  {
    id: "2",
    name: "매콤한 닭갈비 세트",
    imageUrl:
      "https://images.unsplash.com/photo-1604908177522-40b8b7e81eca?auto=format&fit=crop&w=800&q=80",
    distance: "2.5km",
    duration: "18분",
    rating: 4.6,
    tags: ["매운맛", "단체 주문", "포장 가능"],
    reason: "약속 장소 근처에서 인기 있는 매운 메뉴입니다.",
  },
  {
    id: "3",
    name: "크림 파스타&리조또",
    imageUrl:
      "https://images.unsplash.com/photo-1512058564366-c9e9c3135f43?auto=format&fit=crop&w=800&q=80",
    distance: "3.1km",
    duration: "22분",
    rating: 4.7,
    tags: ["편안한 분위기", "데일리 메뉴", "인원 다수"],
    reason: "입맛과 인원 수를 고려해 조용한 데이트형 추천입니다.",
  },
];

app.get("/api/status", (_req, res) => {
  res.json({ status: "ok", version: "1.0.0" });
});

app.post("/api/location-search", async (req, res) => {
  const query = req.body.query;

  if (!query || typeof query !== "string") {
    return res.status(400).json({ error: "query is required" });
  }

  if (!kakaoAdminKey) {
    return res.status(500).json({ error: "KAKAO_API_KEY is not configured" });
  }

  try {
    const response = await fetch(
      `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=10`,
      {
        headers: {
          Authorization: `KakaoAK ${kakaoAdminKey}`,
        },
      },
    );

    if (!response.ok) {
      const message = await response.text();
      return res.status(response.status).json({ error: message });
    }

    const data = await response.json();
    return res.json(data);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

app.post("/api/recommendations", (req, res) => {
  console.log("Received request body:", JSON.stringify(req.body, null, 2));
  try {
    const { muckBti, latitude, longitude, groupSize, yesterdayFood, searchRadiusM, location_source, addressText, excludeNames, categoryOverride } = req.body;

    // For now, map the incoming data to the expected format if needed by sampleRecommendations
    const location = { address: addressText || "알 수 없는 주소", lat: latitude, lon: longitude };

    if (!location?.address) {
      return res.status(400).json({ error: "location.address is required" });
    }

    const recommendations = sampleRecommendations.filter((item) => {
      // Basic filter logic using available data
      if (yesterdayFood && item.tags.includes(yesterdayFood)) return false;
      if (excludeNames && excludeNames.includes(item.name)) return false;
      return true;
    });

    return res.json({ location, guests: groupSize, recommendations });
  } catch (error) {
    console.error("Error in /api/recommendations:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

const port = process.env.PORT ?? 4000;
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Food BTI backend running on http://localhost:${port}`);
});
