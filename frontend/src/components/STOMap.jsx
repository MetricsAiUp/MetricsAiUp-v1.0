import { useState, useEffect, useRef } from 'react';
import { Stage, Layer, Rect, Text, Group, Line, Circle, Arrow } from 'react-konva';
import { useTranslation } from 'react-i18next';

const STATUS_COLORS = {
  free: '#10b981',
  occupied: '#f59e0b',
  occupied_no_work: '#ef4444',
  active_work: '#6366f1',
};

const STATUS_COLORS_BG = {
  free: 'rgba(16, 185, 129, 0.15)',
  occupied: 'rgba(245, 158, 11, 0.15)',
  occupied_no_work: 'rgba(239, 68, 68, 0.15)',
  active_work: 'rgba(99, 102, 241, 0.15)',
};

const ZONE_COLORS = {
  entry: { fill: 'rgba(16, 185, 129, 0.08)', stroke: '#10b981' },
  waiting: { fill: 'rgba(245, 158, 11, 0.08)', stroke: '#f59e0b' },
  repair: { fill: 'rgba(99, 102, 241, 0.08)', stroke: '#6366f1' },
  parking: { fill: 'rgba(59, 130, 246, 0.08)', stroke: '#3b82f6' },
  free: { fill: 'rgba(148, 163, 184, 0.08)', stroke: '#94a3b8' },
};

// Схема расположения зон и постов на карте СТО
const MAP_LAYOUT = {
  width: 1000,
  height: 600,
  zones: [
    {
      key: 'entry',
      type: 'entry',
      x: 20, y: 20,
      w: 160, h: 560,
      label: 'Зона 01\nВъезд/Выезд',
      labelEN: 'Zone 01\nEntry/Exit',
    },
    {
      key: 'waiting',
      type: 'waiting',
      x: 200, y: 20,
      w: 180, h: 260,
      label: 'Зона 02\nОжидание',
      labelEN: 'Zone 02\nWaiting',
    },
    {
      key: 'repair_main',
      type: 'repair',
      x: 400, y: 20,
      w: 580, h: 350,
      label: 'Зона 03 — Ремонт (основная)',
      labelEN: 'Zone 03 — Repair (main)',
    },
    {
      key: 'repair_extra',
      type: 'repair',
      x: 400, y: 390,
      w: 380, h: 190,
      label: 'Зона 04 — Ремонт (доп.)',
      labelEN: 'Zone 04 — Repair (extra)',
    },
    {
      key: 'parking',
      type: 'parking',
      x: 200, y: 300,
      w: 180, h: 280,
      label: 'Зона 05\nПарковка',
      labelEN: 'Zone 05\nParking',
    },
  ],
  // Посты расположены внутри зон
  posts: [
    // Зона 03 — 5 постов в ряд
    { key: 'post01', zone: 'repair_main', x: 420, y: 60,  w: 160, h: 130, label: 'Пост 01' },
    { key: 'post02', zone: 'repair_main', x: 600, y: 60,  w: 160, h: 130, label: 'Пост 02' },
    { key: 'post03', zone: 'repair_main', x: 780, y: 60,  w: 180, h: 130, label: 'Пост 03' },
    { key: 'post04', zone: 'repair_main', x: 420, y: 210, w: 260, h: 140, label: 'Пост 04 (груз.)' },
    { key: 'post05', zone: 'repair_main', x: 700, y: 210, w: 260, h: 140, label: 'Пост 05' },
    // Зона 04 — 2 поста
    { key: 'post06', zone: 'repair_extra', x: 420, y: 420, w: 160, h: 140, label: 'Пост 06' },
    { key: 'post07', zone: 'repair_extra', x: 600, y: 420, w: 160, h: 140, label: 'Пост 07 (спец.)' },
  ],
  // Камеры — позиции на карте
  cameras: [
    { key: 'cam01', x: 960, y: 55,  angle: 225, label: 'CAM01' },
    { key: 'cam02', x: 960, y: 200, angle: 180, label: 'CAM02' },
    { key: 'cam03', x: 760, y: 385, angle: 270, label: 'CAM03' },
    { key: 'cam04', x: 600, y: 565, angle: 0,   label: 'CAM04' },
    { key: 'cam05', x: 420, y: 55,  angle: 135, label: 'CAM05' },
    { key: 'cam06', x: 600, y: 55,  angle: 180, label: 'CAM06' },
    { key: 'cam07', x: 780, y: 55,  angle: 180, label: 'CAM07' },
    { key: 'cam08', x: 420, y: 205, angle: 135, label: 'CAM08' },
    { key: 'cam09', x: 20,  y: 20,  angle: 135, label: 'CAM09' },
    { key: 'cam10', x: 200, y: 565, angle: 0,   label: 'CAM10' },
  ],
  // Стрелки движения авто
  arrows: [
    { points: [100, 580, 100, 300, 100, 50], label: 'Въезд' },
    { points: [290, 150, 290, 300], label: '' },
  ],
};

