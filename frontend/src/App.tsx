import { useState } from 'react'
import { MapApiClient } from './component/MapApiClient'
import MapFeature from './component/MapFeature'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8787'

export default function App() {
	const [apiClient] = useState(() => new MapApiClient(apiBaseUrl))

	return (
		<MapFeature apiClient={apiClient} />
	)
}
