import { useState, useEffect, useRef } from 'react';
import { Stage, Layer, Rect, Text, Group, Line, Circle, Arrow } from 'react-konva';
import { useTranslation } from 'react-i18next';

const STATUS_LABELS = {
  free: { ru: 'Свободен', en: 'Free' },
  occupied: { ru: 'Занят', en: 'Occupied' },
  occupied_no_work: { ru: 'Простой', en: 'Idle' },
  active_work: { ru: 'В работе', en: 'Active' },
};

const STATUS_COLORS = {
  free: '#10b981',
  occupied: '#f59e0b',
  occupied_no_work: '#ef4444',
  active_work: '#6366f1',
};

const ZONE_COLORS = {
  entry: { fill: 'rgba(16, 185, 129, 0.08)', stroke: '#10b981' },
  waiting: { fill: 'rgba(245, 158, 11, 0.08)', stroke: '#f59e0b' },
  repair: { fill: 'rgba(99, 102, 241, 0.08)', stroke: '#6366f1' },
  diagnostics: { fill: 'rgba(168, 85, 247, 0.08)', stroke: '#a855f7' },
  parking: { fill: 'rgba(59, 130, 246, 0.08)', stroke: '#3b82f6' },
  free: { fill: 'rgba(148, 163, 184, 0.08)', stroke: '#94a3b8' },
};

// Реальная схема СТО по чертежу
const MAP_LAYOUT = {
  width: 1100,
  height: 650,
  // Стены здания
  building: { x: 20, y: 20, w: 1060, h: 610 },
  zones: [
    {
      key: 'entry',
      type: 'entry',
      x: 25, y: 440,
      w: 120, h: 185,
      label: 'Въезд/Выезд',
      labelEN: 'Entry/Exit',
    },
    {
      key: 'waiting',
      type: 'waiting',
      x: 25, y: 25,
      w: 120, h: 410,
      label: 'Зона ожидания\n/ Парковка',
      labelEN: 'Waiting\n/ Parking',
    },
    {
      key: 'repair_lower',
      type: 'repair',
      x: 150, y: 330,
      w: 620, h: 295,
      label: 'Ремонтная зона (посты 1-4)',
      labelEN: 'Repair zone (posts 1-4)',
    },
    {
      key: 'repair_upper',
      type: 'repair',
      x: 150, y: 25,
      w: 620, h: 300,
      label: 'Ремонтная зона (посты 5-8)',
      labelEN: 'Repair zone (posts 5-8)',
    },
    {
      key: 'diagnostics',
      type: 'diagnostics',
      x: 780, y: 25,
      w: 295, h: 600,
      label: 'Диагностика (посты 9-10)',
      labelEN: 'Diagnostics (posts 9-10)',
    },
  ],
  // 10 постов по реальной схеме
  posts: [
    // Нижний ряд — Посты 1-4
    { key: 'post01', x: 170, y: 370, w: 135, h: 115, label: 'Пост 1', labelEN: 'Post 1' },
    { key: 'post02', x: 320, y: 370, w: 135, h: 115, label: 'Пост 2', labelEN: 'Post 2' },
    { key: 'post03', x: 470, y: 370, w: 135, h: 115, label: 'Пост 3', labelEN: 'Post 3' },
    { key: 'post04', x: 620, y: 370, w: 135, h: 115, label: 'Пост 4', labelEN: 'Post 4' },
    // Нижний ряд — второй уровень
    { key: 'post01b', x: 170, y: 500, w: 135, h: 115, label: 'Пост 1\n(яма)', labelEN: 'Post 1\n(pit)', visible: false },
    // Верхний ряд — Посты 5-8
    { key: 'post05', x: 170, y: 55,  w: 135, h: 120, label: 'Пост 5', labelEN: 'Post 5' },
    { key: 'post06', x: 320, y: 55,  w: 135, h: 120, label: 'Пост 6', labelEN: 'Post 6' },
    { key: 'post07', x: 470, y: 55,  w: 135, h: 120, label: 'Пост 7', labelEN: 'Post 7' },
    { key: 'post08', x: 620, y: 55,  w: 135, h: 120, label: 'Пост 8', labelEN: 'Post 8' },
    // Правая часть — Посты 9-10 (Диагностика)
    { key: 'post09', x: 800, y: 55,  w: 255, h: 250, label: 'Пост 9\n(Диагностика)', labelEN: 'Post 9\n(Diagnostics)' },
    { key: 'post10', x: 800, y: 330, w: 255, h: 250, label: 'Пост 10\n(Диагностика)', labelEN: 'Post 10\n(Diagnostics)' },
  ],
  // Камеры по периметру и внутри (по фото — красные отметки)
  cameras: [
    { key: 'cam01', x: 155, y: 490, angle: 0,   num: '01' },
    { key: 'cam02', x: 155, y: 185, angle: 90,  num: '02' },
    { key: 'cam03', x: 310, y: 330, angle: 180, num: '03' },
    { key: 'cam04', x: 470, y: 330, angle: 180, num: '04' },
    { key: 'cam05', x: 465, y: 180, angle: 180, num: '05' },
    { key: 'cam06', x: 620, y: 180, angle: 180, num: '06' },
    { key: 'cam07', x: 770, y: 100, angle: 0,   num: '07' },
    { key: 'cam08', x: 770, y: 450, angle: 0,   num: '08' },
    { key: 'cam09', x: 80,  y: 625, angle: 0,   num: '09' },
    { key: 'cam10', x: 1060, y: 325, angle: 270, num: '10' },
  ],
};

