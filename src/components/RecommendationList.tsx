/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { RecommendedRestaurant } from "../types";
import { ExternalLink, Star, Footprints, RefreshCw, Compass, ArrowRight } from "lucide-react";

interface RecommendationListProps {
  restaurants: RecommendedRestaurant[];
  isLoading: boolean;
  onExpandRadius: () => void;
  onRefresh: () => void;
  radiusM: number;
}

export default function RecommendationList({
  restaurants,
  isLoading,
  onExpandRadius,
  onRefresh,
  radiusM
}: RecommendationListProps) {
  const hasItems = restaurants && restaurants.length > 0;

  if (isLoading && !hasItems) {
    return (
      <div className="w-full text-center py-16 flex flex-col justify-center items-center gap-4 animate-pulse">
        <div className="w-12 h-12 rounded-full border-4 border-[#e8f3ff] border-t-[#3182F6] animate-spin" />
        <div>
          <h3 className="text-base font-bold text-gray-850 tracking-tight">먹BTI 알고리즘 분석 중</h3>
          <p className="text-xs text-gray-400 mt-1">실존 주변매장을 네이버 지도로 연동 중입니다...</p>
        </div>
      </div>
    );
  }

  if (!isLoading && restaurants.length === 0) {
    return (
      <div className="w-full bg-white border border-gray-150 rounded-3xl p-8 text-center flex flex-col items-center justify-center gap-4 animate-fade-in" id="empty-restaurants-panel">
        <span className="text-4xl">🔍</span>
        <div>
          <h3 className="text-base font-bold text-gray-800 tracking-tight">선택한 반경 주변에 식당이 없어요</h3>
          <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto leading-relaxed">
            현재 <b>{(radiusM / 1000).toFixed(1)}km</b> 반경 내에 기호에 꼭 맞는 식당이 검색되지 않았습니다. 반경 범위를 넓혀볼까요?
          </p>
        </div>
        <button
          type="button"
          id="expand-radius-btn"
          onClick={onExpandRadius}
          className="py-3 px-5 bg-[#3182F6] hover:bg-[#1b64da] text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
        >
          검색 반경을 3km로 극대화하기 <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-6" id="restaurants-container">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-base font-bold text-gray-850 tracking-tight flex items-center gap-1.5">
          <Compass className="w-4 h-4 text-[#3182F6]" /> 엄선 맛집 BEST {restaurants.length}
          {isLoading && (
            <span className="inline-flex items-center gap-1 text-[10px] text-[#3182F6] font-bold bg-[#e8f3ff] px-2 py-0.5 rounded-full animate-pulse ml-2">
              <RefreshCw className="w-2.5 h-2.5 animate-spin" /> 업데이트 중...
            </span>
          )}
        </h2>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          className="flex items-center gap-1 text-[10px] text-[#3182F6] font-bold disabled:text-gray-300 cursor-pointer transition-all"
        >
          <RefreshCw className={`w-3 h-3 ${isLoading ? "animate-spin" : ""}`} />
          <span>다시 검색</span>
        </button>
      </div>

      <div className={`flex flex-col gap-4 transition-all duration-300 ${isLoading ? "opacity-40 pointer-events-none scale-[0.995]" : "opacity-100"}`}>
        {restaurants.map((rest, index) => {
          return (
            <div
              key={rest.name}
              id={`restaurant-card-${index}`}
              className="bg-white rounded-[32px] p-5.5 border border-gray-150/50 shadow-sm flex flex-col gap-4 hover:shadow-md transition-all duration-200 animate-fade-in"
              style={{ animationDelay: `${index * 0.15}s` }}
            >
              <div className="flex justify-between items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span 
                      className="text-xs bg-gray-50 border border-gray-100 px-2 py-0.5 rounded-lg text-gray-500 font-bold font-sans"
                    >
                      {rest.category}
                    </span>
                    {rest.verified_rating && (
                      <span 
                        className="text-xs bg-amber-50 border border-amber-100 text-amber-600 font-bold px-1.5 py-0.5 rounded-lg flex items-center gap-0.5 font-mono"
                        id={`rating-${rest.name}`}
                      >
                        <Star className="w-3 h-3 fill-amber-500 text-amber-500" /> {rest.verified_rating}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 tracking-tight mt-1.5 truncate">
                    {rest.name}
                  </h3>
                </div>

                <div className="text-right shrink-0 flex flex-col items-end" id={`distance-indicator-${rest.name}`}>
                  <span className="text-[20px] font-extrabold text-[#3182F6] tracking-tighter leading-none flex items-baseline gap-0.5">
                    {rest.walk_min}
                    <span className="text-xs font-bold text-[#3182F6] tracking-normal">분</span>
                  </span>
                  <span className="text-[10px] text-gray-400 font-bold flex items-center gap-0.5 mt-0.5 font-mono">
                    <Footprints className="w-2.5 h-2.5" /> {rest.distance_meters}m
                  </span>
                </div>
              </div>

              {rest.verified_photo_url && (
                <div className="w-full h-40 bg-gray-50 rounded-2xl overflow-hidden relative border border-gray-100 shrink-0">
                  <img
                    src={rest.verified_photo_url}
                    alt={rest.name}
                    id={`photo-${rest.name}`}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover transition-transform hover:scale-105"
                  />
                </div>
              )}

              <div className="bg-[#F4F9FF] p-4.5 rounded-[20px] border border-blue-100/30">
                <div className="flex gap-2">
                  <span className="text-[#3182F6] text-xs font-bold bg-[#e8f3ff] w-5 h-5 rounded-md flex items-center justify-center font-mono shrink-0 select-none">Q</span>
                  <p className="text-[13px] text-[#333D4B] font-bold leading-normal truncate">
                    추천 메뉴: <span className="text-[#3182F6] font-extrabold">{rest.recommended_menu}</span>
                  </p>
                </div>
                <p className="text-[13px] text-gray-600 leading-relaxed font-normal mt-2 pl-7 border-l-2 border-blue-150">
                  {rest.toss_comment}
                </p>
              </div>

              <div className="text-[11px] text-gray-400 font-medium leading-relaxed font-sans px-1">
                📍 {rest.address}
              </div>

              <div className="grid grid-cols-2 gap-2 mt-1">
                <a
                  href={rest.kakao_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  id={`kakao-map-link-${rest.name}`}
                  className="py-3 px-3 bg-[#FCF8E3] hover:bg-[#FBEED5] text-yellow-900 font-bold text-xs rounded-[16px] border border-yellow-200/40 flex items-center justify-center gap-1.5 transition-all text-center select-none"
                >
                  카카오맵으로 후기보기 <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <a
                  href={rest.naver_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  id={`naver-map-link-${rest.name}`}
                  className="py-3 px-3 bg-[#E8F5E9] hover:bg-[#C8E6C9] text-emerald-900 font-bold text-xs rounded-[16px] border border-emerald-200/40 flex items-center justify-center gap-1.5 transition-all text-center select-none"
                >
                  네이버지도 정보보기 <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
