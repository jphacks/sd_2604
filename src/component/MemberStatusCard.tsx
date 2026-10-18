export interface Member {
  id: string;
  name: string;
  delayMinutes: number;
  status: 'on_the_way' | 'arrived';
  isWithin500m: boolean;
}

interface MemberStatusCardProps {
  members: Member[];
  timerText?: string | null;
}

export function MemberStatusCard({ members ,timerText}: MemberStatusCardProps) {
  // Safe array check (membersが渡されていなくても空配列として扱う)
  const safeMembers = members || [];

  return (
    <div style={{
      position: 'absolute',
      top: '20px',
      left: '20px',
      width: '280px',
      background: 'rgba(255, 255, 255, 0.95)',
      padding: '16px',
      borderRadius: '16px',
      boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
      zIndex: 100,
    }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', borderBottom: '2px solid #f0f0f0', paddingBottom: '8px' }}>
        👥 メンバーの状況
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {safeMembers.map((m) => (
          <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px' }}>
            <span style={{ fontWeight: 'bold' }}>{m.name}</span>
            <div>
              {m.status === 'arrived' ? (
                <span style={{ background: '#e6fffa', color: '#047857', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>到着済</span>
              ) : m.isWithin500m ? (
                <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>{timerText}後につくといっています</span>
              ) : m.delayMinutes > 0 ? (
                <span style={{ background: '#fee2e2', color: '#b91c1c', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>+{m.delayMinutes}分遅れ</span>
              ) : (
                <span style={{ color: '#6b7280', fontSize: '12px' }}>順調に向かってます</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}