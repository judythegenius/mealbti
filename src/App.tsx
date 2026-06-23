/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { MuckBti, CurrentContext, RecommendedRestaurant, RecommendationResponse } from "./types";
import { getMatchedCharacter } from "./characters";
import MuckBtiTest from "./components/MuckBtiTest";
import CharacterCard from "./components/CharacterCard";
import MyProfile from "./components/MyProfile";
import LocationBanner, { presetLocations } from "./components/LocationBanner";
import RecommendationList from "./components/RecommendationList";
import { Utensils, Sliders, ChevronDown, Check, Compass, History, HelpCircle, RefreshCw, Award, AlertCircle } from "lucide-react";
import { useGeolocation, Accuracy } from "./web-framework";

export default function App() {
  const [tab, setTab] = useState<"recommend" | "test" | "profile" | "resultCard" | "sharedResult">("test");
  const [mbti, setMbti] = useState<MuckBti | null>(null);
  const [sharedMbti, setSharedMbti] = useState<MuckBti | null>(null);

  // Recommendation parameters state
  const [mealType, setMealType] = useState<"아침" | "점심" | "저녁" | "야식">("점심");
  const [groupSize, setGroupSize] = useState<"1인" | "2~3인" | "4인이상">("1인");
  const [yesterdayFood, setYesterdayFood] = useState<string>("");
  const [yesterdayFoodInput, setYesterdayFoodInput] = useState<string>("");
  const [searchRadiusM, setSearchRadiusM] = useState<number>(3000);
  const [isFiltersExpanded, setIsFiltersExpanded] = useState<boolean>(false);
 const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Position geolocations
  const [coordinates, setCoordinates] = useState<{ lat: number; lon: number } | null>(null);
  const [locationSource, setLocationSource] = useState<"gps" | "ip_estimated" | "manual">("manual");
  const [addressText, setAddressText] = useState<string>("마포 백년가 인근");
  const [gpsStatus, setGpsStatus] = useState<"not_requested" | "requesting" | "granted" | "denied" | "timeout" | "unsupported">("not_requested");

  // High-accuracy real-time platform GPS tracking
  const platformLocation = useGeolocation({
    accuracy: Accuracy.Highest,
    timeInterval: 5000,
    distanceInterval: 10
  });

  useEffect(() => {
    if (platformLocation?.latitude && platformLocation?.longitude) {
      if (locationSource !== "manual") {
        const lat = platformLocation.latitude;
        const lon = platformLocation.longitude;
        setCoordinates({ lat, lon });
        setLocationSource("gps");
        setGpsStatus("granted");
        syncAddress(lat, lon, "gps");
      }
    }
  }, [platformLocation, locationSource]);

  // 오늘 하루 동안 이미 본 식당 이름 추적 (localStorage 기반, 날짜 바뀌면 초기화)
const getSeenRestaurantsToday = (): string[] => {
  const today = new Date().toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" });
  const stored = localStorage.getItem("seen_restaurants");
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored);
    if (parsed.date !== today) {
      // 날짜가 바뀌었으면 초기화
      localStorage.removeItem("seen_restaurants");
      return [];
    }
    return parsed.names || [];
  } catch {
    return [];
  }
};

