import { Hono } from 'hono'
import { cors } from 'hono/cors'

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
  isWithin500m: boolean;
  status: 'on_the_way' | 'arrived';
  updatedAt: string;
}

const membersStore: Record<string, MemberStatus> = {};

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
  }>();

  const distance = getDistanceMetres(body.userLat, body.userLng, body.targetLat, body.targetLng);
  const isWithin500m = distance <= 500;

  const current = membersStore[body.userId] || {
    id: body.userId,
    name: body.userName,
    delayMinutes: 0,
    status: 'on_the_way',
  };

  // 500m外の場合はプライバシー保護のため lat/lng を null にする
  membersStore[body.userId] = {
    ...current,
    name: body.userName,
    lat: isWithin500m ? body.userLat : null,
    lng: isWithin500m ? body.userLng : null,
    speed: body.speed,
    isWithin500m,
    updatedAt: new Date().toISOString(),
  };

  return c.json({
    success: true,
    distanceMetres: Math.round(distance),
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

export default app
