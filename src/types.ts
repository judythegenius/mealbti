/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface MuckBti {
  fullness: number;   // 1 (가볍게 한끼) ~ 5 (든든하게 배부르게)
  speed: number;      // 1 (빠르게 해치움) ~ 5 (여유롭게 즐김)
  salty: number; // 1 = 슴슴/덜짠, 5 = 짠 자극적
  spicy: number;      // 1 (순한맛) ~ 5 (지옥불맛)
  drink: number;      // 1 (거의 안 마심) ~ 5 (자주 곁들임)
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
  price_range?: string;
  business_hours?: string;
  telephone?: string;
  menu_guess?: string;
  toss_comment: string;
  distance_meters: number;
  walk_min: number;
  category: string;
  address: string;
  kakao_url: string;
  naver_url: string;
  verified_photo_url: string | null;
  verified_rating: number | null;
}

export interface RecommendationResponse {
  restaurants: RecommendedRestaurant[];
  meal_type: "아침" | "점심" | "저녁" | "야식";
  location_source: "gps" | "ip_estimated" | "manual";
  address: string;
  recommendation_source?: "gemini" | "fallback";
}
