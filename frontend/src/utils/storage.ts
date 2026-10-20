export interface RoomParticipant {
  id: string
  name: string
}

const KEYS = {
  DEVICE_ID: 'meetpoint.device-id',
  PARTICIPANT_NAME: 'meetpoint.participant-name',
  CREATOR_NAME: 'meetpoint-creator-name',
  LAST_ROOM_ID: 'meetpoint-last-room-id',
  roomParticipant: (roomId: string) => `meetpoint.room-participant.${roomId}`,
  roomOwner: (roomId: string) => `meetpoint.room-owner.${roomId}`,
} as const

// 端末ごとのidを取得or生成
export function getDeviceId(): string {
  if (typeof window === 'undefined') return 'unknown-device'

  const existing = window.localStorage.getItem(KEYS.DEVICE_ID)
  if (existing?.trim()) return existing

  const fingerprint = [
    window.navigator.userAgent,
    window.navigator.language,
    window.screen.width,
    window.screen.height,
    window.screen.colorDepth,
  ].join('|')

  const next = btoa(fingerprint).replace(/[^a-zA-Z0-9]/g, '').slice(0, 32) || `device-${Date.now()}`
  window.localStorage.setItem(KEYS.DEVICE_ID, next)
  return next
}

// 参加者情報の読み書き
export function readRoomParticipant(roomId: string | null | undefined): RoomParticipant | null {
  if (!roomId || typeof window === 'undefined') return null

  try {
    const stored = window.localStorage.getItem(KEYS.roomParticipant(roomId))
    if (!stored) return null
    const parsed = JSON.parse(stored) as Partial<RoomParticipant>
    if (parsed.id?.trim() && parsed.name?.trim()) {
      return { id: parsed.id, name: parsed.name.trim() }
    }
  } catch {
  }
  return null
}

export function writeRoomParticipant(roomId: string, participant: RoomParticipant): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(KEYS.roomParticipant(roomId), JSON.stringify(participant))
}

// オーナーIDの読み書き
export function readRoomOwnerId(roomId: string | null | undefined): string | null {
  if (!roomId || typeof window === 'undefined') return null
  const stored = window.localStorage.getItem(KEYS.roomOwner(roomId))
  return stored?.trim() || null
}

export function writeRoomOwnerId(roomId: string, ownerId: string | null): void {
  if (typeof window === 'undefined') return
  if (!ownerId?.trim()) {
    window.localStorage.removeItem(KEYS.roomOwner(roomId))
    return
  }
  window.localStorage.setItem(KEYS.roomOwner(roomId), ownerId.trim())
}

// 使用者の記録
export function getStoredParticipantName(fallback: string = '自分', roomId?: string | null): string {
  if (typeof window === 'undefined') return fallback

  const roomUser = readRoomParticipant(roomId)
  if (roomUser) return roomUser.name

  const globalName = window.localStorage.getItem(KEYS.PARTICIPANT_NAME)
  return globalName?.trim() || fallback
}

export function saveLastParticipantName(name: string): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(KEYS.PARTICIPANT_NAME, name.trim())
}