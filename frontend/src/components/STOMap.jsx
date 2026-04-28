import { useState, useEffect, useRef } from 'react';
import { Stage, Layer, Rect, Text, Group, Line, Circle, Arrow } from 'react-konva';
import { useTranslation } from 'react-i18next';
import { POST_STATUS_COLORS } from '../constants';
import { getZoneColors, MAP_BG, GRID_STROKE, BUILDING_STROKE, CAMERA_FOV_OPACITY } from '../constants/mapTheme';
import { usePostTimerText } from './PostTimer';

const STATUS_LABELS = {
  free: { ru: 'Свободен', en: 'Free' },
  occupied: { ru: 'Занят', en: 'Occupied' },
  occupied_no_work: { ru: 'Простой', en: 'Idle' },
  active_work: { ru: 'В работе', en: 'Active' },
  no_data: { ru: 'Нет данных', en: 'No data' },
};

const STATUS_COLORS = POST_STATUS_COLORS;

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
  const currentWOForTimer = dashPost?.timeline?.find(t => t.status === 'in_progress');
  const timer = usePostTimerText(currentWOForTimer?.estimatedEnd || currentWOForTimer?.endTime, currentWOForTimer?.startTime);
  const vehicle = post?.stays?.[0]?.vehicleSession;
  const postLabel = isRu ? layout.label : (layout.labelEN || layout.label);

  // Data from dashboard-posts
  const currentWO = dashPost?.timeline?.find(t => t.status === 'in_progress');
  const currentVehicle = dashPost?.currentVehicle;
  const workerName = currentWO?.worker;
  const workType = currentWO?.workType;
  const isFree = status === 'free';
  const isIdle = status === 'occupied_no_work';

  // Short worker name: "Фамилия И."
  const shortWorker = workerName ? (() => {
    const parts = workerName.split(' ');
    return parts.length >= 2 ? `${parts[0]} ${parts[1][0]}.` : parts[0];
  })() : null;

  const W = layout.w;
  const H = layout.h;
  const pad = 6;

  return (
    <Group
      x={layout.x}
      y={layout.y}
      onClick={() => onClick?.(post)}
      onTap={() => onClick?.(post)}
    >
      {/* Card background */}
      <Rect
        width={W} height={H}
        fill={isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.85)'}
        stroke={color}
        strokeWidth={status === 'active_work' ? 2.5 : 1.5}
        cornerRadius={8}
        shadowColor={color}
        shadowBlur={status === 'active_work' ? 12 : 3}
        shadowOpacity={status === 'active_work' ? 0.5 : 0.2}
      />
      {/* Top accent bar */}
      <Rect
        x={1} y={1}
        width={W - 2} height={3}
        fill={color}
        cornerRadius={[8, 8, 0, 0]}
      />

      {/* Header row: Post name + status dot */}
      <Text
        x={pad} y={8}
        text={postLabel.replace('\n', ' ')}
        fontSize={11}
        fontStyle="bold"
        fill={isDark ? '#e2e8f0' : '#1e293b'}
      />
      <Circle x={W - 12} y={14} radius={5} fill={color} />
      {/* Status text next to dot */}
      <Text
        x={pad} y={21}
        width={W - pad * 2}
        text={STATUS_LABELS[status]?.[isRu ? 'ru' : 'en'] || status}
        fontSize={9}
        fill={color}
        fontStyle="bold"
      />

      {/* ── Content area ── */}
      {isFree ? (
        /* Free post — show "—" centered */
        <Text
          x={pad} y={38}
          width={W - pad * 2} height={H - 50}
          text="—"
          fontSize={16}
          fill={isDark ? '#334155' : '#cbd5e1'}
          align="center"
          verticalAlign="middle"
        />
      ) : (<>
        {/* Divider line */}
        <Line
          points={[pad, 33, W - pad, 33]}
          stroke={isDark ? 'rgba(148,163,184,0.15)' : 'rgba(0,0,0,0.08)'}
          strokeWidth={1}
        />

        {/* Vehicle plate — prominent */}
        {vehicle && (
          <Group>
            <Rect
              x={pad} y={37}
              width={W - pad * 2} height={18}
              fill={isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.08)'}
              cornerRadius={4}
            />
            <Text
              x={pad} y={37}
              width={W - pad * 2} height={18}
              text={vehicle.plateNumber || '—'}
              fontSize={11}
              fontStyle="bold"
              fill={isDark ? '#e2e8f0' : '#1e293b'}
              align="center"
              verticalAlign="middle"
            />
          </Group>
        )}

        {/* Brand + Model */}
        {currentVehicle && (
          <Text
            x={pad} y={58}
            width={W - pad * 2}
            text={`${currentVehicle.brand} ${currentVehicle.model}`}
            fontSize={9}
            fill={isDark ? '#64748b' : '#94a3b8'}
            ellipsis={true}
          />
        )}

        {/* Work type */}
        {workType && (
          <Text
            x={pad} y={69}
            width={W - pad * 2}
            text={workType}
            fontSize={9}
            fontStyle="bold"
            fill={isDark ? '#a5b4fc' : '#6366f1'}
            ellipsis={true}
          />
        )}

        {/* Worker name (short) */}
        {shortWorker && (
          <Text
            x={pad} y={80}
            width={W - pad * 2}
            text={shortWorker}
            fontSize={9}
            fill={isDark ? '#64748b' : '#94a3b8'}
            ellipsis={true}
          />
        )}

        {/* Time range */}
        {(post?.stays?.[0]?.startTime || currentWO?.estimatedEnd) && (
          <Text
            x={pad} y={91}
            width={W - pad * 2}
            text={`${fmtTime(post?.stays?.[0]?.startTime)} → ${fmtTime(currentWO?.estimatedEnd)}`}
            fontSize={9}
            fill={isDark ? '#64748b' : '#94a3b8'}
          />
        )}

        {/* Timer bar at bottom */}
        {timer.text && (
          <Group>
            <Rect
              x={pad} y={H - 20}
              width={W - pad * 2} height={16}
              fill={timer.color} cornerRadius={4} opacity={0.9}
            />
            <Text
              x={pad} y={H - 19}
              width={W - pad * 2} height={14}
              text={timer.text}
              fontSize={9} fontStyle="bold" fill="#fff"
              align="center" verticalAlign="middle"
            />
          </Group>
        )}

        {/* Idle indicator (no timer but occupied) */}
        {isIdle && !timer.text && (
          <Group>
            <Rect
              x={pad} y={H - 20}
              width={W - pad * 2} height={16}
              fill={isDark ? 'rgba(234,179,8,0.15)' : 'rgba(234,179,8,0.1)'}
              cornerRadius={4}
              stroke="rgba(234,179,8,0.3)"
              strokeWidth={1}
            />
            <Text
              x={pad} y={H - 19}
              width={W - pad * 2} height={14}
              text={isRu ? 'Простой' : 'Idle'}
              fontSize={9} fontStyle="bold" fill="#eab308"
              align="center" verticalAlign="middle"
            />
          </Group>
        )}
      </>)}
    </Group>
  );
}

