import { useState, useEffect, useRef, useCallback } from 'react';

export function useWorkOrderTimer(workOrder, api) {
  const [elapsedMs, setElapsedMs] = useState(0);
  const intervalRef = useRef(null);

  const isPaused = !!workOrder?.pausedAt;
  const isRunning = workOrder?.status === 'in_progress' && !isPaused;
  const normMs = (workOrder?.normHours || 0) * 3600000;
  const percentUsed = normMs > 0 ? Math.min((elapsedMs / normMs) * 100, 200) : 0;
  const warningLevel = percentUsed >= 100 ? 'overtime' : percentUsed >= 95 ? 'critical' : percentUsed >= 80 ? 'warning' : 'none';

  useEffect(() => {
    if (!workOrder?.startTime) { setElapsedMs(0); return; }
    const calc = () => {
      const start = new Date(workOrder.startTime).getTime();
      const paused = workOrder.totalPausedMs || 0;
      if (workOrder.pausedAt) {
        setElapsedMs(new Date(workOrder.pausedAt).getTime() - start - paused);
      } else if (workOrder.status === 'in_progress') {
        setElapsedMs(Date.now() - start - paused);
      } else if (workOrder.endTime) {
        const totalPaused = workOrder.totalPausedMs || 0;
        setElapsedMs(new Date(workOrder.endTime).getTime() - start - totalPaused);
      }
    };
    calc();
    if (isRunning) { intervalRef.current = setInterval(calc, 1000); }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [workOrder?.startTime, workOrder?.pausedAt, workOrder?.totalPausedMs, workOrder?.status, isRunning]);

  const start = useCallback(async () => {
    if (!workOrder?.id || !api) return;
    return api.post(`/api/work-orders/${workOrder.id}/start`);
  }, [workOrder?.id, api]);

  const pause = useCallback(async () => {
    if (!workOrder?.id || !api) return;
    return api.post(`/api/work-orders/${workOrder.id}/pause`);
  }, [workOrder?.id, api]);

  const resume = useCallback(async () => {
    if (!workOrder?.id || !api) return;
    return api.post(`/api/work-orders/${workOrder.id}/resume`);
  }, [workOrder?.id, api]);

  const complete = useCallback(async () => {
    if (!workOrder?.id || !api) return;
    return api.post(`/api/work-orders/${workOrder.id}/complete`);
  }, [workOrder?.id, api]);

  return { elapsedMs, percentUsed, warningLevel, isPaused, isRunning, start, pause, resume, complete };
}
