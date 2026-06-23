/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { AlertTriangle, MapPin, ChevronDown, Check, Compass, Globe, Search, Loader2 } from "lucide-react";

interface LocationBannerProps {
  locationSource: "gps" | "ip_estimated" | "manual";
  currentAddress: string;
  onSelectLocation: (lat: number, lon: number, name: string, source: "gps" | "manual") => void;
  onRequestGps: () => void;
  onTextSearchLocation: (query: string) => Promise<boolean>;
}

export interface PresetLocation {
  name: string;
  lat: number;
  lon: number;
  description: string;
}

export const presetLocations: PresetLocation[] = [
  { name: "강남역 삼거리 인근", lat: 37.4979, lon: 127.0276, description: "강남구 역삼역/서초구 맛집 탐방" },
  { name: "홍대 마포 걷고싶은거리", lat: 37.5575, lon: 126.9244, description: "마포구 서교동/연남동 트렌디 먹거리" },
  { name: "여의도역 파이낸스 빌딩", lat: 37.5216, lon: 126.9242, description: "여의도동 더현대/직장가 든든식탁" },
  { name: "판교 테크노밸리 광장", lat: 37.3948, lon: 127.1111, description: "삼평동 직장 동료 점심/회식투어" },
  { name: "신사 가로수길 초입", lat: 37.5164, lon: 127.0205, description: "신사동 골목 퓨전/이태리 감성맛집" },
  { name: "부산 해운대역 광장", lat: 35.1631, lon: 129.1589, description: "해운대 해산물과 얼큰 물안주 탐미" }
];

