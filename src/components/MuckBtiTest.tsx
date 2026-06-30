/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { MuckBti } from "../types";
import { Sparkles, Flame, Utensils, Gauge, Beer, Scale, Heart } from "lucide-react";

interface MuckBtiTestProps {
  onComplete: (scores: MuckBti) => void;
}

export default function MuckBtiTest({ onComplete }: MuckBtiTestProps) {

 const sliders = [
  {
    key: "spicy" as keyof Omit<MuckBti, "health">,
    title: "⚡ 자극 강도",
    sub: "얼마나 자극적이게 드시나요?",
    minLabel: "순한맛",
    maxLabel: "짜릿한 MSG맛",
  },
  {
    key: "fullness" as keyof Omit<MuckBti, "health">,
    title: "🍚 포만감 규모",
    sub: "식후 포만감, 얼마나 채울까요?",
    minLabel: "가볍게",
    maxLabel: "든든하게",
  },
  {
    key: "meatVeg" as keyof Omit<MuckBti, "health">,
    title: "🥩 고기 vs 🥗 야채",
    sub: "오늘 식사 성향은?",
    minLabel: "야채 중심",
    maxLabel: "고기 중심",
  },
  {
    key: "speed" as keyof Omit<MuckBti, "health">,
    title: "⏱️ 식사 속도",
    sub: "식사할 때 여유 있게 vs 빠르게?",
    minLabel: "신속히",
    maxLabel: "느긋하게",
  },
  {
    key: "drink" as keyof Omit<MuckBti, "health">,
    title: "🍻 음주 반주",
    sub: "식사에 반주를 즐기는 편인가요?",
    minLabel: "식사만",
    maxLabel: "반주 필수",
  },
];

// useState 초기값도 수정
const [mbti, setMbti] = useState<MuckBti>({
  spicy: 3,
  fullness: 3,
  meatVeg: 3,
  speed: 3,
  drink: 3,
  health: "none",
});

  const healthOptions = [
    { id: "none", title: "🥗 자유롭게", desc: "제한 없이 당기는 것" },
    { id: "loss", title: "🏃 칼로리 비우기", desc: "가볍고 건강하게" },
    { id: "gain", title: "💪 고단백 충전", desc: "육류·단백질 위주" },
    { id: "sugar", title: "🩸 혈당 조절", desc: "정갈하고 섬유질 위주" },
  ];

  const handleSlider = (key: keyof Omit<MuckBti, "health">, val: number) => {
    setMbti((prev) => ({ ...prev, [key]: val }));
  };

  const handleHealth = (h: MuckBti["health"]) => {
    setMbti((prev) => ({ ...prev, health: h }));
  };

  return (
    <div className="w-full max-w-md mx-auto flex flex-col gap-5 animate-fade-in" id="muckbti-test-panel">
      {/* 타이틀 */}
      <div className="bg-white/90 backdrop-blur-md rounded-[24px] p-5 border border-gray-100 shadow-sm">
        <h2 className="text-base font-extrabold text-gray-900 tracking-tight mb-0.5">먹BTI 성향 체크</h2>
        <p className="text-xs text-gray-400">슬라이더를 조절해 내 식성을 설정하세요</p>
      </div>

      {/* 슬라이더 5개 한 번에 */}
      <div className="bg-white/90 backdrop-blur-md rounded-[24px] p-5 border border-gray-100 shadow-sm flex flex-col gap-6">
        {sliders.map((s) => {
          const val = mbti[s.key] as number;
          return (
            <div key={s.key} className="flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-[13px] font-bold text-gray-800">{s.title}</span>
                  <p className="text-[11px] text-gray-400 mt-0.5">{s.sub}</p>
                </div>
                <span className="text-xl font-extrabold text-[#3182F6] font-mono ml-3 shrink-0">
                  {val}<span className="text-xs text-gray-300 font-normal">/5</span>
                </span>
              </div>

              <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={val}
                onChange={(e) => handleSlider(s.key, parseInt(e.target.value))}
                className="w-full h-1.5 bg-gray-100 rounded-full appearance-none cursor-pointer accent-[#3182F6] outline-none"
              />

              <div className="flex justify-between text-[10px] text-gray-300 font-medium px-0.5">
                <span>{s.minLabel}</span>
                {/* 점 표시 */}
                <div className="flex gap-3 items-center">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <span
                      key={n}
                      onClick={() => handleSlider(s.key, n)}
                      className={`w-1.5 h-1.5 rounded-full cursor-pointer transition-all ${val === n ? "bg-[#3182F6] scale-150" : "bg-gray-200"}`}
                    />
                  ))}
                </div>
                <span>{s.maxLabel}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 건강 목표 */}
      <div className="bg-white/90 backdrop-blur-md rounded-[24px] p-5 border border-gray-100 shadow-sm">
        <div className="flex items-center gap-1.5 mb-3">
          <Heart className="w-3.5 h-3.5 text-green-500" />
          <h3 className="text-[13px] font-bold text-gray-800">오늘의 건강 목표</h3>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {healthOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => handleHealth(opt.id as MuckBti["health"])}
              className={`flex flex-col items-start p-3 rounded-[16px] border transition-all text-left ${
                mbti.health === opt.id
                  ? "border-[#3182F6] bg-[#f2f8ff]"
                  : "border-gray-150 bg-gray-50 hover:bg-gray-100"
              }`}
            >
              <span className="text-xs font-bold text-gray-800">{opt.title}</span>
              <span className="text-[10px] text-gray-400 mt-0.5">{opt.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 결과 보기 버튼 */}
      <button
        type="button"
        onClick={() => onComplete(mbti)}
        className="w-full py-4 bg-[#3182F6] hover:bg-[#1b64da] text-white font-bold rounded-[20px] flex items-center justify-center gap-2 transition-all shadow-sm text-sm"
      >
        나의 먹BTI 결과 보기 <Sparkles className="w-4 h-4 fill-white text-[#3182F6]" />
      </button>
    </div>
  );
}