import { StrictMode, Suspense, useEffect, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import '@fontsource-variable/onest';
import '@fontsource-variable/unbounded';
import './styles.css';
import { AuthProvider, useAuth } from './auth';
import { NewsProvider } from './news';
import type { Role } from './api';
import { AppLayout } from './components/Layout';
import { ToastProvider } from './components/Toast';
import { PageSkeleton } from './components/PageSkeleton';

import {
  AttendancePage,
  CabinetPage,
  GroupLayout,
  GroupsPage,
  LessonPage,
  LoginPage,
  MyHeroPage,
  PrintPage,
  ReasonsPage,
  SettingsPage,
  StatsPage,
  StudentHeroPage,
  StudentViewPage,
  StudentsPage,
  prefetchPages,
  preloadRoute,
} from './pages';
import { ChunkErrorBoundary } from './components/ChunkErrorBoundary';

/** Подгружаем страницы роли в фоне сразу после входа */
function Prefetch() {
  const { user } = useAuth();
  useEffect(() => {
    if (user) prefetchPages(user.role);
  }, [user]);
  return null;
}

function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageSkeleton />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (user.role !== role) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function Home() {
  const { user, loading } = useAuth();
  if (loading) return <PageSkeleton />;
  if (!user) return <Navigate to="/login" replace />;
  return user.role === 'TEACHER' ? <GroupsPage /> : <CabinetPage />;
}

const teacher = (el: ReactNode) => <RequireRole role="TEACHER">{el}</RequireRole>;
const student = (el: ReactNode) => <RequireRole role="STUDENT">{el}</RequireRole>;

// Ждём код открытой страницы (он маленький и грузится параллельно с данными), но не дольше 2 с:
// так первая отрисовка сразу показывает страницу, без промежуточной заглушки
await Promise.race([preloadRoute(window.location.pathname), new Promise((resolve) => setTimeout(resolve, 2000))]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <NewsProvider>
      <ToastProvider>
        <BrowserRouter>
          <Prefetch />
          <ChunkErrorBoundary>
          <Suspense fallback={<PageSkeleton />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            {/* Печать и режим проектора — без общей шапки */}
            <Route path="/g/:groupId/print" element={teacher(<PrintPage />)} />
            <Route element={<AppLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/hero" element={student(<MyHeroPage />)} />
              <Route path="/g/:groupId" element={teacher(<GroupLayout />)}>
                <Route index element={<LessonPage />} />
                <Route path="attendance" element={<AttendancePage />} />
                <Route path="students" element={<StudentsPage />} />
                <Route path="reasons" element={<ReasonsPage />} />
                <Route path="stats" element={<StatsPage />} />
              </Route>
              <Route path="/settings" element={teacher(<SettingsPage />)} />
              <Route path="/s/:studentId" element={teacher(<StudentViewPage />)} />
              <Route path="/s/:studentId/hero" element={teacher(<StudentHeroPage />)} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
          </Suspense>
          </ChunkErrorBoundary>
        </BrowserRouter>
      </ToastProvider>
      </NewsProvider>
    </AuthProvider>
  </StrictMode>,
);