function PostRect({ layout, post, isDark, onClick, isRu }) {
  if (layout.visible === false && !post) return null;
  const status = post?.status || 'free';
  const color = STATUS_COLORS[status];
  const vehicle = post?.stays?.[0]?.vehicleSession;
  const postLabel = isRu ? layout.label : (layout.labelEN || layout.label);

  return (
    <Group
      x={layout.x}
      y={layout.y}
      onClick={() => onClick?.(post)}
      onTap={() => onClick?.(post)}
    >
      {/* Post background */}
      <Rect
        width={layout.w}
        height={layout.h}
        fill={isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.7)'}
        stroke={color}
        strokeWidth={2}
        cornerRadius={8}
        shadowColor={color}
        shadowBlur={status === 'active_work' ? 15 : 4}
        shadowOpacity={0.4}
      />
      {/* Status indicator */}
      <Circle x={layout.w - 16} y={16} radius={6} fill={color} />
      {/* Post name */}
      <Text
        x={10} y={10}
        text={postLabel}
        fontSize={13}
        fontStyle="bold"
        fill={isDark ? '#f1f5f9' : '#1a202c'}
        lineHeight={1.2}
      />
      {/* Status text */}
      <Text
        x={10} y={postLabel.includes('\n') ? 46 : 30}
        text={STATUS_LABELS[status]?.[isRu ? 'ru' : 'en'] || status}
        fontSize={11}
        fill={color}
      />
      {/* Vehicle plate */}
      {vehicle && (
        <Group>
          <Rect
            x={8} y={layout.h - 38}
            width={layout.w - 16}
            height={26}
            fill={isDark ? 'rgba(15, 23, 42, 0.7)' : 'rgba(240, 244, 248, 0.9)'}
            cornerRadius={6}
            stroke={color}
            strokeWidth={0.5}
          />
          <Text
            x={8} y={layout.h - 38}
            width={layout.w - 16}
            height={26}
            text={vehicle.plateNumber || vehicle.trackId?.slice(0, 10) || '—'}
            fontSize={12}
            fontStyle="bold"
            fill={isDark ? '#e2e8f0' : '#1a202c'}
            align="center"
            verticalAlign="middle"
          />
        </Group>
      )}
      {/* Worker indicator */}
      {post?.stays?.[0]?.hasWorker && (
        <Text
          x={10} y={postLabel.includes('\n') ? 62 : 48}
          text={isRu ? '● Работник' : '● Worker'}
          fontSize={11}
          fill={isDark ? '#94a3b8' : '#718096'}
        />
      )}
    </Group>
  );
}

