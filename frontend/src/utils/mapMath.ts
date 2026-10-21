export interface Coordinates {
  lat: number
  lng: number
}

const EARTH_RADIUS_METRES = 6_371_000

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180
}

// 直線距離計算
export function getStraightLineDistanceMetres(from: Coordinates, to: Coordinates): number {
  const latDelta = toRadians(to.lat - from.lat)
  const lngDelta = toRadians(to.lng - from.lng)
  const fromLat = toRadians(from.lat)
  const toLat = toRadians(to.lat)

  const haversine =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(lngDelta / 2) ** 2

  return EARTH_RADIUS_METRES * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
}

// 距離のフォーマット表示
export function formatDistance(metres: number): string {
  return metres >= 1000 ? `${(metres / 1000).toFixed(1)} km` : `${Math.round(metres)} m`
}

// 方角を計算
export function getBearingDegrees(from: Coordinates, to: Coordinates): number {
  const fromLat = toRadians(from.lat)
  const toLat = toRadians(to.lat)
  const lngDelta = toRadians(to.lng - from.lng)
  const y = Math.sin(lngDelta) * Math.cos(toLat)
  const x =
    Math.cos(fromLat) * Math.sin(toLat) -
    Math.sin(fromLat) * Math.cos(toLat) * Math.cos(lngDelta)

  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360
}

// 角度から方角に変換
export function formatBearing(degrees: number | null | undefined): string | null {
  if (degrees === null || degrees === undefined) return null
  const directions = ['北', '北東', '東', '南東', '南', '南西', '西', '北西']
  return directions[Math.round(degrees / 45) % 8]
}