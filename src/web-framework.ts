import { useState, useEffect, useRef } from "react";

export enum Accuracy {
  Balanced = "Balanced",
  High = "High",
  Highest = "Highest",
}

interface GeolocationOptions {
  accuracy?: Accuracy;
  timeInterval?: number;
  distanceInterval?: number;
}

interface GeolocationResult {
  latitude: number;
  longitude: number;
  accuracyValue?: number;
}

// Haversine calculator to measure distance in meters between two coordinates
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // metres
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in metres
}

export function useGeolocation(options: GeolocationOptions = {}): GeolocationResult | null {
  const { accuracy, timeInterval = 5000, distanceInterval = 10 } = options;

  const [isHighAccuracy, setIsHighAccuracy] = useState<boolean>(
    accuracy === Accuracy.Highest || accuracy === Accuracy.High
  );
  const [location, setLocation] = useState<GeolocationResult | null>(null);
  const lastLocationRef = useRef<GeolocationResult | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      console.warn("Geolocation is not supported by this browser.");
      return;
    }

    const geoOptions: PositionOptions = {
      enableHighAccuracy: isHighAccuracy,
      timeout: 15000, // increase timeout slightly to allow resolving
      maximumAge: 300000, // accept cached position up to 5 minutes to avoid rapid timeout failures
    };

    let watchId: number;
    let fallbackIntervalId: number;

    const handleSuccess = (position: GeolocationPosition) => {
      const { latitude, longitude, accuracy: acc } = position.coords;
      const newLoc: GeolocationResult = { latitude, longitude, accuracyValue: acc };

      if (!lastLocationRef.current) {
        lastLocationRef.current = newLoc;
        setLocation(newLoc);
      } else {
        const dist = calculateDistance(
          lastLocationRef.current.latitude,
          lastLocationRef.current.longitude,
          latitude,
          longitude
        );

        // Only update if the user has moved at least `distanceInterval` meters
        if (dist >= distanceInterval) {
          lastLocationRef.current = newLoc;
          setLocation(newLoc);
        }
      }
    };

    const handleError = (error: GeolocationPositionError) => {
      // Degrade quality of accuracy on timeout or error to allow browser to use cell/Wi-Fi positioning
      if (isHighAccuracy) {
        console.warn("[useGeolocation] high accuracy GPS timed out/failed, falling back to network positioning...", error.message);
        setIsHighAccuracy(false);
      } else {
        console.log("[useGeolocation] GPS network query details (silent grace):", error.message);
      }
    };

    // 1. Direct active watch
    watchId = navigator.geolocation.watchPosition(handleSuccess, handleError, geoOptions);

    // 2. Also poll at timeInterval to guarantee regular checks (especially inside standard web containers)
    fallbackIntervalId = window.setInterval(() => {
      navigator.geolocation.getCurrentPosition(handleSuccess, handleError, geoOptions);
    }, timeInterval);

    return () => {
      if (watchId !== undefined) {
        navigator.geolocation.clearWatch(watchId);
      }
      if (fallbackIntervalId !== undefined) {
        clearInterval(fallbackIntervalId);
      }
    };
  }, [accuracy, timeInterval, distanceInterval, isHighAccuracy]);

  return location;
}
