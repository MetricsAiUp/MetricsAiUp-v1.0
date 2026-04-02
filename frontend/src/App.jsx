import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import MapView from './pages/MapView';
import Sessions from './pages/Sessions';
import WorkOrders from './pages/WorkOrders';
import Events from './pages/Events';
import Analytics from './pages/Analytics';
import Data1C from './pages/Data1C';
import Cameras from './pages/Cameras';
import CameraMapping from './pages/CameraMapping';
import DashboardPosts from './pages/DashboardPosts';
import PostsDetail from './pages/PostsDetail';
import Users from './pages/Users';
import './i18n';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  return children;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) return null;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="dashboard-posts" element={<DashboardPosts />} />
        <Route path="posts-detail" element={<PostsDetail />} />
        <Route path="map" element={<MapView />} />
        <Route path="sessions" element={<Sessions />} />
        <Route path="work-orders" element={<WorkOrders />} />
        <Route path="events" element={<Events />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="data-1c" element={<Data1C />} />
        <Route path="cameras" element={<Cameras />} />
        <Route path="camera-mapping" element={<CameraMapping />} />
        <Route path="users" element={<Users />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <HashRouter>
      <ThemeProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ThemeProvider>
    </HashRouter>
  );
}
