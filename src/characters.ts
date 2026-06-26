/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Character, MuckBti } from "./types";

// coordinates 순서: [spicy, fullness, salty, speed, drink]
export const characters: Character[] = [
  {
    id: "comfort_walker",
    name: "가볍게 즐기는 산책러",
    emoji: "🚶",
    description: "부담 없는 가벼운 식사를 선호하며, 자극적이지 않고 슴슴한 한 끼로 여유롭게 하루를 채우는 균형형 미식가입니다.",
    coordinates: [2, 2, 2, 3, 1],
    preferredHealth: "none"
  },
  {
    id: "hearty_meal",
    name: "든든한 한끼 추구형",
    emoji: "🍚",
    description: "한 끼를 먹더라도 무조건 든든하고 풍성하게! 속이 꽉 찬 영양 가득한 한 상을 가장 만족스러워합니다.",
    coordinates: [3, 5, 3, 2, 1],
    preferredHealth: "gain"
  },
  {
    id: "leisurely_gourmet",
    name: "여유로운 만찬가형",
    emoji: "🥂",
    description: "시간에 구애받지 않고 천천히 음미하며, 술 한 잔까지 곁들여 식사 자체를 즐기는 여유파입니다.",
    coordinates: [2, 4, 2, 5, 4],
    preferredHealth: "none"
  },
  {
    id: "spicy_enthusiast",
    name: "화끈한 매콤 모험가",
    emoji: "🌶️",
    description: "강렬하고 얼큰한 매운맛이 없으면 못 견디는 매콤 마니아! 칼칼함이 곧 행복입니다.",
    coordinates: [5, 3, 3, 3, 1],
    preferredHealth: "none"
  },
  {
    id: "diet_manager",
    name: "가벼운 식단 관리형",
    emoji: "🥗",
    description: "샐러드나 두부, 닭가슴살처럼 슴슴하고 담백한 저자극 식단으로 몸을 가볍게 관리합니다.",
    coordinates: [1, 2, 1, 3, 1],
    preferredHealth: "loss"
  },
  {
    id: "frugal_efficiency",
    name: "가성비 추구 실속형",
    emoji: "🪙",
    description: "맛과 양을 모두 알뜰히 챙기는 현명한 실속파. 적당한 짠맛의 든든한 한 상을 합리적으로 즐깁니다.",
    coordinates: [3, 4, 3, 2, 1],
    preferredHealth: "none"
  },
  {
    id: "anywhere_explorer",
    name: "느긋하게 음미하는 미식 탐험가",
    emoji: "🍷",
    description: "빠르게 먹기보다 시간을 들여 천천히, 진한 풍미를 끝까지 느긋하게 탐구하는 식객입니다.",
    coordinates: [3, 3, 3, 5, 2],
    preferredHealth: "none"
  },
  {
    id: "cozy_sip",
    name: "가벼운 안주 한잔파",
    emoji: "🍺",
    description: "묵직한 식사보다 가볍게 집어먹는 안주와 술 한 잔의 분위기를 가장 사랑하는 애주가입니다.",
    coordinates: [3, 2, 3, 3, 5],
    preferredHealth: "none"
  },
  {
    id: "busy_quick_bite",
    name: "바쁜 일상 퀵바이터",
    emoji: "🥪",
    description: "바쁜 삶 속에서 식사는 빠르게 완료! 간단하고 직관적인 맛으로 짧게 해결하는 스피드형입니다.",
    coordinates: [2, 2, 2, 1, 1],
    preferredHealth: "none"
  },
  {
    id: "soothing_wellness",
    name: "속 편한 웰빙 건강족",
    emoji: "🍵",
    description: "자극을 최소화한 슴슴하고 부드러운 음식으로 몸과 마음을 편안하게 하는 웰빙 추구형입니다.",
    coordinates: [1, 3, 1, 4, 1],
    preferredHealth: "sugar"
  },
  {
    id: "spicy_solitude",
    name: "화끈하게 푸는 혼밥러",
    emoji: "🍲",
    description: "혼자만의 시간, 매콤하고 짭짤한 한 그릇으로 스트레스를 화끈하게 풀어내는 힐러입니다.",
    coordinates: [4, 4, 4, 2, 1],
    preferredHealth: "none"
  },
  {
    id: "joyful_social",
    name: "대화 유쾌 마당발형",
    emoji: "🥘",
    description: "좋은 사람들과 둘러앉아 풍성한 음식과 적당한 술잔을 천천히 나누는 사교적인 미식가입니다.",
    coordinates: [3, 4, 3, 4, 3],
    preferredHealth: "none"
  },
  {
    id: "premium_palate",
    name: "정갈한 미각 큐레이터",
    emoji: "🍣",
    description: "자극적이지 않은 깔끔한 짠맛과 정갈한 플레이팅을 음미하며 디테일을 따지는 섬세한 미식가입니다.",
    coordinates: [2, 3, 2, 4, 2],
    preferredHealth: "sugar"
  },
  {
    id: "high_protein_trainer",
    name: "든든한 고단백 헬스형",
    emoji: "🍗",
    description: "단백질과 근력을 챙기며 닭고기·육류 중심의 든든한 한 끼를 빠르고 효율적으로 해결합니다.",
    coordinates: [2, 5, 3, 2, 1],
    preferredHealth: "gain"
  },
  {
    id: "brunch_vacation",
    name: "달콤 디저트 브런치파",
    emoji: "🥞",
    description: "화사하고 예쁜 공간에서 가볍고 부드러운 단맛 디저트와 브런치를 여유롭게 즐기는 감성파입니다.",
    coordinates: [1, 2, 1, 4, 1],
    preferredHealth: "loss"
  },
  {
    id: "salty_drinker",
    name: "짭짤한 술상 마니아",
    emoji: "🦑",
    description: "젓갈, 장조림처럼 짭짤하고 자극적인 안주에 술 한 잔을 곁들이는 걸 가장 좋아하는 짠맛 애호가입니다.",
    coordinates: [3, 3, 5, 3, 5],
    preferredHealth: "none"
  }
];

export function getMatchedCharacter(muckBti: MuckBti): Character {
  let bestCharacter: Character = characters[0];
  let minDistance = Infinity;

  for (const char of characters) {
    const userCoords = [muckBti.spicy, muckBti.fullness, muckBti.salty, muckBti.speed, muckBti.drink];
    let sumOfSquares = 0;

    for (let i = 0; i < 5; i++) {
      const u = userCoords[i];
      const c = char.coordinates[i];
      sumOfSquares += (u - c) * (u - c);
    }

    let distance = Math.sqrt(sumOfSquares);

    // 극단값(5) 가중치 페널티 - 사용자가 5인데 캐릭터가 4 이하면 거리 증가
    for (let i = 0; i < 5; i++) {
      const u = userCoords[i];
      const c = char.coordinates[i];
      if (c === 5 && u <= 3) distance += 1.5;
      if (u === 5 && c < 4) distance += 1.5;
      if (c === 1 && u >= 3) distance += 1.0;
      if (u === 1 && c > 2) distance += 1.0;
    }

    // 건강목표 일치 보너스
    if (muckBti.health !== "none" && muckBti.health === char.preferredHealth) {
      distance -= 1.5;
    }

    if (distance < minDistance) {
      minDistance = distance;
      bestCharacter = char;
    }
  }

  return bestCharacter;
}