function CameraIcon({ cam, isDark, isRu, onClick, online }) {
  const label = (isRu ? 'КАМ' : 'CAM') + cam.num;
  const camColor = online === true ? '#10b981' : online === false ? '#94a3b8' : '#ef4444';
  const camOpacity = online === false ? 0.5 : 1;
  return (
    <Group x={cam.x} y={cam.y} onClick={() => onClick?.(cam.num)} onTap={() => onClick?.(cam.num)} opacity={camOpacity}>
      <Circle radius={8} fill={isDark ? '#334155' : '#e2e8f0'} stroke={camColor} strokeWidth={1.5} />
      <Circle radius={3} fill={camColor} />
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
        stroke={`rgba(239, 68, 68, ${isDark ? CAMERA_FOV_OPACITY.dark : CAMERA_FOV_OPACITY.light})`} strokeWidth={1}
      />
      <Line
        points={[0, 0, Math.cos((cam.angle + 25) * Math.PI / 180) * 22, Math.sin((cam.angle + 25) * Math.PI / 180) * 22]}
        stroke={`rgba(239, 68, 68, ${isDark ? CAMERA_FOV_OPACITY.dark : CAMERA_FOV_OPACITY.light})`} strokeWidth={1}
      />
    </Group>
  );
}

export default function STOMap({ zones = [], onPostClick, onCameraClick, isDark = true, dashboardData = null, bgImageOpacity, cameraStatuses = {} }) {
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
            fill={isDark ? MAP_BG.dark : MAP_BG.light}
            cornerRadius={16}
          />

          {/* Grid */}
          {Array.from({ length: 21 }).map((_, i) => (
            <Line key={`gv${i}`} points={[i * 50, 0, i * 50, MAP_LAYOUT.height]}
              stroke={isDark ? GRID_STROKE.dark : GRID_STROKE.light} strokeWidth={1} />
          ))}
          {Array.from({ length: 10 }).map((_, i) => (
            <Line key={`gh${i}`} points={[0, i * 50, MAP_LAYOUT.width, i * 50]}
              stroke={isDark ? GRID_STROKE.dark : GRID_STROKE.light} strokeWidth={1} />
          ))}

          {/* Building walls */}
          <Rect
            x={MAP_LAYOUT.building.x} y={MAP_LAYOUT.building.y}
            width={MAP_LAYOUT.building.w} height={MAP_LAYOUT.building.h}
            fill="transparent"
            stroke={isDark ? BUILDING_STROKE.dark : BUILDING_STROKE.light}
            strokeWidth={2}
            cornerRadius={4}
          />

          {/* No vertical divider — all posts in same area */}

          {/* Zones */}
          {MAP_LAYOUT.zones.map(zl => {
            const zoneTheme = getZoneColors(isDark);
            const colors = zoneTheme[zl.type] || zoneTheme.free;
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
          {MAP_LAYOUT.cameras.map(cam => {
            const camStatus = cameraStatuses[cam.key];
            return (
              <CameraIcon key={cam.key} cam={cam} isDark={isDark} isRu={isRu} onClick={onCameraClick}
                online={camStatus?.online} />
            );
          })}

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
