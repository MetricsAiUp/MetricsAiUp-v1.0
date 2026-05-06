import { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import { useTranslation } from 'react-i18next';
import './i18n';

// Lazy-loaded pages (code splitting)
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const DashboardPosts = lazy(() => import('./pages/DashboardPosts'));
const PostsDetail = lazy(() => import('./pages/PostsDetail'));
const Sessions = lazy(() => import('./pages/Sessions'));
const WorkOrders = lazy(() => import('./pages/WorkOrders'));
const Events = lazy(() => import('./pages/Events'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Data1C = lazy(() => import('./pages/Data1C'));
const Cameras = lazy(() => import('./pages/Cameras'));
const Users = lazy(() => import('./pages/Users'));
const MapEditor = lazy(() => import('./pages/MapEditor'));
const MapViewer = lazy(() => import('./pages/MapViewer'));
const Shifts = lazy(() => import('./pages/Shifts'));
const Audit = lazy(() => import('./pages/Audit'));
const MyPost = lazy(() => import('./pages/MyPost'));
const Health = lazy(() => import('./pages/Health'));
const WorkerStats = lazy(() => import('./pages/WorkerStats'));
const ReportSchedule = lazy(() => import('./pages/ReportSchedule'));
const TechDocs = lazy(() => import('./pages/TechDocs'));
const LiveDebug = lazy(() => import('./pages/LiveDebug'));
const PostHistory = lazy(() => import('./pages/PostHistory'));
const ZoneHistory = lazy(() => import('./pages/PostHistory').then(m => ({ default: m.ZoneHistory })));
const Discrepancies = lazy(() => import('./pages/Discrepancies'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center p-12" style={{ color: 'var(--text-muted)' }}>
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
        <span className="text-sm">Loading...</span>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  return children;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  const { t } = useTranslation();

  if (loading) return null;

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
        <Route path="/" element={
          <ProtectedRoute>
            <ErrorBoundary fallbackTitle={t('common.errorOccurred')} retryLabel={t('common.retry')}>
              <Layout />
            </ErrorBoundary>
          </ProtectedRoute>
        }>
          <Route path="live-debug" element={<LiveDebug />} />
          <Route index element={<Dashboard />} />
          <Route path="dashboard-posts" element={<DashboardPosts />} />
          <Route path="posts-detail" element={<PostsDetail />} />
          <Route path="sessions" element={<Sessions />} />
          <Route path="work-orders" element={<WorkOrders />} />
          <Route path="events" element={<Events />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="data-1c" element={<Data1C />} />
          <Route path="discrepancies" element={<Discrepancies />} />
          <Route path="cameras" element={<Cameras />} />
          <Route path="users" element={<Users />} />
          <Route path="map-editor" element={<MapEditor />} />
          <Route path="map-view" element={<MapViewer />} />
          <Route path="shifts" element={<Shifts />} />
          <Route path="audit" element={<Audit />} />
          <Route path="my-post" element={<MyPost />} />
          <Route path="health" element={<Health />} />
          <Route path="worker-stats/:workerName" element={<WorkerStats />} />
          <Route path="post-history/:postNumber" element={<PostHistory />} />
          <Route path="zone-history/:zoneName" element={<ZoneHistory />} />
          <Route path="report-schedule" element={<ReportSchedule />} />
          <Route path="tech-docs" element={<TechDocs />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <HashRouter>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </HashRouter>
  );
}
