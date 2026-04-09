import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from './useSocket';

export function useCameraStatus() {
  const { api } = useAuth();
  const [statuses, setStatuses] = useState({});

  useEffect(() => {
    api.get('/api/cameras/health')
      .then(r => setStatuses(r.data || {}))
      .catch(() => {});
  }, []);

  useSocket('camera:status', (data) => {
    setStatuses(prev => ({ ...prev, [data.camId]: { online: data.online } }));
  });

  return statuses;
}
