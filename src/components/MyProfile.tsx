/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Character, MuckBti } from "../types";
import { getMatchedCharacter } from "../characters";
import { Sliders, ChevronRight, Check, Heart, HelpCircle, Award, Share2 } from "lucide-react";

interface MyProfileProps {
  initialMbti: MuckBti;
  onUpdate: (updated: MuckBti) => void;
  gpsEnabled: boolean;
  onToggleGps: () => void;
}

interface SliderNode {
  key: keyof Omit<MuckBti, "health">;
  label: string;
  emoji: string;
  minLabel: string;
  maxLabel: string;
}

export default function MyProfile({ initialMbti, onUpdate, gpsEnabled, onToggleGps }: MyProfileProps) {
  const [localMbti, setLocalMbti] = useState<MuckBti>(initialMbti);
  const [character, setCharacter] = useState<Character>(getMatchedCharacter(initialMbti));
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    setLocalMbti(initialMbti);
    setCharacter(getMatchedCharacter(initialMbti));
  }, [initialMbti]);

const nodes: SliderNode[] = [
  { key: "spicy", label: "⚡ 자극 강도", emoji: "⚡", minLabel: "순한맛", maxLabel: "짜릿한 MSG맛" },
  { key: "fullness", label: "🍚 포만감 규모", emoji: "🍚", minLabel: "가볍게", maxLabel: "든든배불" },
  { key: "meatVeg", label: "🥩 고기 vs 🥗 야채", emoji: "🥩", minLabel: "야채중심", maxLabel: "고기중심" },
  { key: "speed", label: "⏱️ 식사 속도/여유", emoji: "⏱️", minLabel: "신속히", maxLabel: "느긋하게" },
  { key: "drink", label: "🍻 가벼운 반주 빈도", emoji: "🍻", minLabel: "식사만", maxLabel: "반주필수" },
];

  const handleSliderChange = (key: keyof Omit<MuckBti, "health">, value: number) => {
    const updated = { ...localMbti, [key]: value };
    setLocalMbti(updated);

    const nextChar = getMatchedCharacter(updated);
    if (nextChar.id !== character.id) {
      setToastMessage(`먹BTI 요정이 움직여 [${nextChar.name}] 캐릭터로 바뀌었어요! ✨`);
      setCharacter(nextChar);
      setTimeout(() => setToastMessage(null), 3000);
    }

    onUpdate(updated);
  };

  const handleHealthSelect = (health: MuckBti["health"]) => {
    const updated = { ...localMbti, health };
    setLocalMbti(updated);

    const nextChar = getMatchedCharacter(updated);
    if (nextChar.id !== character.id) {
      setToastMessage(`건강 계획 조정으로 [${nextChar.name}] 성향이 활성화되었어요! 🎯`);
      setCharacter(nextChar);
      setTimeout(() => setToastMessage(null), 3000);
    }

    onUpdate(updated);
  };

  const getSharingUrl = () => {
    const params = [
      localMbti.spicy,
      localMbti.fullness,
      localMbti.meatVeg,
      localMbti.speed,
      localMbti.drink,
      localMbti.health
    ].join(",");
    const baseUrl = window.location.origin + window.location.pathname;
    return `${baseUrl}?mbti=${params}`;
  };

 const handleShare = async () => {
    const shareUrl = getSharingUrl();

    // 1순위: 네이티브 공유 시트 (모바일에서 카톡/메시지 등 선택 가능)
    if (navigator.share) {
      try {
        await navigator.share({
          title: "나의 먹BTI",
          text: `나의 먹BTI는 [${character.name}]래! 너도 확인해봐 👀`,
          url: shareUrl,
        });
        return; // 공유 성공/취소와 무관하게 여기서 종료
      } catch (err) {
        // 사용자가 취소했거나 지원 안 되면 아래 클립보드 복사로 폴백
      }
    }

    // 2순위: 클립보드 복사 (PC 등 navigator.share 미지원 환경)
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const el = document.createElement("input");
        el.value = shareUrl;
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy share link:", err);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-[32px] p-6 shadow-sm border border-gray-150/50 flex flex-col gap-6 animate-fade-in" id="my-profile-panel">
      {/* Current character overview indicator */}
      <div className="flex items-center gap-4 p-4.5 bg-[#F4F9FF] rounded-[24px] border border-blue-100/40">
        <span className="text-4xl select-none">{character.emoji}</span>
        <div className="flex-1">
          <span className="text-[10px] text-[#3182F6] font-bold uppercase tracking-wider block font-mono">My matched character</span>
          <h2 className="text-lg font-bold text-gray-900 leading-tight">{character.name}</h2>
          <p className="text-xs text-gray-500 mt-1 leading-tight font-normal">아래 슬라이더를 즉시 조절해 성향을 바꿀 수 있어요.</p>
        </div>
      </div>

      {/* Share button */}
      <button
        type="button"
        onClick={handleShare}
        className="w-full py-3 bg-[#e8f3ff] hover:bg-[#d0e7ff] text-[#3182F6] font-semibold text-sm rounded-[16px] flex items-center justify-center gap-2 transition-all"
      >
        <Share2 className="w-4 h-4" /> 친구에게 공유
      </button>

      {/* Grid of Sliders for direct tuning */}
      <div>
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-1.5 px-1">
          <Sliders className="w-3.5 h-3.5 text-[#3182F6]" /> 개별 성향 미세 조정
        </h3>

        <div className="flex flex-col gap-5.5">
          {nodes.map((node) => {
            const val = localMbti[node.key] as number;
            return (
              <div key={node.key} className="flex flex-col gap-1.5" id={`mmypage-slider-${node.key}`}>
                <div className="flex justify-between items-center px-1">
                  <span className="text-[13px] font-bold text-gray-800">{node.label}</span>
                  <span className="text-[13px] font-bold text-[#3182F6] font-mono">{val} <span className="text-[10px] text-gray-300">/ 5</span></span>
                </div>

                <div className="flex items-center gap-2.5">
                  <span className="text-[10px] text-gray-400 font-medium font-sans w-11 text-left">{node.minLabel}</span>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    step="1"
                    value={val}
                    onChange={(e) => handleSliderChange(node.key, parseInt(e.target.value))}
                    className="flex-1 h-1.5 bg-gray-100 rounded-full appearance-none cursor-pointer accent-[#3182F6] outline-none"
                  />
                  <span className="text-[10px] text-gray-400 font-medium font-sans w-11 text-right">{node.maxLabel}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between p-4 bg-[#F9FAFB] rounded-[20px] border border-gray-150/40">
        <div>
          <span className="text-sm font-bold text-gray-800">📍 GPS 위치 자동 사용</span>
          <p className="text-xs text-gray-400 mt-0.5">끄면 직접 입력한 위치만 사용해요</p>
        </div>
        <button
          type="button"
          onClick={onToggleGps}
          className={`w-11 h-6 rounded-full transition-all relative ${gpsEnabled ? "bg-[#3182F6]" : "bg-gray-300"}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-all ${gpsEnabled ? "translate-x-5" : ""}`} />
        </button>
      </div>

      <div>
        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1.5 px-1">
          <Heart className="w-3.5 h-3.5 text-green-500" /> 건강 지침선 변경
        </h4>
        <div className="grid grid-cols-2 gap-2">
          {[
            { id: "none", label: "🥗 자유식단" },
            { id: "loss", label: "🏃 가벼운 다이어트" },
            { id: "gain", label: "💪 고단백 벌크업" },
            { id: "sugar", label: "🩸 식이 및 혈당조절" }
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              className={`py-3.5 px-3.5 text-xs text-center font-bold border rounded-[16px] transition-all ${
                localMbti.health === item.id
                  ? "border-[#3182F6] bg-[#f2f8ff] text-[#3182F6] ring-1 ring-[#3182F6]/30"
                  : "border-gray-200 bg-[#F9FAFB] hover:bg-gray-50 text-gray-500"
              }`}
              onClick={() => handleHealthSelect(item.id as MuckBti["health"])}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-gray-900/95 text-white text-xs px-5 py-3.5 rounded-2xl shadow-xl flex items-center gap-2 animate-fade-in z-50 border border-gray-800">
          <b className="text-amber-400">Toss</b>
          <span className="font-semibold text-gray-100">{toastMessage}</span>
        </div>
      )}

      {copied && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-gray-900/95 text-white text-xs px-5 py-3 rounded-2xl shadow-lg flex items-center gap-2 animate-fade-in z-50">
          <Check className="w-4 h-4 text-emerald-400 stroke-[3px]" />
          <span className="font-semibold">친구 유입 공유 링크가 복사되었습니다!</span>
        </div>
      )}
    </div>
  );
}