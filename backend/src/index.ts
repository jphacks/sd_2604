import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono()

// フロントエンドからのCORSリクエストを許可
app.use('/api/*', cors())

// メンバーの状態をメモリ上で保持（ハッカソン用の爆速構成）
interface MemberStatus {
  id: string;
  name: string;
  delayMinutes: number;
  lat: number | null;
  lng: number | null;
  speed: number | null;
  etaMinutes?: number | null;
  bearingDegrees?: number | null;
  locationJammed?: boolean;
  isWithin500m: boolean;
  status: 'on_the_way' | 'arrived';
  updatedAt: string;
}

const membersStore: Record<string, MemberStatus> = {};
let destination: { lat: number; lng: number } | null = null;

// 2点間の距離(メートル)計算関数 (Haversineの公式)
function getDistanceMetres(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // 地球の半径(m)
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// 1. 位置情報の同期 & 500m判定API
app.post('/api/location/sync', async (c) => {
  const body = await c.req.json<{
    userId: string;
    userName: string;
    userLat: number;
    userLng: number;
    speed: number | null;
    targetLat: number;
    targetLng: number;
    etaMinutes?: number | null;
    bearingDegrees?: number | null;
    locationJammed?: boolean;
  }>();

  if (
    typeof body.userId !== 'string' || !body.userId.trim() ||
    typeof body.userName !== 'string' || !body.userName.trim() ||
    ![body.userLat, body.userLng, body.targetLat, body.targetLng].every(Number.isFinite) ||
    body.userLat < -90 || body.userLat > 90 ||
    body.targetLat < -90 || body.targetLat > 90 ||
    body.userLng < -180 || body.userLng > 180 ||
    body.targetLng < -180 || body.targetLng > 180
  ) {
    return c.json({ success: false, error: 'Invalid location sync payload' }, 400);
  }

  const locationJammed = body.locationJammed === true;
  const distance = locationJammed
    ? null
    : getDistanceMetres(body.userLat, body.userLng, body.targetLat, body.targetLng);
  const isWithin500m = distance !== null && distance <= 500;
  const etaMinutes = typeof body.etaMinutes === 'number' && Number.isFinite(body.etaMinutes) && body.etaMinutes >= 0
    ? Math.min(Math.round(body.etaMinutes), 1440)
    : null;
  const speed = typeof body.speed === 'number' && Number.isFinite(body.speed) && body.speed >= 0 && body.speed <= 20
    ? body.speed
    : null;
  const bearingDegrees = typeof body.bearingDegrees === 'number' && Number.isFinite(body.bearingDegrees)
    ? ((Math.round(body.bearingDegrees) % 360) + 360) % 360
    : null;
  destination = { lat: body.targetLat, lng: body.targetLng };

  const current = membersStore[body.userId] || {
    id: body.userId,
    name: body.userName,
    delayMinutes: 0,
    status: 'on_the_way',
  };

  // 500m外は通常nullにし、端末でジャミングされた概算座標だけ保存する
  membersStore[body.userId] = {
    ...current,
    name: body.userName,
    lat: isWithin500m || locationJammed ? body.userLat : null,
    lng: isWithin500m || locationJammed ? body.userLng : null,
    speed,
    etaMinutes,
    bearingDegrees,
    locationJammed,
    isWithin500m,
    updatedAt: new Date().toISOString(),
  };

  return c.json({
    success: true,
    distanceMetres: distance === null ? null : Math.round(distance),
    isWithin500m,
    allMembers: Object.values(membersStore),
  });
});

// 2. ワンタップ遅延更新API (+5分, +15分 など)
app.post('/api/delay', async (c) => {
  const { userId, userName, addMinutes } = await c.req.json<{
    userId: string;
    userName: string;
    addMinutes: number;
  }>();

  if (!membersStore[userId]) {
    membersStore[userId] = {
      id: userId,
      name: userName,
      delayMinutes: 0,
      lat: null,
      lng: null,
      speed: null,
      isWithin500m: false,
      status: 'on_the_way',
      updatedAt: new Date().toISOString(),
    };
  }

  membersStore[userId].delayMinutes += addMinutes;

  return c.json({
    success: true,
    delayMinutes: membersStore[userId].delayMinutes,
    allMembers: Object.values(membersStore),
  });
});

// 3. 全メンバー情報取得API（一覧表示用）
app.get('/api/members', (c) => {
  return c.json(Object.values(membersStore));
});

app.put('/api/destination', async (c) => {
  const body = await c.req.json<{ lat: unknown; lng: unknown }>();

  if (
    typeof body.lat !== 'number' ||
    typeof body.lng !== 'number' ||
    !Number.isFinite(body.lat) ||
    !Number.isFinite(body.lng) ||
    body.lat < -90 ||
    body.lat > 90 ||
    body.lng < -180 ||
    body.lng > 180
  ) {
    return c.json({ success: false, error: 'Invalid destination coordinates' }, 400);
  }

  destination = { lat: body.lat, lng: body.lng };
  return c.json({ success: true, destination });
});

app.get('/api/map-state', (c) => {
  return c.json({
    destination,
    members: Object.values(membersStore),
  });
});

export default app
