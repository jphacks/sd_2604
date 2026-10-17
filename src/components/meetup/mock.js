// プレビュー用の仮データ。本番では Room の state から同じ形に変換して渡す。
export const mockMembers = [
  { id: 'a', name: 'かねと', status: 'near' },
  {
    id: 'b',
    name: 'さかもと',
    status: 'late',
    lateMin: 15,
    distM: 2300,
    transport: '電車',
    suggestion: '近くのスターバックスで待とう',
  },
  { id: 'c', name: 'ひろ', status: 'arrived' },
  { id: 'd', name: 'ゆうき', status: 'unknown' },
];
