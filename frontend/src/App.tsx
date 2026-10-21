import { useState } from 'react'
import './App.css'
import CreateRoomPage from './component/CreateRoomPage'
import JoinRoomPage from './component/JoinRoomPage'
import { MapApiClient } from './component/MapApiClient'
import MapFeature from './component/MapFeature'
import { readRoomParticipant } from './utils/storage'

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? 'https://backend.yonu33.workers.dev').replace(/\/+$/, '')

function getRoomIdFromUrl(): string | null {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get('room')
}

function setRoomIdInUrl(roomId: string) {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  url.searchParams.set('room', roomId)
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
}

interface AppProps {
  roomInfo?: {
    title?: string
    meetingPlace?: string
    meetingTime?: string
  }
  participant?: {
    id: string
    name: string
  }
}

export default function App({ roomInfo, participant }: AppProps) {
  const [apiClient] = useState(() => new MapApiClient(apiBaseUrl))
  const [roomId, setRoomId] = useState<string | null>(getRoomIdFromUrl)
  
  const [joinedParticipant, setJoinedParticipant] = useState<{ id: string; name: string } | undefined>(() => {
    if (!roomId) return undefined
    return readRoomParticipant(roomId) ?? undefined
  })

  const handleRoomCreated = (newRoomId: string, newParticipant: { id: string; name: string }) => {
    setJoinedParticipant(newParticipant)
    setRoomId(newRoomId)
    setRoomIdInUrl(newRoomId)
  }

  const handleJoinSuccess = (newParticipant: { id: string; name: string }) => {
    setJoinedParticipant(newParticipant)
  }

  const roomParticipant = readRoomParticipant(roomId)
  const hasJoinedRoom = Boolean(roomId && (joinedParticipant || participant || roomParticipant))

  // 参加済み
  if (roomId && hasJoinedRoom) {
    return (
      <MapFeature 
        apiClient={apiClient} 
        roomInfo={roomInfo} 
        participant={joinedParticipant ?? participant ?? roomParticipant ?? undefined} 
        roomId={roomId} 
      />
    )
  }

  // 未参加
  if (roomId) {
    return (
      <JoinRoomPage 
        roomId={roomId} 
        apiClient={apiClient} 
        onJoinSuccess={handleJoinSuccess} 
      />
    )
  }

  // 部屋作成
  return (
    <CreateRoomPage 
      apiClient={apiClient} 
      onRoomCreated={handleRoomCreated} 
    />
  )
}