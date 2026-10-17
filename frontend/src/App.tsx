import { useState } from 'react'
import { MapApiClient } from './component/MapApiClient'
import MapFeature from './component/MapFeature'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8787'

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

	return (
		<MapFeature apiClient={apiClient} roomInfo={roomInfo} participant={participant} />
	)
}