function PostRect({ layout, post, isDark, onClick }) {
  const status = post?.status || 'free';
  const color = STATUS_COLORS[status];
  const vehicle = post?.stays?.[0]?.vehicleSession;

  return (
    <Group
      x={layout.x}
      y={layout.y}
      onClick={() => onClick?.(post)}
      onTap={() => onClick?.(post)}
      style={{ cursor: 'pointer' }}
    >
      {/* Post background */}
      <Rect
        width={layout.w}
        height={layout.h}
        fill={isDark ? 'rgba(30, 41, 59, 0.6)' : 'rgba(255, 255, 255, 0.6)'}
        stroke={color}
        strokeWidth={2}
        cornerRadius={8}
        shadowColor={color}
        shadowBlur={status === 'active_work' ? 12 : 4}
        shadowOpacity={0.3}
      />
      {/* Status indicator */}
      <Circle x={layout.w - 16} y={16} radius={6} fill={color} />
      {/* Post name */}
      <Text
        x={10} y={10}
        text={layout.label}
        fontSize={13}
        fontStyle="bold"
        fill={isDark ? '#f1f5f9' : '#1a202c'}
      />
      {/* Status text */}
      <Text
        x={10} y={30}
        text={status.replace(/_/g, ' ')}
        fontSize={11}
        fill={color}
      />
      {/* Vehicle plate */}
      {vehicle && (
        <Group>
          <Rect
            x={10} y={layout.h - 40}
            width={layout.w - 20}
            height={28}
            fill={isDark ? 'rgba(15, 23, 42, 0.6)' : 'rgba(240, 244, 248, 0.8)'}
            cornerRadius={6}
          />
          <Text
            x={10} y={layout.h - 40}
            width={layout.w - 20}
            height={28}
            text={`🚗 ${vehicle.plateNumber || vehicle.trackId?.slice(0, 10) || '—'}`}
            fontSize={12}
            fontStyle="bold"
            fill={isDark ? '#cbd5e1' : '#4a5568'}
            align="center"
            verticalAlign="middle"
          />
        </Group>
      )}
      {/* Worker indicator */}
      {post?.stays?.[0]?.hasWorker && (
        <Text
          x={10} y={50}
          text="👷 Работник"
          fontSize={11}
          fill={isDark ? '#94a3b8' : '#718096'}
        />
      )}
    </Group>
  );
}

function CameraIcon({ cam, isDark }) {
  const r = 10;
  return (
    <Group x={cam.x} y={cam.y}>
      <Circle radius={r} fill={isDark ? '#334155' : '#e2e8f0'} stroke="#6366f1" strokeWidth={1.5} />
      <Text
        x={-20} y={r + 4}
        width={40}
        text={cam.label}
        fontSize={8}
        fill={isDark ? '#94a3b8' : '#718096'}
        align="center"
      />
      {/* Field of view arc */}
      <Line
        points={[
          0, 0,
          Math.cos((cam.angle - 30) * Math.PI / 180) * 25,
          Math.sin((cam.angle - 30) * Math.PI / 180) * 25,
        ]}
        stroke="rgba(99, 102, 241, 0.3)"
        strokeWidth={1}
      />
      <Line
        points={[
          0, 0,
          Math.cos((cam.angle + 30) * Math.PI / 180) * 25,
          Math.sin((cam.angle + 30) * Math.PI / 180) * 25,
        ]}
        stroke="rgba(99, 102, 241, 0.3)"
        strokeWidth={1}
      />
    </Group>
  );
}

