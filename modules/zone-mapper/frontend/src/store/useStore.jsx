import { createContext, useContext, useReducer, useCallback } from 'react';
import * as api from '../api/client';

const StoreContext = createContext();

const initialState = {
  rooms: [],
  currentRoom: null,
  selectedZoneId: null,
  selectedCameraId: null,
  projection: null,
  loading: false
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_ROOMS': return { ...state, rooms: action.payload };
    case 'SET_CURRENT_ROOM': return { ...state, currentRoom: action.payload, selectedZoneId: null, selectedCameraId: null, projection: null };
    case 'SELECT_ZONE': return { ...state, selectedZoneId: action.payload, selectedCameraId: null, projection: null };
    case 'SELECT_CAMERA': return { ...state, selectedCameraId: action.payload, selectedZoneId: null };
    case 'SET_PROJECTION': return { ...state, projection: action.payload };
    case 'SET_LOADING': return { ...state, loading: action.payload };
    default: return state;
  }
}

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const fetchRooms = useCallback(async () => {
    const rooms = await api.getRooms();
    dispatch({ type: 'SET_ROOMS', payload: rooms });
  }, []);

  const fetchRoom = useCallback(async (id) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    const room = await api.getRoom(id);
    dispatch({ type: 'SET_CURRENT_ROOM', payload: room });
    dispatch({ type: 'SET_LOADING', payload: false });
  }, []);

  const addRoom = useCallback(async (data) => {
    const room = await api.createRoom(data);
    await fetchRooms();
    return room;
  }, [fetchRooms]);

  const removeRoom = useCallback(async (id) => {
    await api.deleteRoom(id);
    dispatch({ type: 'SET_CURRENT_ROOM', payload: null });
    await fetchRooms();
  }, [fetchRooms]);

  const editRoom = useCallback(async (id, data) => {
    await api.updateRoom(id, data);
    await fetchRoom(id);
    await fetchRooms();
  }, [fetchRoom, fetchRooms]);

  const addZone = useCallback(async (data) => {
    if (!state.currentRoom) return;
    await api.createZone(state.currentRoom.id, data);
    await fetchRoom(state.currentRoom.id);
  }, [state.currentRoom, fetchRoom]);

  const editZone = useCallback(async (zoneId, data) => {
    if (!state.currentRoom) return;
    await api.updateZone(state.currentRoom.id, zoneId, data);
    await fetchRoom(state.currentRoom.id);
  }, [state.currentRoom, fetchRoom]);

  const removeZone = useCallback(async (zoneId) => {
    if (!state.currentRoom) return;
    await api.deleteZone(state.currentRoom.id, zoneId);
    dispatch({ type: 'SELECT_ZONE', payload: null });
    await fetchRoom(state.currentRoom.id);
  }, [state.currentRoom, fetchRoom]);

  const addCamera = useCallback(async (data) => {
    if (!state.currentRoom) return;
    await api.createCamera(state.currentRoom.id, data);
    await fetchRoom(state.currentRoom.id);
  }, [state.currentRoom, fetchRoom]);

  const editCamera = useCallback(async (camId, data) => {
    if (!state.currentRoom) return;
    await api.updateCamera(state.currentRoom.id, camId, data);
    await fetchRoom(state.currentRoom.id);
  }, [state.currentRoom, fetchRoom]);

  const removeCamera = useCallback(async (camId) => {
    if (!state.currentRoom) return;
    await api.deleteCamera(state.currentRoom.id, camId);
    dispatch({ type: 'SELECT_CAMERA', payload: null });
    await fetchRoom(state.currentRoom.id);
  }, [state.currentRoom, fetchRoom]);

  const fetchProjection = useCallback(async (camId) => {
    if (!state.currentRoom) return;
    const proj = await api.getProjection(state.currentRoom.id, camId);
    dispatch({ type: 'SET_PROJECTION', payload: proj });
  }, [state.currentRoom]);

  const downloadExport = useCallback(async (camId) => {
    if (!state.currentRoom) return;
    const config = await api.exportConfig(state.currentRoom.id, camId);
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${config.cameraName || 'camera'}-zones.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [state.currentRoom]);

  const selectZone = (id) => dispatch({ type: 'SELECT_ZONE', payload: id });
  const selectCamera = (id) => dispatch({ type: 'SELECT_CAMERA', payload: id });

  const value = {
    ...state,
    fetchRooms, fetchRoom, addRoom, removeRoom, editRoom,
    addZone, editZone, removeZone,
    addCamera, editCamera, removeCamera,
    selectZone, selectCamera,
    fetchProjection, downloadExport
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export const useStore = () => useContext(StoreContext);
