import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { Camera } from 'lucide-react';
import { translateZone, translatePost } from '../utils/translate';
import HelpButton from '../components/HelpButton';

// Mock plate image — SVG генерирует "фото номера"
function PlatePreview({ plate, small = false }) {
  const w = small ? 56 : 180;
  const h = small ? 18 : 50;
  const fs = small ? 7 : 18;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ borderRadius: small ? 2 : 4, flexShrink: 0 }}>
      <rect width={w} height={h} fill="#fff" stroke="#1a1a1a" strokeWidth={small ? 1 : 2} rx={small ? 2 : 4} />
      <rect x={small ? 1 : 2} y={small ? 1 : 2} width={small ? 5 : 16} height={h - (small ? 2 : 4)} fill="#0052B4" rx={1} />
      <text x={w / 2 + (small ? 2 : 6)} y={h / 2 + 1} textAnchor="middle" dominantBaseline="middle"
        fontSize={fs} fontFamily="monospace" fontWeight="bold" fill="#1a1a1a">
        {plate || '—'}
      </text>
    </svg>
  );
}

// Mock car-on-post image
function CarOnPostPlaceholder({ postName, isRu }) {
  return (
    <div className="w-full h-48 rounded-xl flex flex-col items-center justify-center gap-2"
      style={{ background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)', border: '1px solid var(--border-glass)' }}>
      <Camera size={40} style={{ color: '#64748b' }} />
      <span className="text-xs" style={{ color: '#94a3b8' }}>
        {isRu ? `Скриншот с камеры — ${postName || 'пост'}` : `Camera screenshot — ${postName || 'post'}`}
      </span>
      <span className="text-xs" style={{ color: '#64748b' }}>
        {isRu ? 'CV-система подключится позже' : 'CV system will connect later'}
      </span>
    </div>
  );
}

// Session detail modal
function SessionModal({ session, onClose, isRu, workOrders }) {
  const [editPlate, setEditPlate] = useState(session.plateNumber || '');
  const [saved, setSaved] = useState(false);

  const zone = session.zoneStays?.[0]?.zone;
  const postStay = session.postStays?.[0];
  const post = postStay?.post;

  // Find linked work order
  const linkedWO = workOrders.find(wo =>
    wo.plateNumber && session.plateNumber &&
    wo.plateNumber.replace(/\s/g, '').toUpperCase() === session.plateNumber.replace(/\s/g, '').toUpperCase()
  );

  const handleSave = () => {
    // In real app — API call to update plate number
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}>
      <div className="glass-static p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            {isRu ? 'Сессия автомобиля' : 'Vehicle Session'}
          </h3>
          <button onClick={onClose} className="text-sm px-3 py-1 rounded-lg hover:opacity-80"
            style={{ color: 'var(--text-muted)', border: '1px solid var(--border-glass)' }}>✕</button>
        </div>

        {/* Photos row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          {/* Plate photo */}
          <div>
            <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
              {isRu ? 'Распознанный номер' : 'Recognized Plate'}
            </p>
            <div className="flex items-center justify-center p-4 rounded-xl"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)' }}>
              <PlatePreview plate={session.plateNumber} />
            </div>
          </div>

          {/* Car on post photo */}
          <div>
            <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
              {isRu ? 'Авто на посту' : 'Car on Post'}
            </p>
            <CarOnPostPlaceholder postName={post?.name} isRu={isRu} />
          </div>
        </div>

        {/* Edit plate */}
        <div className="mb-5 p-4 rounded-xl" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
          <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
            {isRu ? 'Гос. номер (можно исправить)' : 'Plate number (editable)'}
          </p>
          <div className="flex gap-2">
            <input
              value={editPlate}
              onChange={e => setEditPlate(e.target.value.toUpperCase())}
              className="flex-1 px-3 py-2 rounded-lg text-sm font-mono font-bold outline-none"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', color: 'var(--text-primary)' }}
            />
            <button onClick={handleSave}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90"
              style={{ background: saved ? '#10b981' : 'var(--accent)' }}>
              {saved ? '✓' : (isRu ? 'Сохранить' : 'Save')}
            </button>
          </div>
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="p-3 rounded-xl" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{isRu ? 'Текущая зона' : 'Current Zone'}</p>
            <p className="text-sm font-medium mt-1" style={{ color: 'var(--text-primary)' }}>{translateZone(zone?.name, isRu) || '—'}</p>
          </div>
          <div className="p-3 rounded-xl" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{isRu ? 'Текущий пост' : 'Current Post'}</p>
            <p className="text-sm font-medium mt-1" style={{ color: 'var(--text-primary)' }}>{translatePost(post?.name, isRu) || '—'}</p>
          </div>
          <div className="p-3 rounded-xl" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{isRu ? 'Время въезда' : 'Entry Time'}</p>
            <p className="text-sm font-medium mt-1" style={{ color: 'var(--text-primary)' }}>
              {new Date(session.entryTime).toLocaleString()}
            </p>
          </div>
          <div className="p-3 rounded-xl" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{isRu ? 'Статус' : 'Status'}</p>
            <p className="text-sm font-medium mt-1" style={{
              color: session.status === 'active' ? '#10b981' : '#94a3b8'
            }}>
              {session.status === 'active' ? (isRu ? 'Активна' : 'Active') : (isRu ? 'Завершена' : 'Completed')}
            </p>
          </div>
        </div>

        {/* Linked Work Order from 1C */}
        <div className="p-4 rounded-xl" style={{ background: 'var(--bg-glass)', border: '1px solid var(--border-glass)' }}>
          <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
            {isRu ? 'Заказ-наряд из 1С' : 'Work Order from 1C'}
          </p>
          {linkedWO ? (
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span style={{ color: 'var(--text-muted)' }}>{isRu ? 'Номер' : 'Number'}</span>
                <span className="font-mono font-medium" style={{ color: 'var(--text-primary)' }}>{linkedWO.orderNumber}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span style={{ color: 'var(--text-muted)' }}>{isRu ? 'Тип работ' : 'Work Type'}</span>
                <span style={{ color: 'var(--text-primary)' }}>{linkedWO.workType || '—'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span style={{ color: 'var(--text-muted)' }}>{isRu ? 'Нормочасы' : 'Norm Hours'}</span>
                <span style={{ color: 'var(--accent)' }}>{linkedWO.normHours || '—'}ч</span>
              </div>
              <div className="flex justify-between text-sm">
                <span style={{ color: 'var(--text-muted)' }}>{isRu ? 'Статус ЗН' : 'WO Status'}</span>
                <span style={{ color: linkedWO.status === 'in_progress' ? '#f59e0b' : linkedWO.status === 'completed' ? '#10b981' : '#94a3b8' }}>
                  {linkedWO.status}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {isRu ? 'Заказ-наряд не найден (матчинг по номеру авто)' : 'Work order not found (matching by plate number)'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Sessions() {
  const { t, i18n } = useTranslation();
  const { api } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [status, setStatus] = useState('active');
  const [selectedSession, setSelectedSession] = useState(null);
  const [workOrders, setWorkOrders] = useState([]);
  const [postFilter, setPostFilter] = useState('all');
  const [sortBy, setSortBy] = useState('entryTime');
  const [sortDir, setSortDir] = useState('desc');

  const isRu = i18n.language === 'ru';

  useEffect(() => {
    api.get(`/api/sessions?status=${status}`)
      .then(res => setSessions(res.data.sessions || []))
      .catch(console.error);
  }, [status]);

  useEffect(() => {
    api.get('/api/work-orders')
      .then(res => setWorkOrders(res.data.orders || []))
      .catch(console.error);
  }, []);

  // Unique posts from sessions
  const postNames = [...new Set(sessions.map(s => s.postStays?.[0]?.post?.name).filter(Boolean))].sort();

  // Filter & sort
  const filtered = sessions
    .filter(s => postFilter === 'all' || s.postStays?.[0]?.post?.name === postFilter)
    .sort((a, b) => {
      let va, vb;
      if (sortBy === 'entryTime') {
        va = new Date(a.entryTime).getTime();
        vb = new Date(b.entryTime).getTime();
      } else if (sortBy === 'post') {
        va = a.postStays?.[0]?.post?.name || '';
        vb = b.postStays?.[0]?.post?.name || '';
      } else if (sortBy === 'plate') {
        va = a.plateNumber || '';
        vb = b.plateNumber || '';
      } else if (sortBy === 'zone') {
        va = a.zoneStays?.[0]?.zone?.name || '';
        vb = b.zoneStays?.[0]?.zone?.name || '';
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

  const toggleSort = (col) => {
    if (sortBy === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir('asc');
    }
  };

  const sortIcon = (col) => sortBy === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {t('sessions.title')}
          </h2>
          <HelpButton pageKey="sessions" />
        </div>
        <div className="flex gap-2">
          {['active', 'completed'].map(s => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className="px-4 py-2 rounded-xl text-sm transition-all"
              style={{
                background: status === s ? 'var(--accent)' : 'var(--bg-glass)',
                color: status === s ? 'white' : 'var(--text-secondary)',
                border: `1px solid ${status === s ? 'var(--accent)' : 'var(--border-glass)'}`,
              }}
            >
              {t(`sessions.${s}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Post filter */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {isRu ? 'Фильтр по посту:' : 'Filter by post:'}
        </span>
        <button
          onClick={() => setPostFilter('all')}
          className="px-3 py-1 rounded-lg text-xs transition-all"
          style={{
            background: postFilter === 'all' ? 'var(--accent)' : 'var(--bg-glass)',
            color: postFilter === 'all' ? 'white' : 'var(--text-muted)',
          }}
        >
          {isRu ? 'Все' : 'All'}
        </button>
        {postNames.map(name => (
          <button
            key={name}
            onClick={() => setPostFilter(name)}
            className="px-3 py-1 rounded-lg text-xs transition-all"
            style={{
              background: postFilter === name ? 'var(--accent)' : 'var(--bg-glass)',
              color: postFilter === name ? 'white' : 'var(--text-muted)',
            }}
          >
            {translatePost(name, isRu)}
          </button>
        ))}
        <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
          {filtered.length} / {sessions.length}
        </span>
      </div>

      <div className="glass-static overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-glass)' }}>
              <th className="text-left px-4 py-3 font-medium cursor-pointer select-none hover:opacity-80"
                style={{ color: sortBy === 'plate' ? 'var(--accent)' : 'var(--text-muted)' }}
                onClick={() => toggleSort('plate')}>
                {t('sessions.plateNumber')}{sortIcon('plate')}
              </th>
              <th className="text-left px-4 py-3 font-medium cursor-pointer select-none hover:opacity-80"
                style={{ color: sortBy === 'entryTime' ? 'var(--accent)' : 'var(--text-muted)' }}
                onClick={() => toggleSort('entryTime')}>
                {t('sessions.entryTime')}{sortIcon('entryTime')}
              </th>
              <th className="text-left px-4 py-3 font-medium cursor-pointer select-none hover:opacity-80"
                style={{ color: sortBy === 'zone' ? 'var(--accent)' : 'var(--text-muted)' }}
                onClick={() => toggleSort('zone')}>
                {t('sessions.currentZone')}{sortIcon('zone')}
              </th>
              <th className="text-left px-4 py-3 font-medium cursor-pointer select-none hover:opacity-80"
                style={{ color: sortBy === 'post' ? 'var(--accent)' : 'var(--text-muted)' }}
                onClick={() => toggleSort('post')}>
                {t('sessions.currentPost')}{sortIcon('post')}
              </th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--text-muted)' }}>
                {t('sessions.status')}
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(s => (
              <tr key={s.id}
                className="cursor-pointer hover:opacity-80 transition-opacity"
                style={{ borderBottom: '1px solid var(--border-glass)' }}
                onClick={() => setSelectedSession(s)}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <PlatePreview plate={s.plateNumber} small />
                    <span className="font-medium font-mono" style={{ color: 'var(--text-primary)' }}>
                      {s.plateNumber || '—'}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>
                  {new Date(s.entryTime).toLocaleString()}
                </td>
                <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>
                  {translateZone(s.zoneStays?.[0]?.zone?.name, isRu) || '—'}
                </td>
                <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>
                  {translatePost(s.postStays?.[0]?.post?.name, isRu) || '—'}
                </td>
                <td className="px-4 py-3">
                  <span
                    className="px-2 py-1 rounded-full text-xs"
                    style={{
                      background: s.status === 'active' ? 'rgba(16,185,129,0.15)' : 'rgba(148,163,184,0.15)',
                      color: s.status === 'active' ? '#10b981' : '#94a3b8',
                    }}
                  >
                    {t(`sessions.${s.status}`)}
                  </span>
                </td>
              </tr>
            ))}
            {sessions.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center" style={{ color: 'var(--text-muted)' }}>
                  {t('common.noData')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {selectedSession && (
        <SessionModal
          session={selectedSession}
          onClose={() => setSelectedSession(null)}
          isRu={isRu}
          workOrders={workOrders}
        />
      )}
    </div>
  );
}