export default function STOMap({ zones = [], onPostClick, isDark = true }) {
  const { t, i18n } = useTranslation();
  const containerRef = useRef(null);
  const [stageSize, setStageSize] = useState({ width: 1000, height: 600 });
  const [scale, setScale] = useState(1);

  // Responsive scaling
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const newScale = Math.min(containerWidth / MAP_LAYOUT.width, 1);
        setScale(newScale);
        setStageSize({
          width: MAP_LAYOUT.width * newScale,
          height: MAP_LAYOUT.height * newScale,
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Map zone keys to API data
  const zoneMap = {};
  const zoneOrder = ['entry', 'waiting', 'repair', 'repair', 'parking'];
  zones.forEach((z, i) => {
    const layoutKey = MAP_LAYOUT.zones[i]?.key;
    if (layoutKey) zoneMap[layoutKey] = z;
  });

  // Map posts by name
  const postMap = {};
  zones.forEach(z => {
    z.posts?.forEach(p => {
      const num = p.name.match(/\d+/)?.[0];
      if (num) postMap[`post${num.padStart(2, '0')}`] = p;
    });
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

          {/* Grid lines */}
          {Array.from({ length: 20 }).map((_, i) => (
            <Line
              key={`grid-v-${i}`}
              points={[i * 50, 0, i * 50, MAP_LAYOUT.height]}
              stroke={isDark ? 'rgba(148, 163, 184, 0.05)' : 'rgba(0,0,0,0.03)'}
              strokeWidth={1}
            />
          ))}
          {Array.from({ length: 12 }).map((_, i) => (
            <Line
              key={`grid-h-${i}`}
              points={[0, i * 50, MAP_LAYOUT.width, i * 50]}
              stroke={isDark ? 'rgba(148, 163, 184, 0.05)' : 'rgba(0,0,0,0.03)'}
              strokeWidth={1}
            />
          ))}

          {/* Zones */}
          {MAP_LAYOUT.zones.map(zoneLayout => {
            const colors = ZONE_COLORS[zoneLayout.type];
            const zoneData = zoneMap[zoneLayout.key];
            const vehicleCount = zoneData?._count?.stays || 0;

            return (
              <Group key={zoneLayout.key}>
                <Rect
                  x={zoneLayout.x}
                  y={zoneLayout.y}
                  width={zoneLayout.w}
                  height={zoneLayout.h}
                  fill={colors.fill}
                  stroke={colors.stroke}
                  strokeWidth={1.5}
                  cornerRadius={12}
                  dash={[8, 4]}
                />
                {/* Zone label */}
                <Text
                  x={zoneLayout.x + 10}
                  y={zoneLayout.y + 8}
                  text={isRu ? zoneLayout.label : zoneLayout.labelEN}
                  fontSize={12}
                  fontStyle="bold"
                  fill={colors.stroke}
                  opacity={0.9}
                />
                {/* Vehicle count badge */}
                {vehicleCount > 0 && (
                  <Group>
                    <Rect
                      x={zoneLayout.x + zoneLayout.w - 40}
                      y={zoneLayout.y + 6}
                      width={32}
                      height={20}
                      fill={colors.stroke}
                      cornerRadius={10}
                    />
                    <Text
                      x={zoneLayout.x + zoneLayout.w - 40}
                      y={zoneLayout.y + 6}
                      width={32}
                      height={20}
                      text={`🚗${vehicleCount}`}
                      fontSize={10}
                      fill="white"
                      align="center"
                      verticalAlign="middle"
                    />
                  </Group>
                )}
              </Group>
            );
          })}

          {/* Posts */}
          {MAP_LAYOUT.posts.map(postLayout => (
            <PostRect
              key={postLayout.key}
              layout={postLayout}
              post={postMap[postLayout.key]}
              isDark={isDark}
              onClick={onPostClick}
            />
          ))}

          {/* Cameras */}
          {MAP_LAYOUT.cameras.map(cam => (
            <CameraIcon key={cam.key} cam={cam} isDark={isDark} />
          ))}

          {/* Entry arrow */}
          <Arrow
            points={[100, 570, 100, 50]}
            stroke={isDark ? 'rgba(16, 185, 129, 0.4)' : 'rgba(16, 185, 129, 0.6)'}
            strokeWidth={2}
            pointerLength={8}
            pointerWidth={6}
            dash={[6, 4]}
          />
          <Text
            x={60} y={540}
            text={isRu ? '↑ Въезд' : '↑ Entry'}
            fontSize={11}
            fill="#10b981"
            rotation={-90}
          />

          {/* Flow arrow: waiting → repair */}
          <Arrow
            points={[380, 150, 415, 150]}
            stroke={isDark ? 'rgba(245, 158, 11, 0.4)' : 'rgba(245, 158, 11, 0.6)'}
            strokeWidth={2}
            pointerLength={6}
            pointerWidth={5}
          />

          {/* Legend */}
          <Group x={800} y={400}>
            <Rect
              width={180} height={180}
              fill={isDark ? 'rgba(15, 23, 42, 0.8)' : 'rgba(255, 255, 255, 0.8)'}
              stroke={isDark ? 'rgba(148, 163, 184, 0.15)' : 'rgba(0,0,0,0.1)'}
              cornerRadius={12}
            />
            <Text
              x={12} y={10}
              text={isRu ? 'Легенда' : 'Legend'}
              fontSize={12}
              fontStyle="bold"
              fill={isDark ? '#f1f5f9' : '#1a202c'}
            />
            {Object.entries(STATUS_COLORS).map(([status, color], i) => (
              <Group key={status} y={35 + i * 28}>
                <Circle x={24} y={0} radius={5} fill={color} />
                <Text
                  x={36} y={-7}
                  text={isRu ? {
                    free: 'Свободен',
                    occupied: 'Занят',
                    occupied_no_work: 'Занят (простой)',
                    active_work: 'Активная работа',
                  }[status] : status.replace(/_/g, ' ')}
                  fontSize={11}
                  fill={isDark ? '#cbd5e1' : '#4a5568'}
                />
              </Group>
            ))}
            <Group y={147}>
              <Circle x={24} y={0} radius={5} fill="#6366f1" stroke="#6366f1" strokeWidth={1} />
              <Text
                x={36} y={-7}
                text={isRu ? 'Камера' : 'Camera'}
                fontSize={11}
                fill={isDark ? '#cbd5e1' : '#4a5568'}
              />
            </Group>
          </Group>
        </Layer>
      </Stage>
    </div>
  );
}
