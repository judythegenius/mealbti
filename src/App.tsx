/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { MuckBti, RecommendedRestaurant, RecommendationResponse } from "./types";
import { getMatchedCharacter } from "./characters";
import MuckBtiTest from "./components/MuckBtiTest";
import CharacterCard from "./components/CharacterCard";
import MyProfile from "./components/MyProfile";
import RecommendationList from "./components/RecommendationList";
import { Utensils, Sliders, ChevronDown, AlertCircle, MapPin, Search, X } from "lucide-react";

function getSkyBg(): { from: string; label: string } {
  const h = new Date().getHours();
  if (h >= 5  && h < 8)  return { from: "from-[#FFD580] via-[#FFB347]/0 to-[#E8F4FD]/0", label: "아침" };
  if (h >= 8  && h < 12) return { from: "from-[#56CCF2] via-[#2F80ED]/0 to-[#E8F4FD]/0", label: "오전" };
  if (h >= 12 && h < 16) return { from: "from-[#2980B9] via-[#6DD5FA]/0 to-[#E8F4FD]/0", label: "점심" };
  if (h >= 16 && h < 19) return { from: "from-[#F7971E] via-[#FFD200]/0 to-[#E8F4FD]/0", label: "노을" };
  if (h >= 19 && h < 21) return { from: "from-[#4568DC] via-[#B06AB3]/0 to-[#E8F4FD]/0", label: "저녁" };
  return { from: "from-[#0F2027] via-[#203A43]/0 to-[#2C5364]/0", label: "밤" };
}

const HERO_SUBTITLES: Record<string, string> = {
  "아침": "당신을 위한 퍼스널 아침 추천",
  "오전": "당신을 위한 퍼스널 브런치 추천",
  "점심": "당신을 위한 퍼스널 점심 추천",
  "노을": "당신을 위한 퍼스널 저녁 추천",
  "저녁": "당신을 위한 퍼스널 저녁 추천",
  "밤": "당신을 위한 퍼스널 야식 추천",
};

