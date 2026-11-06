import { StrictMode, Suspense, useEffect, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import '@fontsource-variable/onest';
import '@fontsource-variable/unbounded';
import '../styles.css';
import { AuthProvider, storedRole, useAuth } from '../features/auth';
import { NewsProvider } from '../features/news';
import { NotificationsProvider } from '../features/notifications';
import type { Role } from '../lib/api';
import { AppLayout } from './Layout';
import { ToastProvider } from '../ui/Toast';
import { PageSkeleton } from '../ui/PageSkeleton';
import { ErrorBox } from '../ui';

import {
  AdminPage,
  AttendancePage,
  CabinetPage,
  GroupLayout,
  GroupsPage,
  InvitePage,
  LessonPage,
  JoinClassPage,
  LoginPage,
  QrLoginPage,
  GroupCalendarPage,
  GroupFeedPage,
  GroupWorksPage,
  GroupAssignmentsPage,
  MessagesPage,
  MyHeroPage,
  ParentHomePage,
  RewardsPage,
  RewardRequestsPage,
  ShopPage,
  StudentCalendarPage,
  StudentFeedPage,
  StudentNotificationsPage,
  StudentWorksPage,
  StudentAssignmentsPage,
  ThreadPage,
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
import { ChunkErrorBoundary } from '../ui/ChunkErrorBoundary';

/** Подгружаем страницы роли в фоне сразу после входа */
function Prefetch() {
  const { user } = useAuth();
  useEffect(() => {
    if (user) prefetchPages(user.role);
  }, [user]);
  return null;
}

/** Сервер недоступен при запуске (например, приложение открыто с телефона без интернета) */
function Offline() {
  const { refresh } = useAuth();
  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <ErrorBox message="Нет связи с сервером. Проверьте интернет" onRetry={() => void refresh().catch(() => undefined)} />
    </main>
  );
}

function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { user, loading, offline } = useAuth();
  const location = useLocation();
  if (loading) return <PageSkeleton />;
  if (!user && offline) return <Offline />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (user.role !== role) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function Home() {
  const { user, loading, offline } = useAuth();
  if (loading) return <PageSkeleton />;
  if (!user && offline) return <Offline />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'ADMIN') return <AdminPage />;
  if (user.role === 'TEACHER') return <GroupsPage />;
  return user.role === 'PARENT' ? <ParentHomePage /> : <CabinetPage />;
}

const teacher = (el: ReactNode) => <RequireRole role="TEACHER">{el}</RequireRole>;
const student = (el: ReactNode) => <RequireRole role="STUDENT">{el}</RequireRole>;

// Ждём код открытой страницы (он маленький и грузится параллельно с данными), но не дольше 2 с:
// так первая отрисовка сразу показывает страницу, без промежуточной заглушки
await Promise.race([preloadRoute(window.location.pathname, storedRole()), new Promise((resolve) => setTimeout(resolve, 2000))]);

// Установка на телефон и запуск без интернета (только в сборке: в разработке кэш мешал бы)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  const register = () => void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  // Приложение стартует после загрузки кода страницы, событие load к этому моменту часто уже прошло
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <NewsProvider>
      <NotificationsProvider>
      <ToastProvider>
        <BrowserRouter>
          <Prefetch />
          <ChunkErrorBoundary>
          <Suspense fallback={<PageSkeleton />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/q" element={<QrLoginPage />} />
            <Route path="/join" element={<JoinClassPage />} />
            <Route path="/invite" element={<InvitePage />} />
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
                <Route path="feed" element={<GroupFeedPage />} />
                <Route path="calendar" element={<GroupCalendarPage />} />
                <Route path="rewards" element={<RewardsPage />} />
                <Route path="works" element={<GroupWorksPage />} />
                <Route path="assignments" element={<GroupAssignmentsPage />} />
                <Route path="assignments/:assignmentId" element={<GroupAssignmentsPage />} />
              </Route>
              <Route path="/settings" element={teacher(<SettingsPage />)} />
              <Route path="/messages" element={teacher(<MessagesPage />)} />
              <Route path="/reward-requests" element={teacher(<RewardRequestsPage />)} />
              <Route path="/messages/:studentId/:parentId" element={teacher(<ThreadPage />)} />
              <Route path="/feed" element={student(<StudentFeedPage />)} />
              <Route path="/calendar" element={student(<StudentCalendarPage />)} />
              <Route path="/works" element={student(<StudentWorksPage />)} />
              <Route path="/assignments" element={student(<StudentAssignmentsPage />)} />
              <Route path="/shop" element={student(<ShopPage />)} />
              <Route path="/notifications" element={student(<StudentNotificationsPage />)} />
              <Route path="/s/:studentId" element={teacher(<StudentViewPage />)} />
              <Route path="/s/:studentId/hero" element={teacher(<StudentHeroPage />)} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
          </Suspense>
          </ChunkErrorBoundary>
        </BrowserRouter>
      </ToastProvider>
      </NotificationsProvider>
      </NewsProvider>
    </AuthProvider>
  </StrictMode>,
);
