// ============================
// MetricsAiUp Type Definitions
// ============================

// --- User & Auth ---
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  roles: UserRole[];
  pages: PageId[];
  permissions: string[];
  isActive?: boolean;
  createdAt?: string;
  password?: string;
}

export type UserRole = 'admin' | 'manager' | 'director' | 'mechanic' | 'viewer';

export type PageId =
  | 'dashboard' | 'dashboard-posts' | 'posts-detail' | 'map'
  | 'sessions' | 'work-orders' | 'events' | 'analytics'
  | 'cameras' | 'data-1c' | 'users';

export interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
  hasPermission: (key: string) => boolean;
  updateCurrentUser: (updatedUser: Partial<User>) => void;
  api: ApiClient;
}

export interface ApiClient {
  get: (url: string) => Promise<{ data: any }>;
  post: (url: string, body?: any) => Promise<{ data: any }>;
  put: (url: string, body?: any) => Promise<{ data: any }>;
  delete: (url: string) => Promise<{ data: any }>;
}

// --- Post ---
export type PostStatus = 'free' | 'occupied' | 'occupied_no_work' | 'active_work';
export type PostType = 'light' | 'heavy' | 'special';

export interface Post {
  id: string;
  name: string;
  number: number;
  type: PostType;
  status: PostStatus;
  zoneId: string;
  zone?: Zone;
  isActive: boolean;
  coordinates?: any;
  stays?: PostStay[];
}

// --- Zone ---
export type ZoneType = 'repair' | 'waiting' | 'entry' | 'parking' | 'free';

export interface Zone {
  id: string;
  name: string;
  type: ZoneType;
  description?: string;
  isActive: boolean;
  posts?: Post[];
  cameras?: CameraZone[];
}

// --- Vehicle Session ---
export interface VehicleSession {
  id: string;
  plateNumber?: string;
  entryTime: string;
  exitTime?: string;
  status: 'active' | 'completed';
  trackId?: string;
  zoneStays?: ZoneStay[];
  postStays?: PostStay[];
}

export interface ZoneStay {
  id: string;
  zoneId: string;
  vehicleSessionId: string;
  entryTime: string;
  exitTime?: string;
  duration?: number;
}

export interface PostStay {
  id: string;
  postId: string;
  vehicleSessionId: string;
  startTime: string;
  endTime?: string;
  hasWorker: boolean;
  isActive: boolean;
  activeTime?: number;
  idleTime?: number;
  vehicleSession?: VehicleSession;
}

// --- Work Order ---
export type WorkOrderStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';

export interface WorkOrder {
  id: string;
  externalId?: string;
  orderNumber: string;
  scheduledTime?: string;
  status: WorkOrderStatus;
  plateNumber?: string;
  workType?: string;
  normHours?: number;
  actualHours?: number;
}

// --- Event ---
export type EventType =
  | 'vehicle_entered_zone' | 'vehicle_left_zone' | 'vehicle_moving'
  | 'post_occupied' | 'post_vacated'
  | 'worker_present' | 'worker_absent'
  | 'work_activity' | 'work_idle'
  | 'plate_recognized';

export interface CVEvent {
  id: string;
  type: EventType;
  zoneId?: string;
  postId?: string;
  vehicleSessionId?: string;
  cameraId?: string;
  confidence?: number;
  createdAt: string;
  zone?: Zone;
  post?: Post;
}

// --- Camera ---
export interface Camera {
  id: string;
  name: string;
  rtspUrl?: string;
  isActive: boolean;
  zones?: CameraZone[];
}

export interface CameraZone {
  cameraId: string;
  zoneId: string;
  priority: number;
  camera?: Camera;
  zone?: Zone;
}

// --- Recommendation ---
export type RecommendationType = 'no_show' | 'post_free' | 'capacity_available' | 'work_overtime' | 'vehicle_idle';

export interface Recommendation {
  id: string;
  type: RecommendationType;
  message: string;
  messageEn?: string;
  status: 'active' | 'acknowledged' | 'resolved';
  zoneId?: string;
  postId?: string;
  zone?: Zone;
  post?: Post;
}

// --- Dashboard ---
export interface DashboardOverview {
  activeSessions: number;
  zonesWithVehicles: { _count: number; zoneId: string }[];
  postsStatus: { _count: number; status: PostStatus }[];
  activeRecommendations: number;
}

// --- 1C Data ---
export interface PlanningRecord {
  id: number | string;
  document: string;
  master: string;
  author: string;
  organization: string;
  vehicle: string;
  number: string;
  plateNumber: string;
  vin: string;
  startTime: string;
  endTime: string;
  workStation: string;
  executor: string;
  durationSec: number;
  durationHours: number;
  notRelevant: string;
  planObject: string;
  objectView: string;
}

export interface WorkerRecord {
  id: number | string;
  repairType: string;
  number: string;
  vin: string;
  brand: string;
  model: string;
  year: string;
  workOrder: string;
  worker: string;
  startDate: string;
  endDate: string;
  closeDate: string;
  orderStatus: string;
  master: string;
  dispatcher: string;
  normHours: number;
}