export default function App() {
  const [tab, setTab] = useState<"recommend" | "test" | "profile" | "resultCard" | "sharedResult">("test");
  const [mbti, setMbti] = useState<MuckBti | null>(null);
  const [sharedMbti, setSharedMbti] = useState<MuckBti | null>(null);

  const [mealType, setMealType] = useState<"아침" | "점심" | "저녁" | "야식">("점심");
  const [groupSize, setGroupSize] = useState<"1인" | "2~3인" | "4인이상">("1인");
  const [yesterdayFood, setYesterdayFood] = useState<string>("");
  const [searchRadiusM, setSearchRadiusM] = useState<number>(1000);
  const [isFiltersExpanded, setIsFiltersExpanded] = useState<boolean>(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [gpsEnabled, setGpsEnabled] = useState<boolean>(true);

  // 검색창 상태
  const [searchInput, setSearchInput] = useState<string>("");
  const [searchSuggestions, setSearchSuggestions] = useState<any[]>([]);
  const [isSearchFocused, setIsSearchFocused] = useState<boolean>(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const [coordinates, setCoordinates] = useState<{ lat: number; lon: number } | null>(null);
  const [locationSource, setLocationSource] = useState<"gps" | "ip_estimated" | "manual">("manual");
  const [addressText, setAddressText] = useState<string>("위치 확인 중...");
  const [gpsStatus, setGpsStatus] = useState<"not_requested" | "requesting" | "granted" | "denied" | "timeout" | "unsupported">("not_requested");

  // 자동완성
  useEffect(() => {
    if (searchInput.trim().length < 1) { setSearchSuggestions([]); return; }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/autocomplete?q=${encodeURIComponent(searchInput)}`);
        const data = await res.json();
        setSearchSuggestions(data.items || []);
      } catch { setSearchSuggestions([]); }
    }, 200);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const getSeenRestaurantsToday = (): string[] => {
    const today = new Date().toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" });
    const stored = localStorage.getItem("seen_restaurants");
    if (!stored) return [];
    try {
      const parsed = JSON.parse(stored);
      if (parsed.date !== today) { localStorage.removeItem("seen_restaurants"); return []; }
      return parsed.names || [];
    } catch { return []; }
  };

  const addSeenRestaurantsToday = (names: string[]) => {
    const today = new Date().toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" });
    const merged = Array.from(new Set([...getSeenRestaurantsToday(), ...names]));
    localStorage.setItem("seen_restaurants", JSON.stringify({ date: today, names: merged }));
  };

  const [restaurants, setRestaurants] = useState<RecommendedRestaurant[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
      localStorage.removeItem("seen_restaurants"); // 앱 켤 때마다 리셋
    const queryParams = new URLSearchParams(window.location.search);
    const mbtiParam = queryParams.get("mbti");
    if (mbtiParam) {
      const parts = mbtiParam.split(",");
      if (parts.length >= 5) {
        const loadedMbti: MuckBti = {
          spicy: parseInt(parts[0]) || 3, fullness: parseInt(parts[1]) || 3,
          salty: parseInt(parts[2]) || 3, speed: parseInt(parts[3]) || 3,
          drink: parseInt(parts[4]) || 3, health: (parts[5] as MuckBti["health"]) || "none",
        };
        setSharedMbti(loadedMbti); setTab("sharedResult"); return;
      }
    }
    const saved = localStorage.getItem("muck_bti_v2");
    if (saved) {
      try {
        const p = JSON.parse(saved);
        setMbti({ spicy: p.spicy??3, fullness: p.fullness??3, salty: p.salty??3, speed: p.speed??3, drink: p.drink??3, health: p.health??"none" });
        setTab("recommend");
      } catch { setTab("test"); }
    } else { setTab("test"); }
    requestLocation();
  }, []);

  useEffect(() => {
    const h = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" })).getHours();
    if (h >= 5 && h < 11) setMealType("아침");
    else if (h >= 11 && h < 16) setMealType("점심");
    else if (h >= 16 && h < 21) setMealType("저녁");
    else setMealType("야식");
  }, []);

useEffect(() => {
  if (!coordinates) return;
  const timer = setTimeout(() => fetchRecommendations(false), 300);
  return () => clearTimeout(timer);
}, [coordinates, mbti, mealType, groupSize, yesterdayFood, searchRadiusM, selectedCategories]);

  const syncAddress = async (lat: number, lon: number) => {
    try {
      const res = await fetch("/api/reverse-geocode", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ latitude: lat, longitude: lon }) });
      const data = await res.json();
      const addr = data.address || "위치 확인 중...";
      setAddressText(addr);
      setSearchInput(addr);
    } catch { setAddressText("위치 확인 실패"); }
  };

  const requestLocation = () => {
    if (!gpsEnabled) return;
    if (!navigator.geolocation) { setGpsStatus("unsupported"); fallbackToIpLocation(); return; }
    setGpsStatus("requesting");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude; const lon = pos.coords.longitude;
        setCoordinates({ lat, lon }); setLocationSource("gps"); setGpsStatus("granted");
        await syncAddress(lat, lon);
      },
      async () => {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const lat = pos.coords.latitude; const lon = pos.coords.longitude;
            setCoordinates({ lat, lon }); setLocationSource("gps"); setGpsStatus("granted");
            await syncAddress(lat, lon);
          },
          async (err) => {
            setGpsStatus(err.code === err.PERMISSION_DENIED ? "denied" : "timeout");
            await fallbackToIpLocation();
          },
          { enableHighAccuracy: false, timeout: 15000, maximumAge: 0 }
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const fallbackToIpLocation = async () => {
    try {
      const res = await fetch("https://ipapi.co/json/");
      const data = await res.json();
      if (data.latitude && data.longitude) {
        setCoordinates({ lat: parseFloat(data.latitude), lon: parseFloat(data.longitude) });
        setLocationSource("ip_estimated");
        const addr = data.city ? data.city + " 근처" : "현재 위치";
        setAddressText(addr); setSearchInput(addr); return;
      }
    } catch {}
    setCoordinates({ lat: 37.4947, lon: 126.9601 });
    setLocationSource("manual");
    setAddressText("서울 영등포구"); setSearchInput("서울 영등포구");
  };

  const handleSearchSelect = async (item: any) => {
    setSearchInput(item.place_name || item.address_name);
    setSearchSuggestions([]);
    setIsSearchFocused(false);
    if (item.lat && item.lon) {
      setCoordinates({ lat: item.lat, lon: item.lon });
      setLocationSource("manual");
      setAddressText(item.address_name || item.place_name);
    }
  };

  const handleSearchSubmit = async () => {
    if (!searchInput.trim()) return;
    setSearchSuggestions([]);
    setIsSearchFocused(false);
    try {
      const res = await fetch("/api/geocode", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: searchInput }) });
      const data = await res.json();
      if (data.lat && data.lon) {
        setCoordinates({ lat: data.lat, lon: data.lon });
        setLocationSource("manual");
        setAddressText(data.address || searchInput);
        setSearchInput(data.address || searchInput);
      }
    } catch {}
  };

  const fetchRecommendations = async (isLoadMore: boolean = false) => {
    if (!coordinates || !mbti) return;
    setIsLoading(true); setApiError(null);
    try {
      const response = await fetch("/api/recommend", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          muckBti: mbti, latitude: coordinates.lat, longitude: coordinates.lon,
          groupSize, yesterdayFood, searchRadiusM, location_source: locationSource, addressText: addressText === "위치 확인 중..." ? "" : addressText,
         excludeNames: isLoadMore ? restaurants.map(r => r.name) : [],
          categoryOverride: selectedCategories.length > 0 ? selectedCategories : null
        }),
      });
      if (!response.ok) { const e = await response.json(); throw new Error(e.message || "검색 실패"); }
      const data: RecommendationResponse = await response.json();
      const newR = data.restaurants || [];
      setRestaurants(prev => isLoadMore ? [...prev, ...newR] : newR);
      if (newR.length > 0) addSeenRestaurantsToday(newR.map(r => r.name));
    } catch (e: any) {
      setApiError(e.message || "네트워크 오류");
    } finally { setIsLoading(false); }
  };

  const handleExpandRadius = () => {
  setSearchRadiusM(3000);
  // useEffect가 searchRadiusM 변화를 감지하기 전에 직접 호출
  setTimeout(() => fetchRecommendations(false), 100);
};

  const handleToggleCategory = (cat: string) => {
    setSelectedCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
  };

const handleTestComplete = (testMbti: MuckBti) => {
  setMbti(testMbti);
  localStorage.setItem("muck_bti_v2", JSON.stringify(testMbti));
  // coordinates 없으면 GPS 즉시 요청
  if (!coordinates) {
    requestLocation();
  }
  setTab("resultCard");
};


  const handleProfileUpdate = (updatedMbti: MuckBti) => {
    setMbti(updatedMbti);
    localStorage.setItem("muck_bti_v2", JSON.stringify(updatedMbti));
  };

  const clearShareAndStartTest = () => {
    window.history.replaceState({}, document.title, window.location.pathname);
    setSharedMbti(null); setTab("test");
  };

  const activeCharacter = mbti ? getMatchedCharacter(mbti) : null;
  const sharedCharacter = sharedMbti ? getMatchedCharacter(sharedMbti) : null;
  const sky = getSkyBg();
  const heroSubtitle = HERO_SUBTITLES[sky.label] || "당신을 위한 퍼스널 맛집 추천";

  return (
    <div className={`min-h-screen bg-gradient-to-b ${sky.from} text-[#1A1A2E] flex flex-col font-sans pb-24`} id="theme-root">

      /* ── 헤더 ── */
      <header className="w-full max-w-md mx-auto sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-white/40 shadow-sm">
        <div className="px-5 pt-4 pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <p className="text-[10px] font-semibold text-gray-400 tracking-widest uppercase leading-none mb-1">
                {heroSubtitle}
              </p>
              <h1 className="text-[22px] font-extrabold text-[#1A1A2E] tracking-tight leading-tight">
                오늘 뭐 먹지?
              </h1>
            </div>
            {activeCharacter && (
              <span className="text-2xl select-none pt-1">{activeCharacter.emoji}</span>
            )}
          </div>

          /* 검색창 */
          {(tab === "recommend" || tab === "test" || tab === "resultCard") && (
            <div className="mt-3 relative">
              <div className={`flex items-center gap-2 bg-gray-50 border rounded-2xl px-3 py-2.5 transition-all ${isSearchFocused ? "border-[#3182F6] bg-white ring-1 ring-[#3182F6]/20" : "border-gray-200"}`}>
                <MapPin className="w-3.5 h-3.5 text-[#3182F6] shrink-0" />
                <input
                  ref={searchRef}
                  type="text"
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setTimeout(() => setIsSearchFocused(false), 150)}
                  onKeyDown={e => { if (e.key === "Enter") handleSearchSubmit(); }}
                  placeholder="동네, 지하철역, 장소 검색..."
                  className="flex-1 text-[13px] font-medium text-gray-800 placeholder-gray-400 bg-transparent outline-none"
                />
                {searchInput && (
                  <button type="button" onClick={() => { setSearchInput(""); setSearchSuggestions([]); }}>
                    <X className="w-3.5 h-3.5 text-gray-400" />
                  </button>
                )}
                <button type="button" onClick={handleSearchSubmit} className="text-[#3182F6]">
                  <Search className="w-4 h-4" />
                </button>
              </div>

              /* 자동완성 드롭다운 */
              {isSearchFocused && searchSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden z-50">
                  {searchSuggestions.slice(0, 6).map((item, i) => (
                    <button
                      key={i} type="button"
                      onMouseDown={() => handleSearchSelect(item)}
                      className="w-full flex items-start gap-2.5 px-4 py-3 hover:bg-gray-50 text-left border-b border-gray-50 last:border-0"
                    >
                      <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[13px] font-semibold text-gray-800">{item.place_name}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">{item.address_name}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      /* ── 메인 ── */
      <main className="flex-1 w-full max-w-md mx-auto px-4 pt-4 pb-6 flex flex-col gap-4">

         /* 공유 결과 */
        {tab === "sharedResult" && sharedCharacter && sharedMbti && (
  <div className="w-full flex flex-col gap-4">
    {/* 상단 안내 배너 — 공유 링크 클릭 시 처음 보이는 화면 */}
    <div className="bg-gradient-to-br from-[#e8f3ff] to-[#f0f7ff] rounded-[24px] p-5 border border-blue-100 text-center flex flex-col gap-2">
      <span className="text-3xl">{sharedCharacter.emoji}</span>
      <h2 className="text-lg font-extrabold text-gray-900 tracking-tight">
        친구의 먹BTI 카드
      </h2>
      <p className="text-sm text-[#3182F6] font-bold">{sharedCharacter.name}</p>
      <p className="text-xs text-gray-500 leading-relaxed mt-1">
        친구가 공유한 먹BTI 카드예요.<br />
        아래에서 카드를 확인하고, 나도 30초만에 검사해보세요!
      </p>
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


        {/* 검사 */}
        {tab === "test" && (
          <div className="w-full">
            <div className="text-center mb-5 select-none animate-fade-in">
              <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">나의 먹BTI 검사하기</h2>
              <p className="text-sm text-gray-500 mt-1">30초면 충분해요 😊</p>
            </div>
            <MuckBtiTest onComplete={handleTestComplete} />
          </div>
        )}

        {/* 결과 카드 */}
        {tab === "resultCard" && activeCharacter && mbti && (
          <div className="w-full flex flex-col gap-4 animate-fade-in">
            <div className="text-center select-none">
              <span className="text-3xl">🥳</span>
              <h2 className="text-xl font-extrabold text-gray-900 mt-1.5 tracking-tight">먹BTI 결과!</h2>
              <p className="text-xs text-gray-400 mt-1">이 성향으로 주변 맛집을 추천합니다</p>
            </div>
            <CharacterCard character={activeCharacter} mbti={mbti} onRestart={() => setTab("test")} onExplore={() => setTab("recommend")} />
          </div>
        )}

        {/* MY 프로필 */}
        {tab === "profile" && mbti && (
          <div className="w-full overflow-y-auto max-h-[calc(100vh-160px)]">
            <div className="text-center mb-4 select-none">
              <h2 className="text-lg font-extrabold text-white drop-shadow-sm">성향 직접 조절</h2>
              <p className="text-xs text-white/80 mt-1">재검사 없이 바로 바꿀 수 있어요</p>
            </div>
            <MyProfile initialMbti={mbti} onUpdate={handleProfileUpdate} gpsEnabled={gpsEnabled} onToggleGps={() => setGpsEnabled(prev => !prev)} />
            <button type="button" onClick={() => setTab("test")} className="w-full mt-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold text-xs rounded-2xl transition-all">
              처음부터 다시 검사하기
            </button>
          </div>
        )}

        {/* 추천 탭 */}
        {tab === "recommend" && mbti && activeCharacter && (
          <div className="w-full flex flex-col gap-4 animate-fade-in">

            {/* 상황 필터 토글 */}
            {!isFiltersExpanded ? (
              <button
                type="button"
                onClick={() => setIsFiltersExpanded(true)}
                className="w-full bg-white/80 backdrop-blur-sm rounded-2xl px-4 py-3 border border-white/60 shadow-sm flex items-center gap-3 hover:bg-white transition-all text-left"
              >
                <div className="w-8 h-8 bg-[#EEF4FF] rounded-xl flex items-center justify-center shrink-0">
                  <Sliders className="w-4 h-4 text-[#3182F6]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-gray-400 font-semibold">시간 · 인원 · 제외 · 반경</p>
                  <p className="text-[13px] font-bold text-gray-800 mt-0.5 truncate">
                    {mealType} · {groupSize} · {searchRadiusM >= 1000 ? `${(searchRadiusM/1000).toFixed(1)}km` : `${searchRadiusM}m`}
                    {yesterdayFood ? ` · 제외 ${yesterdayFood}` : ""}
                  </p>
                </div>
                <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
              </button>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-fade-in">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
                  <span className="text-[12px] font-bold text-gray-700">상황 필터</span>
                  <button type="button" onClick={() => setIsFiltersExpanded(false)} className="text-[11px] text-[#3182F6] font-semibold">닫기</button>
                </div>
                <div className="px-4 py-4 flex flex-col gap-4">

                  {/* 시간 */}
                  <div>
                    <p className="text-[10px] text-gray-400 font-semibold mb-2">⏰ 시간</p>
                    <div className="flex gap-2">
                      {(["아침","점심","저녁","야식"] as const).map(t => (
                        <button key={t} type="button" onClick={() => setMealType(t)}
                          className={`flex-1 py-2 text-[12px] font-bold rounded-xl transition-all ${mealType===t ? "bg-[#3182F6] text-white" : "bg-gray-50 text-gray-500 hover:bg-gray-100"}`}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 인원 */}
                  <div>
                    <p className="text-[10px] text-gray-400 font-semibold mb-2">👥 인원</p>
                    <div className="flex gap-2">
                      {(["1인","2~3인","4인이상"] as const).map(s => (
                        <button key={s} type="button" onClick={() => setGroupSize(s)}
                          className={`flex-1 py-2 text-[12px] font-bold rounded-xl border transition-all ${groupSize===s ? "border-[#3182F6] bg-[#EEF4FF] text-[#3182F6]" : "border-gray-100 bg-gray-50 text-gray-500"}`}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 제외 */}
                  <div>
                    <p className="text-[10px] text-gray-400 font-semibold mb-2">🚫 제외 메뉴</p>
                    <input
                      type="text" value={yesterdayFood}
                      onChange={e => setYesterdayFood(e.target.value)}
                      placeholder="예: 삼겹살, 피자"
                      className="w-full bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5 text-[12px] font-medium text-gray-800 placeholder-gray-300 outline-none focus:ring-1 focus:ring-[#3182F6] focus:bg-white transition-all"
                    />
                  </div>

                  {/* 반경 */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-[10px] text-gray-400 font-semibold">📍 반경</p>
                      <span className="text-[12px] font-bold text-[#3182F6]">
                        {searchRadiusM >= 1000 ? `${(searchRadiusM/1000).toFixed(1)}km` : `${searchRadiusM}m`}
                      </span>
                    </div>
                    <input type="range" min="0" max="6" step="1"
                      value={[100,300,500,1000,1500,2000,3000].indexOf(searchRadiusM) >= 0 ? [100,300,500,1000,1500,2000,3000].indexOf(searchRadiusM) : 3}
                      onChange={e => { const r=[100,300,500,1000,1500,2000,3000]; setSearchRadiusM(r[parseInt(e.target.value)]); }}
                      className="w-full h-1.5 bg-gray-100 rounded-full appearance-none cursor-pointer accent-[#3182F6]"
                    />
                    <div className="flex justify-between text-[9px] text-gray-300 mt-1">
                      <span>100m</span><span>300</span><span>500</span><span>1km</span><span>1.5</span><span>2km</span><span>3km</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 에러 */}
            {apiError && (
              <div className="bg-red-50 border border-red-100 text-red-600 text-[12px] p-3.5 rounded-2xl flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <p className="font-medium">{apiError}</p>
              </div>
            )}

            <RecommendationList
              restaurants={restaurants} isLoading={isLoading}
              onExpandRadius={handleExpandRadius}
              onRefresh={() => fetchRecommendations(false)}
              onLoadMore={() => fetchRecommendations(true)}
              radiusM={searchRadiusM}
              selectedCategories={selectedCategories}
              onToggleCategory={handleToggleCategory}
            />
          </div>
        )}
      </main>

      {/* ── 하단 네비 ── */}
      {tab !== "sharedResult" && (
        <nav className="w-full max-w-md mx-auto bg-white/95 backdrop-blur-md border-t border-gray-100 flex py-3 px-8 justify-around fixed bottom-0 left-0 right-0 z-40 shadow-lg">
          <button type="button"
            onClick={() => { if (!mbti) { alert("먹BTI 검사를 먼저 완료해주세요!"); return; } setTab("recommend"); }}
            className={`flex flex-col items-center gap-1 transition-all ${tab==="recommend" ? "text-[#3182F6]" : "text-gray-300 hover:text-gray-500"}`}>
            <Utensils className="w-5 h-5" />
            <span className="text-[10px] font-bold">오늘의 추천</span>
          </button>
          <button type="button"
            onClick={() => { if (!mbti) { alert("먹BTI 검사를 먼저 완료해주세요!"); return; } setTab("profile"); }}
            className={`flex flex-col items-center gap-1 transition-all ${tab==="profile" ? "text-[#3182F6]" : "text-gray-300 hover:text-gray-500"}`}>
            <Sliders className="w-5 h-5" />
            <span className="text-[10px] font-bold">성향 조절</span>
          </button>
        </nav>
      )}
    </div>
  );
}