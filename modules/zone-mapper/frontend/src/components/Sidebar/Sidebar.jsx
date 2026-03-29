import { useStore } from '../../store/useStore';
import RoomList from './RoomList';
import RoomForm from './RoomForm';
import ZoneList from './ZoneList';
import ZoneForm from './ZoneForm';
import CameraList from './CameraList';
import CameraForm from './CameraForm';

export default function Sidebar() {
  const { currentRoom, selectedZoneId, selectedCameraId } = useStore();

  return (
    <div className="flex-1 overflow-y-auto">
      <RoomList />

      {currentRoom && (
        <>
          <RoomForm />
          <div className="border-t border-slate-700" />
          <ZoneList />
          {selectedZoneId && <ZoneForm />}
          <div className="border-t border-slate-700" />
          <CameraList />
          {selectedCameraId && <CameraForm />}
        </>
      )}
    </div>
  );
}