export default function LocationBanner({
  locationSource,
  currentAddress,
  onSelectLocation,
  onRequestGps,
  onTextSearchLocation
}: LocationBannerProps) {
  const [showDropdown, setShowDropdown] = useState<boolean>(false);
  const [textQuery, setTextQuery] = useState<string>("");
  const [isGeocoding, setIsGeocoding] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState<boolean>(false);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const [debouncedQuery, setDebouncedQuery] = useState<string>("");

  // Debounce 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(textQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [textQuery]);

  // 자동완성 API 호출 - onChange 시 (검색 버튼 불필요)
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const fetchSuggestions = async () => {
      setIsFetchingSuggestions(true);
      try {
        const res = await fetch(`/api/autocomplete?q=${encodeURIComponent(debouncedQuery)}`);
        const data = await res.json();
        setSuggestions(data.items || []);
        setShowSuggestions(true);
      } catch (err) {
        console.error("Autocomplete failed", err);
        setSuggestions([]);
      } finally {
        setIsFetchingSuggestions(false);
      }
    };

    fetchSuggestions();
  }, [debouncedQuery]);

  const handleSearchSubmit = async (queryToSearch: string = textQuery) => {
    if (!queryToSearch.trim()) return;
    setIsGeocoding(true);
    setSearchError(null);
    setShowSuggestions(false);
    
    try {
      const success = await onTextSearchLocation(queryToSearch);
      if (success) {
        setTextQuery("");
      } else {
        setSearchError("검색어에 부합하는 중심 정보를 획득하지 못했습니다.");
      }
    } catch (err) {
      setSearchError("통신 중 오류가 발생했습니다.");
    } finally {
      setIsGeocoding(false);
    }
  };

  if (isCollapsed) {
    return (
      <div className="w-full flex flex-col gap-2.5" id="location-banner-collapsed">
        <button
          type="button"
          onClick={() => setIsCollapsed(false)}
          className="w-full bg-white rounded-[24px] p-4.5 border border-gray-150/50 shadow-sm flex items-center justify-between hover:bg-gray-50 active:scale-[0.99] transition-all text-left"
          id="expand-location-trigger"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
              <MapPin className="w-5 h-5 text-[#3182F6]" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">추천 탐색 위치</h4>
              <p className="text-sm font-extrabold text-[#333D4B] mt-1 max-w-[200px] md:max-w-xs truncate">
                {currentAddress || "전국 맛집 탐색 중"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 bg-[#F2F8FF] px-2.5 py-1.5 rounded-full text-xs font-bold text-[#3182F6]">
            <span>위치 변경</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </div>
        </button>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-2.5" id="location-banner-panel">
      {/* Top Warning Banner if Location is IP-estimated or manual */}
      {locationSource === "ip_estimated" && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs px-4 py-3 rounded-2xl flex items-center justify-between gap-3 animate-fade-in" id="ip-warning-banner">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4.5 h-4.5 text-amber-500 shrink-0" />
            <span className="font-semibold leading-relaxed">
              정확한 기기 GPS 위치를 불러오지 못해 <b>IP 추정 위치</b>로 설정되었습니다. 정확한 미식 추천을 위해 희망 지역을 직접 선택해주세요!
            </span>
          </div>
          <button
            type="button"
            id="gps-retry-btn"
            onClick={onRequestGps}
            className="text-[10px] bg-amber-600 font-bold hover:bg-amber-700 text-white px-2.5 py-1.5 rounded-lg shrink-0 select-none cursor-pointer"
          >
            GPS 활성화
          </button>
        </div>
      )}

      {/* Main Location selector control */}
      <div className="bg-white rounded-[32px] p-5 border border-gray-150/50 shadow-sm flex flex-col gap-3 relative">
        <div className="flex justify-between items-center pb-2 border-b border-gray-100/60">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-[#3182F6] shrink-0" />
            <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">현재 추천 중심 위치</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsCollapsed(true)}
              className="flex items-center gap-0.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold px-2.5 py-1 rounded-full text-[10.5px] transition-all cursor-pointer mr-1"
            >
              <span>접어두기</span>
              <ChevronDown className="w-3.5 h-3.5 rotate-180" />
            </button>
            {locationSource === "gps" ? (
              <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold border border-emerald-100 flex items-center gap-0.5 px-2 py-0.5 rounded-full font-mono">
                <Compass className="w-2.5 h-2.5" strokeWidth={3} /> REAL GPS
              </span>
            ) : locationSource === "ip_estimated" ? (
              <span className="text-[10px] bg-amber-50 text-amber-600 font-bold border border-amber-100 flex items-center gap-0.5 px-2 py-0.5 rounded-full font-mono">
                <Globe className="w-2.5 h-2.5" /> IP EST
              </span>
            ) : (
              <span className="text-[10px] bg-blue-50 text-blue-600 font-bold border border-blue-100 flex items-center gap-0.5 px-2 py-0.5 rounded-full font-mono">
                MANUAL REGION
              </span>
            )}
          </div>
        </div>

        {/* Selected target address trigger */}
        <div
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex justify-between items-center p-3.5 bg-[#F9FAFB] hover:bg-gray-100/60 rounded-[20px] border border-gray-150 cursor-pointer select-none transition-all"
        >
          <span className="text-[14px] font-bold text-gray-800 tracking-tight block truncate">
            {currentAddress || "전국 가상 맛집 매장 반경"}
          </span>
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showDropdown ? "rotate-180" : ""}`} />
        </div>

        {/* Keyboard Input Search Field - Toss-style aesthetic search bar */}
        <div className="flex flex-col gap-1.5 mt-1 relative" id="address-keyboard-search-control">
          <span className="text-[11px] font-bold text-gray-400 px-1">직접 원하는 동네/지역 검색하기 (키보드 입력)</span>
          <div className="flex gap-2 relative">
            <input
              type="text"
              value={textQuery}
              onChange={(e) => {
                setTextQuery(e.target.value);
                if (showDropdown) setShowDropdown(false);
              }}
              onFocus={() => {
                if (showDropdown) setShowDropdown(false);
                if (suggestions.length > 0 && textQuery.trim()) setShowSuggestions(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSearchSubmit(textQuery);
                }
              }}
              placeholder="예: 마포 망원동, 부산 서면, 속초, 강남역 등"
              className="flex-1 bg-[#F9FAFB] hover:bg-gray-150/40 focus:bg-white focus:ring-1 focus:ring-[#3182F6] px-4 py-3 rounded-[20px] text-xs font-semibold text-gray-800 placeholder-gray-400 border border-gray-150 outline-none transition-all"
              id="address-keyboard-input"
            />
            {isFetchingSuggestions && (
               <Loader2 className="w-4 h-4 absolute right-20 top-3.5 text-gray-400 animate-spin" />
            )}
            <button
              type="button"
              onClick={() => handleSearchSubmit(textQuery)}
              disabled={isGeocoding || !textQuery.trim()}
              className="px-4.5 bg-[#3182F6] hover:bg-[#1b64da] disabled:bg-gray-200 text-white font-bold text-xs rounded-[20px] flex items-center gap-1.5 transition-all shrink-0 shadow-sm cursor-pointer"
              id="address-keyboard-btn"
            >
              <Search className="w-3.5 h-3.5" />
              <span>{isGeocoding ? "검색 중.." : "검색"}</span>
            </button>
          </div>

          {/* Autocomplete Dropdown - 검색 버튼 클릭 후에만 표시 */}
          {showSuggestions && textQuery.trim().length > 0 && (
            <div className="absolute top-[65px] left-0 w-full bg-white border border-gray-150 rounded-2xl shadow-xl z-40 overflow-hidden flex flex-col divide-y divide-gray-100 animate-fade-in">
              <div className="p-3 bg-gray-50/50 text-[10px] text-gray-400 font-bold uppercase tracking-wider relative z-30">
                장소 제안 / 자동완성
              </div>
              {suggestions.length === 0 && !isFetchingSuggestions ? (
                <div className="p-5 text-sm text-gray-500 font-medium text-center">검색 결과 없음</div>
              ) : (
                suggestions.map((sg, idx) => {
                  const shortCategory = sg.category_name ? sg.category_name.split(" > ").pop() : "";
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                         onSelectLocation(sg.lat, sg.lon, sg.place_name, "manual");
                         setTextQuery("");
                         setShowSuggestions(false);
                         setShowDropdown(false);
                      }}
                      className="w-full text-left p-4 hover:bg-blue-50/30 flex justify-between items-center transition-all cursor-pointer relative z-30">
                      <div className="flex-1 min-w-0 pr-2">
                        <span className="text-sm font-bold text-[#333D4B] block truncate">{sg.place_name}</span>
                        <span className="text-xs text-gray-400 block font-normal mt-0.5 leading-normal truncate">{sg.address_name}</span>
                      </div>
                      <div className="shrink-0 text-[10px] text-gray-400 font-medium">
                        {shortCategory}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          )}

          {searchError && (
            <span className="text-[10px] text-red-500 font-semibold px-1 mt-0.5">{searchError}</span>
          )}
        </div>

        {/* Dropdown list of preset regions for manual selection */}
        {showDropdown && (
          <>
            <div 
              className="fixed inset-0 z-20 bg-transparent" 
              onClick={() => setShowDropdown(false)} 
            />
            <div className="absolute top-[102%] left-0 w-full bg-white border border-gray-150 rounded-2xl shadow-xl z-30 overflow-hidden flex flex-col divide-y divide-gray-100 animate-fade-in">
              <div className="p-3 bg-gray-50/50 text-[10px] text-gray-400 font-bold uppercase tracking-wider relative z-30">
                다른 대표 미식 구역 선택하기
              </div>
              {presetLocations.map((loc) => {
                const works = currentAddress.includes(loc.name.slice(0, 3));
                return (
                  <button
                    key={loc.name}
                    type="button"
                    id={`preset-loc-${loc.name.replace(/\s+/g, "-")}`}
                    onClick={() => {
                      onSelectLocation(loc.lat, loc.lon, loc.name, "manual");
                      setShowDropdown(false);
                    }}
                    className="w-full text-left p-4 hover:bg-blue-50/30 flex justify-between items-center transition-all cursor-pointer relative z-30"
                  >
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-bold text-gray-800 block truncate">{loc.name}</span>
                      <span className="text-xs text-gray-400 block font-normal mt-0.5 leading-normal">{loc.description}</span>
                    </div>
                    {works && <Check className="w-4 h-4 text-[#3182F6] shrink-0 stroke-[3px]" />}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
