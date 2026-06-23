/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Character, MuckBti } from "./types";

export const characters: Character[] = [
  {
    id: "comfort_walker",
    name: "가볍게 즐기는 산책러",
    emoji: "🚶",
    description: "부담 없는 가벼운 식사를 선호하며, 산책하듯 적절히 걸으며 대화와 여유를 즐기는 건강한 미식가형입니다.",
    coordinates: [2, 2, 2, 3, 3, 1], // spicy, fullness, budget, distance, speed, drink
    preferredHealth: "none"
  },
  {
    id: "hearty_meal",
    name: "든든한 한끼 추구형",
    emoji: "🍚",
    description: "한 끼를 먹더라도 무조건 든든하고 풍성하게! 속이 꽉 찬 영양 가득한 한 상과 든든한 포만감을 최고로 사랑합니다.",
    coordinates: [3, 5, 2, 2, 2, 2],
    preferredHealth: "gain"
  },
  {
    id: "leisurely_gourmet",
    name: "여유로운 만찬가형",
    emoji: "🥂",
    description: "공간의 격조와 섬세한 미감을 누리며, 시간에 구애받지 않고 천천히 음미하며 식사하는 즐거움을 소중히 대합니다.",
    coordinates: [2, 4, 5, 4, 5, 3],
    preferredHealth: "none"
  },
  {
    id: "spicy_enthusiast",
    name: "적당히 매콤 즐기는 모험가",
    emoji: "🌶️",
    description: "기분 좋게 칼칼하고 얼큰함을 추구하는 열정 맛집러! 과하게 맵지 않은 딱 기분 좋은 깔끔한 매콤함을 귀히 여깁니다.",
    coordinates: [5, 3, 3, 3, 3, 2], // spicy is 5 (extreme!)
    preferredHealth: "none"
  },
  {
    id: "diet_manager",
    name: "가벼운 식단 관리형",
    emoji: "🥗",
    description: "식단 관리에 성실한 가볍고 깔끔한 위장의 소유자. 샐러드나 두부, 닭가슴살처럼 담백하고 건강한 요리를 선호합니다.",
    coordinates: [1, 2, 3, 2, 3, 1],
    preferredHealth: "loss"
  },
  {
    id: "frugal_efficiency",
    name: "가성비 추구 실속형",
    emoji: "🪙",
    description: "맛과 양을 모두 알뜰히 챙기고 경제성도 깊게 살펴보는 현명한 주머니 파이터. 합리적 밥상을 기똥차게 찾아냅니다.",
    coordinates: [3, 4, 1, 2, 2, 1],
    preferredHealth: "none"
  },
  {
    id: "anywhere_explorer",
    name: "어디든 달리는 탐험가",
    emoji: "👟",
    description: "진짜 맛집을 위해서라면 3km도 가뿐히! 멀리 있는 명당도 기꺼이 찾아가 먹어보고 발품의 성취감을 느끼는 부지런한 식객입니다.",
    coordinates: [3, 3, 4, 5, 4, 2], // distance is 5 (extreme!)
    preferredHealth: "none"
  },
  {
    id: "cozy_sip",
    name: "가벼운 안주 한잔파",
    emoji: "🍺",
    description: "요리마다 가장 완미하게 어울리는 반주 한 잔을 애지중지하는 이 시대의 낭만 애주가. 맛있는 안주와 주말의 한 모금을 고대합니다.",
    coordinates: [3, 3, 3, 3, 4, 5], // drink is 5 (extreme!)
    preferredHealth: "none"
  },
  {
    id: "busy_quick_bite",
    name: "바쁜 일상 퀵바이터",
    emoji: "🥪",
    description: "바쁜 삶 속에서 식사는 빠르게 완료! 하지만 든든함은 알차게 챙기며 직관적 맛을 가장 명쾌하게 찾는 스피드 요정입니다.",
    coordinates: [2, 2, 2, 1, 1, 1],
    preferredHealth: "none"
  },
  {
    id: "soothing_wellness",
    name: "속 편한 웰빙 건강족",
    emoji: "🍵",
    description: "자극 자제를 모토로 심신의 편안함을 사랑하는 요정. 자극적 소스 대신 슴슴하고 유기농법 재료 고유의 부드러움을 좋아합니다.",
    coordinates: [1, 3, 4, 3, 4, 1],
    preferredHealth: "sugar"
  },
  {
    id: "spicy_solitude",
    name: "화끈하게 푸는 혼밥러",
    emoji: "🍲",
    description: "혼자 보내는 오롯한 식탁에서 매콤함으로 활기를 되찾는 힐러. 누군가의 방해도 없이 진정성 있게 맛과 대화합니다.",
    coordinates: [4, 4, 2, 2, 2, 1],
    preferredHealth: "none"
  },
  {
    id: "joyful_social",
    name: "대화 유쾌 마당발형",
    emoji: "🥘",
    description: "좋은 인연들과 동그랗게 모여 담소를 나누고 맛깔스러운 음식을 대접하듯 나누러 가는 다정다감한 친교 미학가입니다.",
    coordinates: [3, 4, 4, 3, 5, 4], // speed 5 (leisurely)
    preferredHealth: "none"
  },
  {
    id: "premium_wellness",
    name: "정성 가득 프리미엄형",
    emoji: "🥩",
    description: "품질 높은 좋은 요리에 그만한 가치를 아낌없이 지출하는 프리미엄 미덕가. 플레이팅부터 장인의 손길까지 꼼꼼히 음미합니다.",
    coordinates: [2, 3, 5, 3, 4, 2], // budget 5 (extreme!)
    preferredHealth: "sugar"
  },
  {
    id: "high_protein_trainer",
    name: "든든한 고단백 헬스형",
    emoji: "🍗",
    description: "단백질과 근력을 똑쟁이처럼 계산하며 닭고개와 육류 중심의 활력 급식을 애타게 찾는 헬스 피플 겸 근육 메이커입니다.",
    coordinates: [2, 5, 3, 3, 3, 1], // fullness 5 (extreme!)
    preferredHealth: "gain"
  },
  {
    id: "brunch_vacation",
    name: "달콤 디저트 브런치파",
    emoji: "🥞",
    description: "주말 휴일처럼 화사하고 예쁜 공간의 감성에 젖어 가볍고 부드러운 브런치를 한껏 사냥하는 감성 테이스터입니다.",
    coordinates: [1, 2, 4, 4, 4, 1],
    preferredHealth: "loss"
  }
];

export function getMatchedCharacter(muckBti: MuckBti): Character {
  let bestCharacter: Character = characters[0];
  let minDistance = Infinity;

  for (const char of characters) {
    let sumOfSquares = 0;
    const userCoords = [
      muckBti.spicy,
      muckBti.fullness,
      muckBti.budget,
      muckBti.distance,
      muckBti.speed,
      muckBti.drink
    ];

    for (let i = 0; i < 6; i++) {
      const u = userCoords[i];
      const c = char.coordinates[i];
      sumOfSquares += (u - c) * (u - c);
    }

    let distance = Math.sqrt(sumOfSquares);

    // Apply Generalized Extreme Value Penalty
    for (let i = 0; i < 6; i++) {
      const u = userCoords[i];
      const c = char.coordinates[i];

      // 1. If character has extreme (5) but user selects 4 or less -> +2.0 penalty
      if (c === 5 && u <= 4) {
        distance += 2.0;
      }
      // 2. If user has extreme (5) but character has less than 4 -> +2.0 penalty
      if (u === 5 && c < 4) {
        distance += 2.0;
      }
    }

    // Health Goal match bonus (-1.5)
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
