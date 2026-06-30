/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface MuckBti {
  spicy: number;
  fullness: number;
  speed: number;
  drink: number;
  meatVeg: number;  // 1=야채중심, 5=고기중심
  health: "none" | "loss" | "gain" | "sugar";
}

export interface Character {
  id: string;
  name: string;
  emoji: string;
  description: string;
  coordinates: [number, number, number, number, number, number]; // spicy, fullness, budget, distance, speed, drink
  preferredHealth: "none" | "loss" | "gain" | "sugar";
}

export interface CurrentContext {
  meal_type: "아침" | "점심" | "저녁" | "야식";
  group_size: "1인" | "2~3인" | "4인이상";
  yesterday_food: string;
  search_radius_m: number;
}


export interface Restaurant {
  name: string;
  category: string;
  distance_meters: number;
  address: string;
  road_address?: string;
  menu_preview: string[];
  kakao_url: string;
  naver_url?: string;
  x?: string; // longitude
  y?: string; // latitude
}

export interface RecommendedRestaurant {
  name: string;
  recommended_menu: string;
  menu_preview?: string[];
  business_hours?: string | null;
  toss_comment: string;
  distance_meters: number;
  walk_min: number;
  category: string;
  address: string;
  kakao_url: string;
  naver_url: string;
  verified_photo_urls?: string[];
}

export interface RecommendationResponse {
  restaurants: RecommendedRestaurant[];
  meal_type: "아침" | "점심" | "저녁" | "야식";
  location_source: "gps" | "ip_estimated" | "manual";
  address: string;
  recommendation_source?: "gemini" | "fallback";
}
