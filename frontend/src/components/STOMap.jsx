import { useState, useEffect, useRef } from 'react';
import { Stage, Layer, Rect, Text, Group, Line, Circle, Arrow } from 'react-konva';
import { useTranslation } from 'react-i18next';
import { POST_STATUS_COLORS } from '../constants';

const STATUS_LABELS = {
  free: { ru: 'Свободен', en: 'Free' },
  occupied: { ru: 'Занят', en: 'Occupied' },
  occupied_no_work: { ru: 'Простой', en: 'Idle' },
  active_work: { ru: 'В работе', en: 'Active' },
};

const STATUS_COLORS = POST_STATUS_COLORS;

const ZONE_COLORS = {
  entry: { fill: 'rgba(16, 185, 129, 0.08)', stroke: '#10b981' },
  waiting: { fill: 'rgba(245, 158, 11, 0.08)', stroke: '#f59e0b' },
  repair: { fill: 'rgba(99, 102, 241, 0.08)', stroke: '#6366f1' },
  diagnostics: { fill: 'rgba(168, 85, 247, 0.08)', stroke: '#a855f7' },
  driveway: { fill: 'rgba(107, 114, 128, 0.06)', stroke: '#6b7280' },
  parking: { fill: 'rgba(59, 130, 246, 0.08)', stroke: '#3b82f6' },
  free: { fill: 'rgba(148, 163, 184, 0.08)', stroke: '#94a3b8' },
};

// ─── РАСКЛАДКА v8 ──────────────────────────────────────────────────────────
// Верхний ряд: 5,6,7,8,9. Нижний ряд: 1,2,3,4,10
// Проезд между рядами. Въезд слева напротив проезда. Парковка по бокам въезда.
// Камеры в зоне проезда.
//
// Пост: 130×120. Зазор между постами: 10px. 5 постов = 5×130 + 4×10 = 690
// Зона ремонта: x=145, w=700 (5px padding по бокам)
// Парковка сверху: x=15, y=15, w=125, h=170
// Въезд: x=15, y=190, w=125, h=60 (напротив проезда)
// Парковка снизу: x=15, y=255, w=125, h=170
//
const MAP_LAYOUT = {
  width: 860,
  height: 460,
  building: { x: 10, y: 10, w: 840, h: 440 },
  zones: [
    // Верхний ремонт: посты 5,6,7,8,9
    { key: 'repair_upper', type: 'repair', x: 145, y: 15, w: 700, h: 165,
      label: 'Ремонтная зона (посты 5-9)', labelEN: 'Repair zone (posts 5-9)' },
    // Зона проезда
    { key: 'driveway', type: 'driveway', x: 145, y: 185, w: 700, h: 55,
      label: 'Проезд', labelEN: 'Driveway' },
    // Нижний ремонт: посты 1,2,3,4,10
    { key: 'repair_lower', type: 'repair', x: 145, y: 245, w: 700, h: 165,
      label: 'Ремонтная зона (посты 1-4, 10)', labelEN: 'Repair zone (posts 1-4, 10)' },
    // Парковка верх (слева сверху от въезда)
    { key: 'parking_top', type: 'parking', x: 15, y: 15, w: 125, h: 165,
      label: 'Парковка', labelEN: 'Parking' },
    // Въезд/выезд (напротив проезда)
    { key: 'entry', type: 'entry', x: 15, y: 185, w: 125, h: 55,
      label: 'Въезд/Выезд', labelEN: 'Entry/Exit' },
    // Парковка низ (слева снизу от въезда)
    { key: 'parking_bottom', type: 'parking', x: 15, y: 245, w: 125, h: 165,
      label: 'Парковка', labelEN: 'Parking' },
  ],
  posts: [
    // Верхний ряд (5,6,7,8,9): y=40..160
    { key: 'post05', x: 150, y: 40, w: 130, h: 120, label: 'Пост 5', labelEN: 'Post 5' },
    { key: 'post06', x: 290, y: 40, w: 130, h: 120, label: 'Пост 6', labelEN: 'Post 6' },
    { key: 'post07', x: 430, y: 40, w: 130, h: 120, label: 'Пост 7', labelEN: 'Post 7' },
    { key: 'post08', x: 570, y: 40, w: 130, h: 120, label: 'Пост 8', labelEN: 'Post 8' },
    { key: 'post09', x: 710, y: 40, w: 130, h: 120, label: 'Пост 9', labelEN: 'Post 9' },
    // Нижний ряд (1,2,3,4,10): y=270..390
    { key: 'post01', x: 150, y: 270, w: 130, h: 120, label: 'Пост 1', labelEN: 'Post 1' },
    { key: 'post02', x: 290, y: 270, w: 130, h: 120, label: 'Пост 2', labelEN: 'Post 2' },
    { key: 'post03', x: 430, y: 270, w: 130, h: 120, label: 'Пост 3', labelEN: 'Post 3' },
    { key: 'post04', x: 570, y: 270, w: 130, h: 120, label: 'Пост 4', labelEN: 'Post 4' },
    { key: 'post10', x: 710, y: 270, w: 130, h: 120, label: 'Пост 10', labelEN: 'Post 10' },
    { key: 'post01b', x: 150, y: 420, w: 130, h: 120, label: 'Пост 1\n(яма)', labelEN: 'Post 1\n(pit)', visible: false },
  ],
  // Камеры: в проезде (y=185..240, 55px) и на стенах
  cameras: [
    { key: 'cam01', x: 75,  y: 210, num: '01', angle: 0 },    // въезд, в центре
    { key: 'cam02', x: 75,  y: 100, num: '02', angle: 90 },   // парковка верх
    { key: 'cam03', x: 215, y: 210, num: '03', angle: 180 },  // проезд
    { key: 'cam04', x: 355, y: 210, num: '04', angle: 180 },  // проезд
    { key: 'cam05', x: 495, y: 210, num: '05', angle: 180 },  // проезд
    { key: 'cam06', x: 635, y: 210, num: '06', angle: 180 },  // проезд
    { key: 'cam07', x: 775, y: 210, num: '07', angle: 180 },  // проезд
    { key: 'cam08', x: 845, y: 100, num: '08', angle: 270 },  // правая стена верх
    { key: 'cam09', x: 75,  y: 340, num: '09', angle: 90 },   // парковка низ
    { key: 'cam10', x: 845, y: 340, num: '10', angle: 270 },  // правая стена низ
  ],
};