const addSeenRestaurantsToday = (names: string[]) => {
  const today = new Date().toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" });
  const existing = getSeenRestaurantsToday();
  const merged = Array.from(new Set([...existing, ...names]));
  localStorage.setItem("seen_restaurants", JSON.stringify({ date: today, names: merged }));
};

  // Server results
  const [restaurants, setRestaurants] = useState<RecommendedRestaurant[]>([]);
  const [curationSource, setCurationSource] = useState<"gemini" | "fallback">("fallback");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Setup app theme configuration on load
  useEffect(() => {
    // Check url search parameters (Result sharing checks)
    const queryParams = new URLSearchParams(window.location.search);
    const mbtiParam = queryParams.get("mbti");
    if (mbtiParam) {
      const parts = mbtiParam.split(",");
      if (parts.length >= 7) {
        const loadedMbti: MuckBti = {
          spicy: parseInt(parts[0]) || 3,
          fullness: parseInt(parts[1]) || 3,
          budget: parseInt(parts[2]) || 3,
          distance: parseInt(parts[3]) || 3,
          speed: parseInt(parts[4]) || 3,
          drink: parseInt(parts[5]) || 3,
          health: parts[6] as MuckBti["health"],
        };
        setSharedMbti(loadedMbti);
        setTab("sharedResult");
        return;
      }
    }

    // Load from local storage
    const saved = localStorage.getItem("muck_bti_v2");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setMbti(parsed);
        // Map default distance axis to search range
        setSearchRadiusM(mapDistanceToRadius(parsed.distance));
        setTab("recommend");
      } catch (e) {
        setTab("test");
      }
    } else {
      setTab("test");
    }

    // Auto trigger geo queries
    requestLocation();
  }, []);

  // Sync serverside detected meal time on load
  useEffect(() => {
    const kstHour = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" })).getHours();
    if (kstHour >= 5 && kstHour < 11) {
      setMealType("아침");
    } else if (kstHour >= 11 && kstHour < 16) {
      setMealType("점심");
    } else if (kstHour >= 16 && kstHour < 21) {
      setMealType("저녁");
    } else {
      setMealType("야식");
    }
  }, []);

  // Keep yesterdayFoodInput synchronized in case of preset buttons or external clears
  useEffect(() => {
    setYesterdayFoodInput(yesterdayFood);
  }, [yesterdayFood]);

  // Trigger Curation fetch on active variables change (debounced 0.5s for slider)
  useEffect(() => {
    if (!coordinates) return;

    const timer = setTimeout(() => {
      fetchRecommendations();
    }, 500);

    return () => clearTimeout(timer);
}, [coordinates, mbti, mealType, groupSize, yesterdayFood, searchRadiusM, selectedCategory]);

  // Map MBTI 1-5 distance coordinate to actual Kakao radius parameter (100m ~ 3000m)
  const mapDistanceToRadius = (dist: number): number => {
    switch (dist) {
      case 1: return 100;
      case 2: return 300;
      case 3: return 500;
      case 4: return 1500;
      case 5: return 3000;
      default: return 1000;
    }
  };

  const syncAddress = async (lat: number, lon: number, source: "gps" | "ip_estimated" | "manual") => {
    try {
      const res = await fetch("/api/reverse-geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latitude: lat, longitude: lon }),
      });
      const data = await res.json();
      if (data.address) {
        setAddressText(data.address);
      } else {
        setAddressText("서울시 어딘가 입맛 탐정구역");
      }
    } catch (e) {
      setAddressText("서울시 식객 탐방 구역");
    }
  };

  const requestLocation = () => {
    if (navigator.geolocation) {
      setGpsStatus("requesting");
      
      const optionsHigh = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 };
      const optionsLow = { enableHighAccuracy: false, timeout: 15000, maximumAge: 0 };
      
      // 1차 시도: High Accuracy (고정밀 위생 GPS, 모바일 전용)
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          setCoordinates({ lat, lon });
          setLocationSource("gps");
          setGpsStatus("granted");
          await syncAddress(lat, lon, "gps");
        },
        (highError) => {
          console.warn("고정밀 GPS 획득 실패 (PC/노트북 환경 등), 2차 일반 분산형 Wi-Fi 게이트웨이 위치 조회를 개시합니다:", highError);
          
          // 2차 시도: Low Accuracy (일반 PC 브라우저 Wi-Fi 및 인근 중계기 기반 1초 탐색)
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              const lat = position.coords.latitude;
              const lon = position.coords.longitude;
              setCoordinates({ lat, lon });
              setLocationSource("gps");
              setGpsStatus("granted");
              await syncAddress(lat, lon, "gps");
            },
            async (lowError) => {
              console.warn("Wi-Fi 무선기반 위치 조회도 최종 차단되었습니다. IP 추적 서비스로 최선책을 설정합니다:", lowError);
              if (lowError.code === lowError.PERMISSION_DENIED) {
                setGpsStatus("denied");
              } else if (lowError.code === lowError.TIMEOUT) {
                setGpsStatus("timeout");
              } else {
                setGpsStatus("unsupported");
              }
              await fallbackToIpLocation();
            },
            optionsLow
          );
        },
        optionsHigh
      );
    } else {
      setGpsStatus("unsupported");
      fallbackToIpLocation();
    }
  };

  const fallbackToIpLocation = async () => {
    try {
      const res = await fetch("https://ipapi.co/json/");
      if (!res.ok) throw new Error("Rate limited");
      const data = await res.json();
      if (data.latitude && data.longitude) {
        const lat = parseFloat(data.latitude);
        const lon = parseFloat(data.longitude);
        setCoordinates({ lat, lon });
        setLocationSource("ip_estimated");
        setAddressText(data.city ? `서울시 IP 추정구역 (${data.city})` : "서울시 IP 추정구역");
        return;
      }
      throw new Error("Missing coords");
    } catch (err) {
      try {
        const res2 = await fetch("https://freeipapi.com/api/json");
        const data2 = await res2.json();
        if (data2.latitude && data2.longitude) {
          setCoordinates({ lat: data2.latitude, lon: data2.longitude });
          setLocationSource("ip_estimated");
          setAddressText(data2.cityName ? `IP 추정구역 (${data2.cityName})` : "IP 추정구역");
          return;
        }
      } catch (err2) {
        console.warn("IP Geolocation API failed, loading preset:", err2);
      }
      useDefaultCoords();
    }
  };

  const useDefaultCoords = () => {
    // Default: Yeongdeungpo Market Station
    setCoordinates({ lat: 37.4947, lon: 126.9601 });
    setLocationSource("manual");
    setAddressText("서울시 영등포구 영등포시장역 인근 (기본)");
  };

  const fetchRecommendations = async () => {
    if (!coordinates || !mbti) return;

    setIsLoading(true);
    setApiError(null);

    try {
      const response = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
body: JSON.stringify({
  muckBti: mbti,
  latitude: coordinates.lat,
  longitude: coordinates.lon,
  groupSize,
  yesterdayFood,
  searchRadiusM,
  location_source: locationSource,
  addressText,
  excludeNames: getSeenRestaurantsToday(),
  categoryOverride: selectedCategory
}),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || "식당 검색에 공백이 발생했습니다.");
      }

      const data: RecommendationResponse = await response.json();
      setRestaurants(data.restaurants || []);
      setCurationSource(data.recommendation_source || "fallback");