function CameraIcon({ cam, isDark, isRu }) {
  const label = (isRu ? 'КАМ' : 'CAM') + cam.num;
  return (
    <Group x={cam.x} y={cam.y}>
      <Circle radius={8} fill={isDark ? '#334155' : '#e2e8f0'} stroke="#ef4444" strokeWidth={1.5} />
      <Circle radius={3} fill="#ef4444" />
      <Text
        x={-20} y={10}
        width={40}
        text={label}
        fontSize={8}
        fill={isDark ? '#94a3b8' : '#718096'}
        align="center"
      />
      {/* FOV lines */}
      <Line
        points={[0, 0, Math.cos((cam.angle - 25) * Math.PI / 180) * 22, Math.sin((cam.angle - 25) * Math.PI / 180) * 22]}
        stroke="rgba(239, 68, 68, 0.25)" strokeWidth={1}
      />
      <Line
        points={[0, 0, Math.cos((cam.angle + 25) * Math.PI / 180) * 22, Math.sin((cam.angle + 25) * Math.PI / 180) * 22]}
        stroke="rgba(239, 68, 68, 0.25)" strokeWidth={1}
      />
    </Group>
  );
}

export default function STOMap({ zones = [], onPostClick, isDark = true }) {
  const { i18n } = useTranslation();
  const containerRef = useRef(null);
  const [stageSize, setStageSize] = useState({ width: 1100, height: 650 });
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const w = containerRef.current.offsetWidth;
        const s = Math.min(w / MAP_LAYOUT.width, 1);
        setScale(s);
        setStageSize({ width: MAP_LAYOUT.width * s, height: MAP_LAYOUT.height * s });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Map posts by name (extract number from post name)
  const postMap = {};
  zones.forEach(z => {
    z.posts?.forEach(p => {
      const num = p.name.match(/\d+/)?.[0];
      if (num) postMap[`post${num.padStart(2, '0')}`] = p;
    });
  });

  // Map zones by index
  const zoneMap = {};
  const zoneKeys = ['entry', 'waiting', 'repair_lower', 'repair_upper', 'diagnostics'];
  zones.forEach((z, i) => {
    if (zoneKeys[i]) zoneMap[zoneKeys[i]] = z;
  });

  const isRu = i18n.language === 'ru';

  return (
    <div ref={containerRef} className="w-full">
      <Stage width={stageSize.width} height={stageSize.height} scaleX={scale} scaleY={scale}>
        <Layer>
          {/* Background */}
          <Rect
            width={MAP_LAYOUT.width}
            height={MAP_LAYOUT.height}
            fill={isDark ? '#0f172a' : '#f0f4f8'}
            cornerRadius={16}
          />

          {/* Grid */}
          {Array.from({ length: 23 }).map((_, i) => (
            <Line key={`gv${i}`} points={[i * 50, 0, i * 50, MAP_LAYOUT.height]}
              stroke={isDark ? 'rgba(148,163,184,0.04)' : 'rgba(0,0,0,0.02)'} strokeWidth={1} />
          ))}
          {Array.from({ length: 14 }).map((_, i) => (
            <Line key={`gh${i}`} points={[0, i * 50, MAP_LAYOUT.width, i * 50]}
              stroke={isDark ? 'rgba(148,163,184,0.04)' : 'rgba(0,0,0,0.02)'} strokeWidth={1} />
          ))}

          {/* Building walls */}
          <Rect
            x={MAP_LAYOUT.building.x} y={MAP_LAYOUT.building.y}
            width={MAP_LAYOUT.building.w} height={MAP_LAYOUT.building.h}
            fill="transparent"
            stroke={isDark ? 'rgba(148,163,184,0.2)' : 'rgba(0,0,0,0.15)'}
            strokeWidth={2}
            cornerRadius={4}
          />

          {/* Center divider line (between upper and lower rows) */}
          <Line
            points={[150, 325, 770, 325]}
            stroke={isDark ? 'rgba(148,163,184,0.12)' : 'rgba(0,0,0,0.08)'}
            strokeWidth={1}
            dash={[6, 4]}
          />
          {/* Divider between repair and diagnostics */}
          <Line
            points={[775, 25, 775, 625]}
            stroke={isDark ? 'rgba(168,85,247,0.2)' : 'rgba(168,85,247,0.15)'}
            strokeWidth={1}
            dash={[6, 4]}
          />

          {/* Zones */}
          {MAP_LAYOUT.zones.map(zl => {
            const colors = ZONE_COLORS[zl.type] || ZONE_COLORS.free;
            const zoneData = zoneMap[zl.key];
            const vehicleCount = zoneData?._count?.stays || 0;

            return (
              <Group key={zl.key}>
                <Rect
                  x={zl.x} y={zl.y} width={zl.w} height={zl.h}
                  fill={colors.fill}
                  stroke={colors.stroke}
                  strokeWidth={1.5}
                  cornerRadius={10}
                  dash={[8, 4]}
                />
                <Text
                  x={zl.x + 8} y={zl.y + 6}
                  text={isRu ? zl.label : zl.labelEN}
                  fontSize={11}
                  fontStyle="bold"
                  fill={colors.stroke}
                  opacity={0.85}
                  lineHeight={1.2}
                />
                {vehicleCount > 0 && (
                  <Group>
                    <Rect
                      x={zl.x + zl.w - 38} y={zl.y + 5}
                      width={30} height={18}
                      fill={colors.stroke} cornerRadius={9}
                    />
                    <Text
                      x={zl.x + zl.w - 38} y={zl.y + 5}
                      width={30} height={18}
                      text={`${vehicleCount}`}
                      fontSize={9} fill="white" align="center" verticalAlign="middle"
                    />
                  </Group>
                )}
              </Group>
            );
          })}

          {/* Posts */}
          {MAP_LAYOUT.posts.map(pl => (
            <PostRect key={pl.key} layout={pl} post={postMap[pl.key]} isDark={isDark} onClick={onPostClick} isRu={isRu} />
          ))}

          {/* Cameras */}
          {MAP_LAYOUT.cameras.map(cam => (
            <CameraIcon key={cam.key} cam={cam} isDark={isDark} isRu={isRu} />
          ))}

          {/* Gate / Entry arrows */}
          <Arrow
            points={[25, 540, 145, 540]}
            stroke={isDark ? 'rgba(16,185,129,0.5)' : 'rgba(16,185,129,0.7)'}
            strokeWidth={2} pointerLength={8} pointerWidth={6}
          />
          <Text x={50} y={550} text={isRu ? '→ Въезд' : '→ Entry'} fontSize={11} fill="#10b981" />
          <Arrow
            points={[145, 570, 25, 570]}
            stroke={isDark ? 'rgba(239,68,68,0.4)' : 'rgba(239,68,68,0.6)'}
            strokeWidth={2} pointerLength={8} pointerWidth={6}
          />
          <Text x={50} y={578} text={isRu ? '← Выезд' : '← Exit'} fontSize={11} fill="#ef4444" />

          {/* Flow arrows: waiting → repair */}
          <Arrow
            points={[140, 200, 165, 200]}
            stroke={isDark ? 'rgba(245,158,11,0.4)' : 'rgba(245,158,11,0.6)'}
            strokeWidth={2} pointerLength={6} pointerWidth={5}
          />

          {/* Legend */}
          <Group x={810} y={590}>
            <Rect
              width={260} height={35}
              fill={isDark ? 'rgba(15,23,42,0.8)' : 'rgba(255,255,255,0.8)'}
              stroke={isDark ? 'rgba(148,163,184,0.15)' : 'rgba(0,0,0,0.1)'}
              cornerRadius={8}
            />
            {Object.entries(STATUS_COLORS).map(([status, color], i) => (
              <Group key={status} x={12 + i * 64} y={10}>
                <Circle x={0} y={5} radius={4} fill={color} />
                <Text
                  x={8} y={0}
                  text={isRu ? {
                    free: 'Своб.',
                    occupied: 'Занят',
                    occupied_no_work: 'Простой',
                    active_work: 'Работа',
                  }[status] : {
                    free: 'Free',
                    occupied: 'Busy',
                    occupied_no_work: 'Idle',
                    active_work: 'Active',
                  }[status]}
                  fontSize={9}
                  fill={isDark ? '#cbd5e1' : '#4a5568'}
                />
              </Group>
            ))}
          </Group>
        </Layer>
      </Stage>
    </div>
  );
}
