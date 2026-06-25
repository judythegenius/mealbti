/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { MuckBti } from "../types";
import { Sparkles, ChevronRight, Flame, Utensils, Gauge, Beer, Heart, Scale } from "lucide-react";

interface MuckBtiTestProps {
  onComplete: (scores: MuckBti) => void;
}

interface Question {
  key: keyof Omit<MuckBti, "health">;
  title: string;
  emoji: string;
  sub: string;
  minLabel: string;
  maxLabel: string;
  icon: React.ReactNode;
}

export default function MuckBtiTest({ onComplete }: MuckBtiTestProps) {
  const [step, setStep] = useState<number>(0);
  const [mbti, setMbti] = useState<MuckBti>({
    spicy: 3,
    fullness: 3,
    salty: 3,
    speed: 3,
    drink: 3,
    health: "none",
  });

  // [수정] 누락되었던 salty(짠맛) 문항을 정식 포지션에 투입
  const questions: Question[] = [
    {
      key: "spicy",
      title: "맵기 강도 선호",
      emoji: "🌶️",
      sub: "평소에 얼만큼 칼칼하고 매콤한 음식을 드시나요?",
      minLabel: "순한맛 (진라면 순한맛)",
      maxLabel: "지옥불맛 (핵불닭볶음면)",
      icon: <Flame className="w-4 h-4 text-red-500" />
    },
    {
      key: "fullness",
      title: "포만감 규모 선호",
      emoji: "🍚",
      sub: "식탁을 다 비우고 났을 때 배부름의 상태는 어느 정도가 좋으신가요?",
      minLabel: "가볍게 한 끼",
      maxLabel: "든든하게 배부르게",
      icon: <Utensils className="w-4 h-4 text-amber-500" />
    },
    {
      key: "salty",
      title: "짠맛 선호 강도",
      emoji: "🧂",
      sub: "평소 음식의 간을 얼마나 세게 해서 드시는 편인가요?",
      minLabel: "슴슴하고 담백하게",
      maxLabel: "짭짤하고 자극적이게",
      icon: <Scale className="w-4 h-4 text-blue-500" />
    },
    {
      key: "speed",
      title: "식사 속도와 여유",
      emoji: "⏱️",
      sub: "평균적으로 한 그릇을 해치우는 식사 무드나 속도는 어떤가요?",
      minLabel: "빛의 속도로 신속히",
      maxLabel: "여유롭게 천천히 만찬",
      icon: <Gauge className="w-4 h-4 text-indigo-500" />
    },
    {
      key: "drink",
      title: "음주 동반 기호",
      emoji: "🍻",
      sub: "평소 가볍거나 풍족한 반주를 한 잔씩 즐겨 곁들이는 편이신가요?",
      minLabel: "식사만 깔끔하게",
      maxLabel: "반주는 무조건 필수",
      icon: <Beer className="w-4 h-4 text-orange-400" />
    }
  ];

  const handleSliderChange = (key: keyof MuckBti, value: number) => {
    setMbti((prev) => ({ ...prev, [key]: value }));
  };

  const handleHealthSelect = (healthValue: MuckBti["health"]) => {
    setMbti((prev) => ({ ...prev, health: healthValue }));
  };

  const handleNext = () => {
    if (step < questions.length) {
      setStep((prev) => prev + 1);
    } else {
      onComplete(mbti);
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep((prev) => prev - 1);
    }
  };

  const progressPercent = Math.round(((step + 1) / (questions.length + 1)) * 100);

  return (
    <div className="w-full max-w-md mx-auto bg-white/90 backdrop-blur-md rounded-[28px] p-6 shadow-sm border border-gray-150/40 flex flex-col justify-between min-h-[480px] animate-fade-in" id="muckbti-test-panel">
      <div>
        <div className="flex justify-between items-center mb-2 px-0.5">
          <span className="text-[10px] font-bold text-[#3182F6] font-mono tracking-wide bg-[#e8f3ff] px-2 py-0.5 rounded-md">
            STEP {step + 1} / {questions.length + 1}
          </span>
          <span className="text-[10px] text-gray-400 font-mono">{progressPercent}%</span>
        </div>
        <div className="w-full h-1 bg-gray-100 rounded-full mb-5 overflow-hidden">
          <div
            className="h-full bg-[#3182F6] rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {step < questions.length ? (
        <div className="flex-1 flex flex-col justify-center my-4">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-lg">{questions[step].emoji}</span>
            <h2 className="text-base font-bold text-gray-800 tracking-tight">{questions[step].title}</h2>
          </div>
          <p className="text-xs text-gray-400 mb-6 font-normal">{questions[step].sub}</p>

          <div className="relative mb-5 bg-gray-50/60 p-5 rounded-2xl border border-gray-100">
            <div className="flex justify-between items-center mb-4">
              <span className="text-[11px] font-medium text-gray-400">선택 점수</span>
              <span className="text-2xl font-bold text-[#3182F6] font-mono">
                {mbti[questions[step].key as keyof MuckBti]}
                <span className="text-xs text-gray-300 font-normal ml-0.5">/ 5</span>
              </span>
            </div>

            <input
              type="range"
              min="1"
              max="5"
              step="1"
              value={mbti[questions[step].key as keyof MuckBti] as number}
              onChange={(e) => handleSliderChange(questions[step].key, parseInt(e.target.value))}
              className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer accent-[#3182F6] outline-none"
            />

            <div className="flex justify-between px-0.5 mt-3">
              {[1, 2, 3, 4, 5].map((val) => (
                <span
                  key={val}
                  onClick={() => handleSliderChange(questions[step].key, val)}
                  className={`text-xs font-mono font-bold cursor-pointer w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                    mbti[questions[step].key as keyof MuckBti] === val
                      ? "bg-[#3182F6] text-white"
                      : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  {val}
                </span>
              ))}
            </div>
          </div>

          <div className="flex justify-between items-center text-[10px] text-gray-400 font-normal px-0.5">
            <span>{questions[step].minLabel}</span>
            <span>{questions[step].maxLabel}</span>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col justify-center my-4">
          <div className="flex items-center gap-2 mb-1.5">
            <h2 className="text-base font-bold text-gray-800 tracking-tight">🎯 오늘의 건강 목표</h2>
          </div>
          <p className="text-xs text-gray-400 mb-4">식사와 함께 챙길 건강 지침 관리 타겟을 선택해 주세요.</p>

          <div className="grid grid-cols-1 gap-2.5">
            {[
              { id: "none", title: "🥗 자유롭게 먹고 싶어", desc: "제한 없이 가장 당기는 요리 우선" },
              { id: "loss", title: "🏃 칼로리 비우기 (체중 감량)", desc: "기름지거나 밀가루 과잉 우려가 적은 식단" },
              { id: "gain", title: "💪 고단백 충전 (체중 증량)", desc: "육류, 단백 영양이 두툼한 요리" },
              { id: "sugar", title: "🩸 혈당 및 식이섬유 관리", desc: "정갈한 정식 및 섬유질 위주" }
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleHealthSelect(opt.id as MuckBti["health"])}
                className={`flex items-start text-left p-3.5 rounded-xl border transition-all ${
                  mbti.health === opt.id
                    ? "border-[#3182F6] bg-[#f2f8ff] text-gray-900"
                    : "border-gray-150 bg-white hover:bg-gray-50 text-gray-500"
                }`}
              >
                <div className="flex-1">
                  <div className="text-xs font-bold text-gray-800">{opt.title}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5 font-normal">{opt.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2.5 mt-3">
        {step > 0 && (
          <button
            type="button"
            onClick={handleBack}
            className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-600 font-medium rounded-xl transition-all text-xs text-center"
          >
            이전
          </button>
        )}
        <button
          type="button"
          onClick={handleNext}
          className="flex-[2] py-3 bg-[#3182F6] hover:bg-[#1b64da] text-white font-medium rounded-xl transition-all flex items-center justify-center gap-1.5 text-xs text-center"
        >
          {step === questions.length ? (
            <>결과 보기 <Sparkles className="w-3.5 h-3.5 fill-white text-[#3182F6]" /></>
          ) : (
            <>다음 <ChevronRight className="w-3.5 h-3.5" /></>
          )}
        </button>
      </div>
    </div>
  );
}