// 오늘 본 식당으로 기록 (다음 "다시 검색하기"에서 제외되도록)
if (data.restaurants && data.restaurants.length > 0) {
  addSeenRestaurantsToday(data.restaurants.map(r => r.name));
}
    } catch (e: any) {
      console.error("Curation retrieval error:", e);
      setApiError(e.message || "네트워킹 처리 중 장애가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestComplete = (testMbti: MuckBti) => {
    setMbti(testMbti);
    localStorage.setItem("muck_bti_v2", JSON.stringify(testMbti));
    setSearchRadiusM(mapDistanceToRadius(testMbti.distance));
    setTab("resultCard");
  };

  const handleProfileUpdate = (updatedMbti: MuckBti) => {
    setMbti(updatedMbti);
    localStorage.setItem("muck_bti_v2", JSON.stringify(updatedMbti));
    // Re-map radius if it hasn't been manually adjusted or just update the basic setting range
    setSearchRadiusM(mapDistanceToRadius(updatedMbti.distance));
  };

  const handleSelectCoordsOverride = async (lat: number, lon: number, name: string, src: "gps" | "manual") => {
    setCoordinates({ lat, lon });
    setLocationSource(src);
    setAddressText(name);
  };

  const handleTextSearchLocation = async (query: string): Promise<boolean> => {
    try {
      const res = await fetch("/api/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (data.lat && data.lon && data.address) {
        setCoordinates({ lat: data.lat, lon: data.lon });
        setLocationSource("manual");
        setAddressText(data.address);
        return true;
      }
    } catch (e) {
      console.error("Text geocoding fetch error:", e);
    }
    return false;
  };

  const clearShareAndStartTest = () => {
    // Re-set URL history to strip parameters, launching onboarding fresh
    window.history.replaceState({}, document.title, window.location.pathname);
    setSharedMbti(null);
    setTab("test");
  };

  const activeCharacter = mbti ? getMatchedCharacter(mbti) : null;
  const sharedCharacter = sharedMbti ? getMatchedCharacter(sharedMbti) : null;

  return (
    <div className="min-h-screen bg-[#F2F4F6] text-[#333D4B] flex flex-col font-sans pb-28 md:pb-6" id="theme-root">
      {/* Toss Mini App Top Title Header Bar */}
      <header className="w-full max-w-md mx-auto bg-white px-5 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 z-40 select-none shadow-sm rounded-b-[24px]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-[#3182F6] rounded-[8px] flex items-center justify-center text-sm">🍽️</div>
          <span className="font-bold text-lg tracking-tight text-[#333D4B]">오늘 뭐 먹지?</span>
          <span className="text-[9px] bg-[#e8f3ff] text-[#3182F6] font-mono px-1.5 py-0.5 rounded-full font-bold">먹BTI</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-semibold text-gray-500 font-sans">실시간 추천</span>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 w-full max-w-md mx-auto px-4 py-5 flex flex-col gap-6">
        
        {/* Render correct frame layout based on current Tab state */}
        
        {/* TAB 1: SHARED MBTI VIEW (Friend 유입) */}
        {tab === "sharedResult" && sharedCharacter && sharedMbti && (
          <div className="w-full" id="shared-result-wrapper">
            <div className="text-center py-4 bg-blue-50 border border-blue-100 rounded-2xl mb-4.5">
              <span className="text-xs font-bold text-[#3182F6]">공유된 친구의 먹BTI 카드</span>
            </div>
            <CharacterCard
              character={sharedCharacter}
              mbti={sharedMbti}
              onRestart={clearShareAndStartTest}
              onExplore={() => {}}
              isSharedView={true}
            />
          </div>
        )}

        {/* TAB 2: ACTIVE ONBOARDING QUESTIONNAIRE */}
        {tab === "test" && (
          <div className="w-full" id="test-wrapper">
            <div className="text-center mb-5 select-none animate-fade-in">
              <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">당신의 먹BTI는 무엇인가요?</h2>
              <p className="text-sm text-gray-500 mt-1 font-medium bg-white py-1 px-4.5 rounded-full border border-gray-100/50 inline-block">
                성향 검사는 단 30초면 충분해요
              </p>
            </div>
            <MuckBtiTest onComplete={handleTestComplete} />
          </div>
        )}

        {/* TAB 3: CHARACTER RESULT CARD (Right after test) */}
        {tab === "resultCard" && activeCharacter && mbti && (
          <div className="w-full flex flex-col gap-5" id="result-card-wrapper">
            <div className="text-center select-none animate-fade-in">
              <span className="text-3xl">🥳</span>
              <h2 className="text-xl font-extrabold text-gray-950 mt-1.5 tracking-tight">먹BTI 캐릭터가 분석되었습니다!</h2>
              <p className="text-xs text-gray-400 mt-1">이 기조를 근간으로 실존 매장을 추천합니다.</p>
            </div>
            <CharacterCard
              character={activeCharacter}
              mbti={mbti}
              onRestart={() => setTab("test")}
              onExplore={() => setTab("recommend")}
            />
          </div>
        )}

        {/* TAB 4: MY PAGE EDIT PROFILE */}
        {tab === "profile" && mbti && (
          <div className="w-full" id="profile-wrapper">
            <div className="text-center mb-5 select-none">
              <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">마이 먹BTI 수동 조율</h2>
              <p className="text-xs text-gray-400 mt-1">재검사 없이 실시간 성향과 기조를 바꿉니다.</p>
            </div>
            <MyProfile initialMbti={mbti} onUpdate={handleProfileUpdate} />
          {/* 재검사 버튼 추가 */}
    <button
      type="button"
      onClick={() => setTab("test")}
      className="w-full mt-4 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold text-xs rounded-2xl transition-all"
    >
      처음부터 다시 검사하기
    </button>
  </div>
        )}

        {/* TAB 5: HERO RECOMMENDATION RESULTS (Core view) */}
        {tab === "recommend" && mbti && activeCharacter && (
          <div className="w-full flex flex-col gap-5 animate-fade-in" id="recommendation-hero-panel">
            
            {/* IP fallback location warning and current active place indicator */}
            <LocationBanner
              locationSource={locationSource}
              currentAddress={addressText}
              onSelectLocation={handleSelectCoordsOverride}
              onRequestGps={requestLocation}
              onTextSearchLocation={handleTextSearchLocation}
/>


            {/* 오늘의 상황 변수 및 반경 조절 (Collapsible Context filters wrapper) */}
            {!isFiltersExpanded ? (
              <button
                type="button"
                onClick={() => setIsFiltersExpanded(true)}
                className="w-full bg-white rounded-[24px] p-4.5 border border-gray-150/50 shadow-sm flex items-center justify-between hover:bg-gray-50 active:scale-[0.99] transition-all text-left"
                id="expand-filters-trigger"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-[#F2F8FF] rounded-xl flex items-center justify-center">
                    <Sliders className="w-5 h-5 text-[#3182F6]" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">상황·반경 필터</h4>
                    <p className="text-sm font-extrabold text-[#333D4B] mt-1">
                      {mealType} · {groupSize} · {searchRadiusM >= 1000 ? `${(searchRadiusM / 1000).toFixed(1)}km` : `${searchRadiusM}m`}
                      {yesterdayFood ? ` · 제외: ${yesterdayFood}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 bg-[#F2F8FF] px-2.5 py-1.5 rounded-full text-xs font-bold text-[#3182F6]">
                  <span>조율하기</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </div>
              </button>
            ) : (
              <div className="bg-white rounded-[32px] p-5.5 border border-gray-150/50 shadow-sm flex flex-col gap-4 animate-fade-in" id="filters-expanded-box">
                <div className="flex justify-between items-center pb-2 border-b border-gray-100/60">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                    <History className="w-4 h-4 text-[#3182F6]" /> 상황 변수 및 추천 반경
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsFiltersExpanded(false)}
                    className="flex items-center gap-0.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold px-2.5 py-1 rounded-full text-[10.5px] transition-all cursor-pointer"
                  >
                    <span>접어두기</span>
                    <ChevronDown className="w-3.5 h-3.5 rotate-180" />
                  </button>
                </div>

                {/* 1. Meal Type directly toggled (Morning, Lunch, Dinner, Late night) */}
                <div className="grid grid-cols-4 gap-1.5 p-1 bg-[#F9FAFB] rounded-[16px] border border-gray-150/50">
                  {(["아침", "점심", "저녁", "야식"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setMealType(type)}
                      className={`py-2 text-xs font-bold rounded-lg transition-all ${
                        mealType === type
                          ? "bg-white text-[#3182F6] shadow-sm font-extrabold border border-gray-150/50"
                          : "text-gray-400 hover:text-gray-600"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>

                {/* 2. Group Size buttons */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-gray-700 px-1">👥 함께 식사할 인원수</span>
                  <div className="grid grid-cols-3 gap-2">
                    {(["1인", "2~3인", "4인이상"] as const).map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setGroupSize(size)}
                        className={`py-3 text-xs font-bold border rounded-[16px] transition-all ${
                          groupSize === size
                            ? "border-[#3182F6] bg-[#f2f8ff] text-[#3182F6] ring-1 ring-[#3182F6]/30"
                            : "border-gray-200 bg-[#F9FAFB] hover:bg-gray-50 text-gray-500"
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Yesterday Food Exclusion tags */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-gray-700 px-1">🚫 피하고 싶은 어제의 메뉴</span>
                  <input
                    type="text"
                    placeholder="예: 삼겹살, 소주, 피자, 초밥 (입력 후 Enter 또는 빈곳 클릭)"
                    id="yesterday-food-input"
                    value={yesterdayFoodInput}
                    onChange={(e) => setYesterdayFoodInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        setYesterdayFood(yesterdayFoodInput);
                      }
                    }}
                    onBlur={() => {
                      setYesterdayFood(yesterdayFoodInput);
                    }}
                    className="w-full bg-[#F9FAFB] hover:bg-gray-100/50 focus:bg-white focus:ring-1 focus:ring-[#3182F6] p-3 rounded-[18px] text-xs font-semibold text-gray-800 placeholder-gray-400 border border-gray-150 transition-all outline-none"
                  />
                  
                  {/* Speedy preset tags for user ease */}
                  <div className="flex flex-wrap gap-1.5 mt-1.5 px-0.5">
                    {["삼겹살", "피자", "치킨배달", "없음"].map((tag) => (
                      <span
                        key={tag}
                        onClick={() => {
                          const nextVal = tag === "없음" ? "" : tag;
                          setYesterdayFoodInput(nextVal);
                          setYesterdayFood(nextVal);
                        }}
                        className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg border cursor-pointer transition-all ${
                          (tag === "없음" && yesterdayFood === "") || (tag !== "없음" && yesterdayFood.includes(tag))
                            ? "border-[#3182F6] bg-blue-50/50 text-[#3182F6]"
                            : "border-gray-200 text-gray-500 bg-white hover:bg-gray-50"
                        }`}
                      >
                        {tag === "없음" ? "초기화" : `# ${tag}`}
                      </span>
                    ))}
                  </div>
                </div>

                {/* 4. Live Search range radius slider (7 levels: 100m, 300m, 500m, 1.0k, 1.5k, 2.0k, 3.0k) */}
                <div className="flex flex-col gap-1.5 pt-2 border-t border-gray-100">
                  <div className="flex justify-between items-center px-1">
                    <span className="text-xs font-bold text-gray-700">🧭 탐색 전용 거리 반경</span>
                    <span className="text-xs font-bold font-mono text-[#3182F6]">
                      {searchRadiusM >= 1000 ? `${(searchRadiusM / 1000).toFixed(1)} km` : `${searchRadiusM} m`}
                    </span>
                  </div>
                  
                  <input
                    type="range"
                    min="0"
                    max="6"
                    step="1"
                    id="radius-context-slider"
                    value={
                      searchRadiusM === 100 ? 0 :
                      searchRadiusM === 300 ? 1 :
                      searchRadiusM === 500 ? 2 :
                      searchRadiusM === 1000 ? 3 :
                      searchRadiusM === 1500 ? 4 :
                      searchRadiusM === 2000 ? 5 : 6
                    }
                    onChange={(e) => {
                      const idx = parseInt(e.target.value);
                      const radii = [100, 300, 500, 1000, 1500, 2000, 3000];
                      setSearchRadiusM(radii[idx]);
                    }}
                    className="w-full h-1.5 bg-gray-150 rounded-full appearance-none cursor-pointer accent-[#3182F6] outline-none"
                  />
                  
                  <div className="flex justify-between text-[9px] text-[#8D95A1] font-bold font-sans mt-0.5 px-0.5 select-none">
                    <span>100m</span>
                    <span>300m</span>
                    <span>500m</span>
                    <span>1.0k</span>
                    <span>1.5k</span>
                    <span>2.0k</span>
                    <span>3.0k</span>
                  </div>
                </div>
              </div>
            )}

            {/* Error alerts from API */}
            {apiError && (
              <div className="bg-red-50 border border-red-200 text-red-800 text-xs p-4.5 rounded-2xl flex items-start gap-2.5 animate-fade-in">
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold">맛집 분석 장애 국면</h4>
                  <p className="text-gray-500 mt-1 leading-relaxed font-normal">{apiError}</p>
                </div>
              </div>
            )}

            {/* Recommendations List and card representations */}
            <RecommendationList
              restaurants={restaurants}
              isLoading={isLoading}
              onExpandRadius={() => setSearchRadiusM(3000)}
              onRefresh={fetchRecommendations}
              radiusM={searchRadiusM}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
            />
          </div>
        )}
      </main>

      {/* Toss Classic Sticky bottom navigation bar (Always visible once initial setup is done, so user is never locked in) */}
      {tab !== "sharedResult" && (
        <nav className="w-full max-w-md mx-auto bg-white/95 backdrop-blur-md border-t border-gray-100 flex py-3.5 px-4 justify-around fixed bottom-0 left-0 right-0 z-40 shadow-xl select-none">
          <button
            type="button"
            id="nav-tab-recommend"
            onClick={() => {
              if (mbti === null) {
                alert("먼저 먹BTI 성향 검사를 완료해주세요!");
                return;
              }
              setTab("recommend");
            }}
            className={`flex flex-col items-center gap-1.5 transition-all text-center shrink-0 cursor-pointer ${
              tab === "recommend" ? "text-[#3182F6]" : "text-gray-400 hover:text-gray-600"
            }`}
          >
            <Utensils className={`w-5 h-5 ${tab === "recommend" ? "stroke-[2.5px]" : ""}`} />
            <span className="text-[10px] font-bold font-sans">오늘의 추천</span>
          </button>

          <button
            type="button"
            id="nav-tab-profile"
            onClick={() => {
              if (mbti === null) {
                alert("먼저 먹BTI 성향 검사를 완료해주세요!");
                return;
              }
              setTab("profile");
            }}
            className={`flex flex-col items-center gap-1.5 transition-all text-center shrink-0 cursor-pointer ${
              tab === "profile" ? "text-[#3182F6]" : "text-gray-400 hover:text-gray-600"
            }`}
          >
            <Sliders className={`w-5 h-5 ${tab === "profile" ? "stroke-[2.5px]" : ""}`} />
            <span className="text-[10px] font-bold font-sans">성향 조절 (My)</span>
          </button>
          
        </nav>
      )}
    </div>
  );
}
