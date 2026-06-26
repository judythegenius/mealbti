/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from "react";
import { Character, MuckBti } from "../types";
import { Share2, RotateCcw, Check, ArrowRight, Award, Image as ImageIcon } from "lucide-react";
import { toPng } from "html-to-image";

interface CharacterCardProps {
  character: Character;
  mbti: MuckBti;
  onRestart: () => void;
  onExplore: () => void;
  isSharedView?: boolean;
}

export default function CharacterCard({ character, mbti, onRestart, onExplore, isSharedView = false }: CharacterCardProps) {
  const [copied, setCopied] = useState<boolean>(false);
  const [capturing, setCapturing] = useState<boolean>(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const getSharingUrl = () => {
    const params = [
      mbti.spicy,
      mbti.fullness,
      mbti.salty,
      mbti.speed,
      mbti.drink,
      mbti.health
    ].join(",");

    const baseUrl = window.location.origin + window.location.pathname;
    return `${baseUrl}?mbti=${params}`;
  };

  const handleShareLink = async () => {
    const shareUrl = getSharingUrl();

    if (navigator.share) {
      try {
        await navigator.share({
          title: "나의 먹BTI",
          text: `나는 [${character.name}]! 너도 확인해봐 👀`,
          url: shareUrl,
        });
        return;
      } catch (err) {
        // 취소/미지원 시 아래로 폴백
      }
    }

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

  // 캐릭터 카드를 이미지로 캡처해서 공유/다운로드
  const handleCaptureShare = async () => {
    if (!cardRef.current) return;
    setCapturing(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        backgroundColor: "#ffffff",
        pixelRatio: 2, // 고해상도 캡처
        cacheBust: true,  // ← 이거 추가
      });

      // Web Share API 지원 시 (모바일) - 이미지 직접 공유
      if (navigator.share && navigator.canShare) {
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], "muck-bti-character.png", { type: "image/png" });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: "나의 먹BTI 캐릭터",
            text: `나는 [${character.name}]! 너도 확인해봐 👀`,
          });
          setCapturing(false);
          return;
        }
      }

      // Web Share 미지원 시 - 다운로드
      const link = document.createElement("a");
      link.download = `muck-bti-${character.id}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Failed to capture card image:", err);
    } finally {
      setCapturing(false);
    }
  };

  const axisNames = [
    { label: "🌶️ 맵기 강도", val: mbti.spicy, desc: mbti.spicy >= 4 ? "얼큰칼칼파" : mbti.spicy <= 2 ? "순딩순한파" : "중간맵지짱" },
    { label: "🍚 포만감 규모", val: mbti.fullness, desc: mbti.fullness >= 4 ? "두둑배불러" : mbti.fullness <= 2 ? "가벼운식탐" : "적당든든식" },
    { label: "🧂 짠맛 선호 강도", val: mbti.salty, desc: mbti.salty >= 4 ? "짭짤자극파" : mbti.salty <= 2 ? "슴슴담백파" : "적당짭짤이" },
    { label: "⏱️ 식사 속도", val: mbti.speed, desc: mbti.speed >= 4 ? "느긋슬로우" : mbti.speed <= 2 ? "신속스피더" : "적절식사꾼" },
    { label: "🍻 음주 반주", val: mbti.drink, desc: mbti.drink >= 4 ? "술술애주가" : mbti.drink <= 2 ? "오직보리밥" : "한모금취향" }
  ];

  const healthLabels: Record<string, string> = {
    none: "자유식단",
    loss: "비우기 (체중 감량)",
    gain: "고단백 (체중 증량)",
    sugar: "혈당 및 식이 조절"
  };

  return (
    <div className="w-full max-w-md mx-auto flex flex-col gap-6 animate-fade-in">
      {/* 캡처 대상 영역 - ref로 감싼 카드 */}
      <div ref={cardRef} className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-150/50 flex flex-col gap-6" id="character-report">
        {/* Character Core Brief */}
        <div className="text-center py-5 bg-[#F9FAFB] rounded-[24px] border border-gray-150/40">
          <span className="text-5xl inline-block mb-3 select-none">{character.emoji}</span>
          <div className="text-xs font-semibold text-[#3182F6] tracking-wider mb-1 font-mono uppercase bg-[#e8f3ff] px-3 py-1 rounded-full inline-block">
            MY MUCK-BTI CHARACTER
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight mt-1">{character.name}</h1>
        </div>

        {/* Description text */}
        <div className="bg-[#F9FAFB] p-4.5 rounded-[20px] border border-gray-150/40">
          <p className="text-sm font-normal text-gray-600 leading-relaxed text-center">{character.description}</p>
        </div>

        {/* Coordinates / Stats Bars */}
        <div>
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3.5 flex items-center gap-1.5 px-1">
            <Award className="w-3.5 h-3.5 text-[#3182F6]" /> 상세 먹스펙 성향점수
          </h3>

          <div className="grid grid-cols-2 gap-3">
            {axisNames.map((axis, i) => (
              <div key={i} className="p-3.5 bg-[#F9FAFB] rounded-[16px] border border-gray-150/40 flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-xs font-semibold text-gray-500">
                  <span>{axis.label}</span>
                  <span className="font-mono font-bold text-[#3182F6]">{axis.val}/5</span>
                </div>
                <div className="w-full h-1 bg-gray-150 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#3182F6] rounded-full transition-all"
                    style={{ width: `${(axis.val / 5) * 100}%` }}
                  />
                </div>
                <span className="text-[10px] text-gray-400 font-medium font-sans text-right">{axis.desc}</span>
              </div>
            ))}
          </div>

          <div className="mt-3.5 flex items-center justify-between p-3.5 bg-[#F4FAF0] rounded-[16px] border border-green-100/70 text-xs">
            <span className="font-bold text-green-700 flex items-center gap-1">🎯 오늘의 건강 관리선호</span>
            <span className="font-bold text-green-800 bg-green-50 px-2.5 py-1 rounded-[10px] border border-green-200">{healthLabels[mbti.health] || "자유식"}</span>
          </div>
        </div>

        {/* 캡처 워터마크 (캡처된 이미지에만 의미있게 보임) */}
        <p className="text-center text-[10px] text-gray-300 font-mono -mt-2">muck-bti.app 에서 확인하기</p>
      </div>

      {/* Toast */}
      {copied && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-gray-900/95 text-white text-xs px-5 py-3 rounded-2xl shadow-lg flex items-center gap-2 animate-fade-in z-50">
          <Check className="w-4 h-4 text-emerald-400 stroke-[3px]" />
          <span className="font-semibold">친구 유입 공유 링크가 복사되었습니다!</span>
        </div>
      )}

      {/* Action CTA Drawer - 캡처 영역 밖 */}
      <div className="flex flex-col gap-2.5">
        {!isSharedView ? (
          <>
            <button
              type="button"
              id="mbti-explore-btn"
              onClick={onExplore}
              className="w-full py-4 bg-[#3182F6] hover:bg-[#1b64da] text-white font-bold rounded-[20px] flex items-center justify-center gap-2.5 transition-all outline-none shadow-sm"
            >
              오늘의 실존 주변맛집 추천받기 <ArrowRight className="w-4.5 h-4.5" />
            </button>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                id="capture-share-btn"
                onClick={handleCaptureShare}
                disabled={capturing}
                className="py-3 bg-[#3182F6]/10 hover:bg-[#3182F6]/20 text-[#3182F6] font-semibold text-xs rounded-[16px] flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
              >
                <ImageIcon className="w-3.5 h-3.5" /> {capturing ? "캡처중..." : "이미지 공유"}
              </button>
              <button
                type="button"
                id="share-mbti-btn"
                onClick={handleShareLink}
                className="py-3 bg-[#e8f3ff] hover:bg-[#d0e7ff] text-[#3182F6] font-semibold text-xs rounded-[16px] flex items-center justify-center gap-1.5 transition-all"
              >
                <Share2 className="w-3.5 h-3.5" /> 링크 공유
              </button>
              <button
                type="button"
                id="restart-mbti-btn"
                onClick={onRestart}
                className="py-3 bg-gray-150/70 hover:bg-gray-200 text-gray-700 font-semibold text-xs rounded-[16px] flex items-center justify-center gap-1.5 transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" /> 다시검사
              </button>
            </div>
          </>
        ) : (
          <>
            <button
              type="button"
              id="cta-test-btn"
              onClick={onRestart}
              className="w-full py-4.5 bg-[#3182F6] hover:bg-[#1b64da] text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition-all outline-none text-base"
            >
              나도 30초만에 먹BTI 검사해보기 <ArrowRight className="w-4.5 h-4.5 animate-pulse" />
            </button>
            <p className="text-center text-xs text-gray-400 mt-1 font-medium">공유받은 친구의 캐릭터 성향입니다. 30초 만에 나의 먹성향을 확인해 보세요!</p>
          </>
        )}
      </div>
    </div>
  );
}