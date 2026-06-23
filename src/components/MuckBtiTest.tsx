/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { MuckBti } from "../types";
import { Sparkles, Check, ChevronRight, Scale, Flame, Utensils, Coins, MapPin, Gauge, Beer, Heart } from "lucide-react";

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
    budget: 3,
    distance: 3,
    speed: 3,
    drink: 3,
    health: "none",
  });

  const questions: Question[] = [
    {
      key: "spicy",
      title: "🌶️ 맵기 강도 선호",
      emoji: "🌶️",
      sub: "평소에 얼만큼 칼칼하고 매콤한 음식을 드시나요?",
      minLabel: "순한맛 (진라면 순한맛)",
      maxLabel: "지옥불맛 (핵불닭볶음면)",
      icon: <Flame className="w-5 h-5 text-red-500" />
    },
    {
      key: "fullness",
      title: "🍚 포만감 규모 선호",
      emoji: "🍚",
      sub: "식탁을 다 비우고 났을 때 배부름의 상태는 어느 정도가 좋으신가요?",
      minLabel: "가볍게 한 끼 (깔끔한 아쉬움)",
      maxLabel: "든든하게 배부르게 (두둑한 배부름)",
      icon: <Utensils className="w-5 h-5 text-amber-500" />
    },
    {
      key: "budget",
      title: "💰 예산 성향",
      emoji: "💰",
      sub: "평소 요리를 대할 때 중요시하는 예산 기조는 어디에 가깝나요?",
      minLabel: "실속 가성비 (최강 알뜰식)",
      maxLabel: "플렉스 (맛있다면 가격 무관)",
      icon: <Coins className="w-5 h-5 text-yellow-500" />
    },
    {
      key: "distance",
      title: "🚶 이동 가능 거리",
      emoji: "🚶",
      sub: "식사 장소까지 흔쾌히 걸어갈 수 있는 최대 한계선은?",
      minLabel: "바로 앞인 곳 (도보 3분 이내)",
      maxLabel: "어디든 맛만 있다면 (도보 15분 이상)",
      icon: <MapPin className="w-5 h-5 text-blue-500" />
    },
    {
      key: "speed",
      title: "⏱️ 식사 속도와 여유",
      emoji: "⏱️",
      sub: "평균적으로 한 그릇을 해치우는 식사 무드나 속도는 어떤가요?",
      minLabel: "빛의 속도로 (가볍고 신속히)",
      maxLabel: "여유롭게 천천히 (오순도순 만찬)",
      icon: <Gauge className="w-5 h-5 text-indigo-500" />
    },
    {
      key: "drink",
      title: "🍻 음주 동반 기호",
      emoji: "🍻",
      sub: "평소 가볍거나 풍족한 반주를 한 잔씩 즐겨 곁들이는 편이신가요?",
      minLabel: "식사만 냠냠 (거의 전혀 안 함)",
      maxLabel: "반주는 필수 (자주 애음)",
      icon: <Beer className="w-5 h-5 text-orange-400" />
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
    <div className="w-full max-w-md mx-auto bg-white rounded-[32px] p-6 shadow-sm border border-gray-150/50 flex flex-col justify-between min-h-[500px] animate-fade-in" id="muckbti-test-panel">
      {/* Header with progress */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <span className="text-xs font-semibold text-[#3182F6] font-mono tracking-wide bg-[#e8f3ff] px-2.5 py-1 rounded-full">
            STEP {step + 1} / {questions.length + 1}
          </span>
          <span className="text-xs text-gray-400 font-mono font-medium">{progressPercent}%</span>
        </div>
        <div className="w-full h-1.5 bg-gray-100 rounded-full mb-6 overflow-hidden">
          <div
            className="h-full bg-[#3182F6] rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {step < questions.length ? (
        // Slider steps (1-6)
        <div className="flex-1 flex flex-col justify-center my-6" id={`test-step-${step}`}>
          <div className="flex items-center gap-2.5 mb-2">
            <span className="p-2 bg-gray-50 rounded-xl inline-block">{questions[step].icon}</span>
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">{questions[step].title}</h2>
          </div>
          <p className="text-sm text-gray-500 mb-8 leading-relaxed font-normal">{questions[step].sub}</p>

          <div className="relative mb-8 bg-[#f8fbfe] p-6 rounded-2xl border border-blue-50/50">
            {/* Visual Value Indicator */}
            <div className="flex justify-between items-center mb-6">
              <span className="text-xs font-semibold text-gray-400 font-sans">선택 점수</span>
              <span className="text-3xl font-bold text-[#3182F6] font-mono tracking-tight transition-all">
                {mbti[questions[step].key as keyof MuckBti]}
                <span className="text-sm text-gray-400 font-normal ml-0.5">/ 5</span>
              </span>
            </div>

            {/* Premium TDS styled slider */}
            <input
              type="range"
              min="1"
              max="5"
              step="1"
              id={`slider-${questions[step].key}`}
              value={mbti[questions[step].key as keyof MuckBti] as number}
              onChange={(e) => handleSliderChange(questions[step].key, parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-[#3182F6] outline-none transition duration-150 ease-in-out"
            />

            {/* Slider track dots and labels */}
            <div className="flex justify-between px-1 mt-3">
              {[1, 2, 3, 4, 5].map((val) => (
                <span
                  key={val}
                  onClick={() => handleSliderChange(questions[step].key, val)}
                  className={`text-xs font-mono font-bold cursor-pointer w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                    mbti[questions[step].key as keyof MuckBti] === val
                      ? "bg-[#3182F6] text-white shadow-sm scale-110"
                      : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {val}
                </span>
              ))}
            </div>
          </div>

          <div className="flex justify-between items-center text-[11px] text-gray-400 font-medium px-2">
            <span className="bg-gray-50 px-2 py-1.5 rounded-lg border border-gray-100">1: {questions[step].minLabel}</span>
            <span className="bg-gray-50 px-2 py-1.5 rounded-lg border border-gray-100">5: {questions[step].maxLabel}</span>
          </div>
        </div>
      ) : (
        // Health goal unique step
        <div className="flex-1 flex flex-col justify-center my-6" id="test-step-health">
          <div className="flex items-center gap-2.5 mb-2">
            <span className="p-2 bg-[#f0f9ff] rounded-xl inline-block">
              <Heart className="w-5 h-5 text-[#3182F6] fill-[#3182F6]" />
            </span>
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">🎯 오늘의 건강 목표</h2>
          </div>
          <p className="text-sm text-gray-500 mb-6 leading-relaxed">식사와 함께 챙길 건강 지침이나 웰빙 관리 목표를 선택해 주세요.</p>

          <div className="grid grid-cols-1 gap-3 mb-4">
            {[
              { id: "none", title: "🥗 자유롭게 먹고 싶어", desc: "제한 없이 그날 기분에 제일 어울리는 요리 우선" },
              { id: "loss", title: "🏃 칼로리 비우기 (체중 감량)", desc: "기름지거나 밀가루 과잉 우려가 적은 식이선호" },
              { id: "gain", title: "💪 고단백 충천 (체중 증량)", desc: "육류, 단백 계열 영양이 두툼히 들어있는 알찬 한 그릇" },
              { id: "sugar", title: "🩸 혈당 및 식이섬유 관리", desc: "급격히 혈당을 높이지 않는 신선 섬유질과 정갈 정식 위주" }
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                id={`health-option-${opt.id}`}
                onClick={() => handleHealthSelect(opt.id as MuckBti["health"])}
                className={`flex items-start text-left p-4 rounded-[24px] border transition-all ${
                  mbti.health === opt.id
                    ? "border-[#3182F6] bg-[#f2f8ff] text-gray-900 ring-1 ring-[#3182F6]"
                    : "border-gray-250 bg-white hover:bg-gray-50 text-gray-500"
                }`}
              >
                <div className={`mt-0.5 mr-3 w-4.5 h-4.5 rounded-full border flex items-center justify-center transition-all ${
                  mbti.health === opt.id ? "border-[#3182F6] bg-[#3182F6]" : "border-gray-300 bg-white"
                }`}>
                  {mbti.health === opt.id && <Check className="w-3 h-3 text-white stroke-[3px]" />}
                </div>
                <div className="flex-1">
                  <div className={`text-sm font-bold ${mbti.health === opt.id ? "text-gray-900" : "text-gray-800"}`}>
                    {opt.title}
                  </div>
                  <div className="text-xs text-gray-400 mt-1 leading-relaxed font-normal">{opt.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Buttons drawer */}
      <div className="flex gap-3 mt-4">
        {step > 0 && (
          <button
            type="button"
            id="test-back-btn"
            onClick={handleBack}
            className="flex-1 py-4 bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold rounded-2xl transition-all duration-150 text-center"
          >
            이전
          </button>
        )}
        <button
          type="button"
          id="test-next-btn"
          onClick={handleNext}
          className="flex-[2] py-4 bg-[#3182F6] hover:bg-[#1b64da] text-white font-semibold rounded-2xl transition-all duration-150 shadow-sm shadow-blue-200 flex items-center justify-center gap-2 text-center"
        >
          {step === questions.length ? (
            <>
              나의 먹BTI 결과보기 <Sparkles className="w-4 h-4 fill-white text-[#3182F6]" />
            </>
          ) : (
            <>
              다음 단계 <ChevronRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