function fmtTime(t) {
  if (!t) return '—';
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function PostRect({ layout, post, isDark, onClick, isRu, dashPost }) {
  if (layout.visible === false && !post) return null;
  const status = post?.status || 'free';
  const color = STATUS_COLORS[status];
  const vehicle = post?.stays?.[0]?.vehicleSession;
  const postLabel = isRu ? layout.label : (layout.labelEN || layout.label);
  const isLarge = layout.h >= 200; // diagnostic posts are larger

  // Data from dashboard-posts
  const currentWO = dashPost?.timeline?.find(t => t.status === 'in_progress');
  const currentVehicle = dashPost?.currentVehicle;
  const workerName = currentWO?.worker;
  const note = currentWO?.note;

  const nameY = 5;
  const statusY = postLabel.includes('\n') ? 30 : 19;
  let y = statusY + 12;

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
      <Circle x={layout.w - 15} y={14} radius={6} fill={color} />
      {/* Post name */}
      <Text
        x={7} y={nameY}
        text={postLabel}
        fontSize={12}
        fontStyle="bold"
        fill={isDark ? '#f1f5f9' : '#1a202c'}
        lineHeight={1.15}
      />
      {/* Status text */}
      <Text
        x={7} y={statusY}
        text={STATUS_LABELS[status]?.[isRu ? 'ru' : 'en'] || status}
        fontSize={10}
        fill={color}
      />

      {/* Vehicle: brand + model */}
      {currentVehicle && (
        <Text
          x={7} y={y}
          width={layout.w - 14}
          text={`${currentVehicle.brand} ${currentVehicle.model}`}
          fontSize={10}
          fill={isDark ? '#94a3b8' : '#718096'}
          ellipsis={true}
        />
      )}

      {/* Work Order number */}
      {currentWO && (
        <Text
          x={7} y={y + (currentVehicle ? 13 : 0)}
          width={layout.w - 14}
          text={currentWO.workOrderNumber}
          fontSize={10}
          fontStyle="bold"
          fill={isDark ? '#a5b4fc' : '#6366f1'}
          ellipsis={true}
        />
      )}

      {/* Worker */}
      {workerName && (
        <Text
          x={7} y={y + (currentVehicle ? 26 : 13)}
          width={layout.w - 14}
          text={workerName}
          fontSize={9}
          fill={isDark ? '#94a3b8' : '#718096'}
          ellipsis={true}
        />
      )}

      {/* Time: placed → estimated end */}
      {(post?.stays?.[0]?.startTime || currentWO?.estimatedEnd) && (
        <Text
          x={7} y={y + (currentVehicle ? 38 : 26)}
          width={layout.w - 14}
          text={`${fmtTime(post?.stays?.[0]?.startTime)} → ${fmtTime(currentWO?.estimatedEnd)}`}
          fontSize={9}
          fill={isDark ? '#94a3b8' : '#718096'}
        />
      )}

      {/* Note (warning) — only on large posts (diagnostics) */}
      {note && layout.h >= 200 && (
        <Text
          x={7} y={y + (currentVehicle ? 52 : 39)}
          width={layout.w - 14}
          text={`⚠ ${note}`}
          fontSize={9}
          fill="#f59e0b"
          ellipsis={true}
        />
      )}

      {/* Vehicle plate at bottom */}
      {vehicle && (
        <Group>
          <Rect
            x={7} y={layout.h - 30}
            width={layout.w - 14}
            height={24}
            fill={isDark ? 'rgba(15, 23, 42, 0.7)' : 'rgba(240, 244, 248, 0.9)'}
            cornerRadius={6}
            stroke={color}
            strokeWidth={0.5}
          />
          <Text
            x={7} y={layout.h - 30}
            width={layout.w - 14}
            height={24}
            text={vehicle.plateNumber || '—'}
            fontSize={12}
            fontStyle="bold"
            fill={isDark ? '#e2e8f0' : '#1a202c'}
            align="center"
            verticalAlign="middle"
          />
        </Group>
      )}
    </Group>
  );
}

