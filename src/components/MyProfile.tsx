/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React, { useState, useEffect } from "react";
import { Character, MuckBti } from "../types";
import { getMatchedCharacter } from "../characters";
import { Sliders, ChevronRight, Check, Heart, HelpCircle, Award } from "lucide-react";

interface MyProfileProps {
  initialMbti: MuckBti;
  onUpdate: (updated: MuckBti) => void;
}

interface SliderNode {
  key: keyof Omit<MuckBti, "health">;
  label: string;
  emoji: string;
  minLabel: string;
  maxLabel: string;
}

export default function MyProfile({ initialMbti, onUpdate }: MyProfileProps) {
  const [localMbti, setLocalMbti] = useState<MuckBti>(initialMbti);
  const [character, setCharacter] = useState<Character>(getMatchedCharacter(initialMbti));
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    setLocalMbti(initialMbti);
    setCharacter(getMatchedCharacter(initialMbti));
  }, [initialMbti]);

  const nodes: SliderNode[] = [
    { key: "spicy", label: "🌶️ 맵기 선호 강도", emoji: "🌶️", minLabel: "순한맛", maxLabel: "지옥불핫" },
    { key: "fullness", label: "🍚 포만감 규모", emoji: "🍚", minLabel: "가볍게", maxLabel: "든든배불" },
    { key: "budget", label: "💰 한끼 지출 기조", emoji: "💰", minLabel: "실속형", maxLabel: "플렉스" },
    { key: "distance", label: "🚶 탐방 가능 거리", emoji: "🚶", minLabel: "문 앞(3분)", maxLabel: "어디든(15분)" },
    { key: "speed", label: "⏱️ 식사 속도/여류", emoji: "⏱️", minLabel: "신속히", maxLabel: "티타임여유" },
    { key: "drink", label: "🍻 가벼운 반주 빈도", emoji: "🍻", minLabel: "보리밥파", maxLabel: "소주가친구" }
  ];

  const handleSliderChange = (key: keyof Omit<MuckBti, "health">, value: number) => {
    const updated = { ...localMbti, [key]: value };
    setLocalMbti(updated);

    // Calculate matched character on the fly
    const nextChar = getMatchedCharacter(updated);
    if (nextChar.id !== character.id) {
      // Trigger character change Toast!
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

  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-[32px] p-6 shadow-sm border border-gray-150/50 flex flex-col gap-6 animate-fade-in" id="my-profile-panel">
      {/* Current character overview indicator */}
      <div className="flex items-center gap-4 p-4.5 bg-[#F4F9FF] rounded-[24px] border border-blue-100/40">
        <span className="text-4xl select-none">{character.emoji}</span>
        <div>
          <span className="text-[10px] text-[#3182F6] font-bold uppercase tracking-wider block font-mono">My matched character</span>
          <h2 className="text-lg font-bold text-gray-900 leading-tight">{character.name}</h2>
          <p className="text-xs text-gray-500 mt-1 leading-tight font-normal">아래 슬라이더를 즉시 조절해 성향을 바꿀 수 있어요.</p>
        </div>
      </div>

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

      {/* Health goal adjustment in MYPAGE */}
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

      {/* Matched Character alert popup */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-gray-900/95 text-white text-xs px-5 py-3.5 rounded-2xl shadow-xl flex items-center gap-2 animate-fade-in z-50 border border-gray-800">
          <b className="text-amber-400">Toss</b>
          <span className="font-semibold text-gray-100">{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
