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
const UserGuide = lazy(() => import('./pages/UserGuide'));
const LiveDebug = lazy(() => import('./pages/LiveDebug'));
const PostHistory = lazy(() => import('./pages/PostHistory'));
const ZoneHistory = lazy(() => import('./pages/PostHistory').then(m => ({ default: m.ZoneHistory })));
const Discrepancies = lazy(() => import('./pages/Discrepancies'));
const OrderMatching = lazy(() => import('./pages/OrderMatching'));
const UtilizationReport = lazy(() => import('./pages/UtilizationReport'));

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

function ProtectedRoute({ children, pageId }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  // Если задан pageId — проверяем доступ. admin всегда имеет доступ ко всему.
  if (pageId && user.role !== 'admin' && !user.pages?.includes(pageId)) {
    return <Navigate to="/" replace />;
  }
  return children;
}

// Компактная обёртка для страниц внутри Layout
function Page({ id, children }) {
  return <ProtectedRoute pageId={id}>{children}</ProtectedRoute>;
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
          <Route path="live-debug" element={<Page id="live-debug"><LiveDebug /></Page>} />
          <Route index element={<Page id="dashboard"><Dashboard /></Page>} />
          <Route path="dashboard-posts" element={<Page id="dashboard-posts"><DashboardPosts /></Page>} />
          <Route path="posts-detail" element={<Page id="posts-detail"><PostsDetail /></Page>} />
          <Route path="sessions" element={<Page id="sessions"><Sessions /></Page>} />
          <Route path="work-orders" element={<Page id="work-orders"><WorkOrders /></Page>} />
          <Route path="events" element={<Page id="events"><Events /></Page>} />
          <Route path="analytics" element={<Page id="analytics"><Analytics /></Page>} />
          <Route path="data-1c" element={<Page id="data-1c"><Data1C /></Page>} />
          <Route path="discrepancies" element={<Page id="discrepancies"><Discrepancies /></Page>} />
          <Route path="order-matching" element={<Page id="discrepancies"><OrderMatching /></Page>} />
          <Route path="cameras" element={<Page id="cameras"><Cameras /></Page>} />
          <Route path="users" element={<Page id="users"><Users /></Page>} />
          <Route path="map-editor" element={<Page id="map-editor"><MapEditor /></Page>} />
          <Route path="map-view" element={<Page id="map-view"><MapViewer /></Page>} />
          <Route path="shifts" element={<Page id="shifts"><Shifts /></Page>} />
          <Route path="audit" element={<Page id="audit"><Audit /></Page>} />
          <Route path="my-post" element={<Page id="my-post"><MyPost /></Page>} />
          <Route path="health" element={<Page id="health"><Health /></Page>} />
          <Route path="worker-stats/:workerName" element={<Page id="analytics"><WorkerStats /></Page>} />
          <Route path="post-history/:postNumber" element={<Page id="posts-detail"><PostHistory /></Page>} />
          <Route path="zone-history/:zoneName" element={<Page id="posts-detail"><ZoneHistory /></Page>} />
          <Route path="utilization" element={<Page id="utilization"><UtilizationReport /></Page>} />
          <Route path="report-schedule" element={<Page id="report-schedule"><ReportSchedule /></Page>} />
          <Route path="tech-docs" element={<Page id="tech-docs"><TechDocs /></Page>} />
          <Route path="user-guide" element={<Page id="user-guide"><UserGuide /></Page>} />
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