function CameraIcon({ cam, isDark, isRu, onClick }) {
  const label = (isRu ? 'КАМ' : 'CAM') + cam.num;
  return (
    <Group x={cam.x} y={cam.y} onClick={() => onClick?.(cam.num)} onTap={() => onClick?.(cam.num)}>
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

export default function STOMap({ zones = [], onPostClick, onCameraClick, isDark = true, dashboardData = null }) {
  const { i18n } = useTranslation();
  const containerRef = useRef(null);
  const [stageSize, setStageSize] = useState({ width: 860, height: 460 });
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const w = containerRef.current.offsetWidth;
        const s = w / MAP_LAYOUT.width;
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
          {Array.from({ length: 21 }).map((_, i) => (
            <Line key={`gv${i}`} points={[i * 50, 0, i * 50, MAP_LAYOUT.height]}
              stroke={isDark ? 'rgba(148,163,184,0.04)' : 'rgba(0,0,0,0.02)'} strokeWidth={1} />
          ))}
          {Array.from({ length: 10 }).map((_, i) => (
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

          {/* No vertical divider — all posts in same area */}

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
          {MAP_LAYOUT.posts.map(pl => {
            // Match dashboard data by post number
            const num = pl.label.match(/\d+/)?.[0];
            const dashPost = dashboardData?.posts?.find(p => p.number === parseInt(num, 10));
            return (
              <PostRect key={pl.key} layout={pl} post={postMap[pl.key]} isDark={isDark} onClick={onPostClick} isRu={isRu} dashPost={dashPost} />
            );
          })}

          {/* Cameras */}
          {MAP_LAYOUT.cameras.map(cam => (
            <CameraIcon key={cam.key} cam={cam} isDark={isDark} isRu={isRu} onClick={onCameraClick} />
          ))}

          {/* Entry arrows inside entry zone */}
          <Arrow
            points={[15, 205, 55, 205]}
            stroke={isDark ? 'rgba(16,185,129,0.5)' : 'rgba(16,185,129,0.7)'}
            strokeWidth={2} pointerLength={6} pointerWidth={5}
          />
          <Arrow
            points={[55, 225, 15, 225]}
            stroke={isDark ? 'rgba(239,68,68,0.4)' : 'rgba(239,68,68,0.6)'}
            strokeWidth={2} pointerLength={6} pointerWidth={5}
          />

          {/* Flow arrow: entry → driveway */}
          <Arrow
            points={[137, 212, 148, 212]}
            stroke={isDark ? 'rgba(107,114,128,0.4)' : 'rgba(107,114,128,0.6)'}
            strokeWidth={2} pointerLength={6} pointerWidth={5}
          />

          {/* Legend — compact, bottom-right inside building */}
          <Group x={615} y={420}>
            <Rect
              width={220} height={25}
              fill={isDark ? 'rgba(15,23,42,0.9)' : 'rgba(255,255,255,0.9)'}
              stroke={isDark ? 'rgba(148,163,184,0.15)' : 'rgba(0,0,0,0.08)'}
              cornerRadius={6}
            />
            {Object.entries(STATUS_COLORS).map(([status, color], i) => (
              <Group key={status} x={10 + i * 54} y={7}>
                <Circle x={0} y={4} radius={3} fill={color} />
                <Text
                  x={7} y={0}
                  text={isRu ? {
                    free: 'Своб.',
                    occupied: 'Занят',
                    occupied_no_work: 'Прост.',
                    active_work: 'Работа',
                  }[status] : {
                    free: 'Free',
                    occupied: 'Busy',
                    occupied_no_work: 'Idle',
                    active_work: 'Work',
                  }[status]}
                  fontSize={8}
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
