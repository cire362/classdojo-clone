import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { MotionConfig } from 'motion/react';
import '@fontsource-variable/onest';
import '@fontsource-variable/unbounded';
import './styles.css';
import { AuthProvider, useAuth } from './auth';
import type { Role } from './api';
import { AppLayout } from './components/Layout';
import { Skeleton } from './components/ui';
import { ToastProvider } from './components/Toast';
import { LoginPage } from './pages/Login';
import { GroupsPage } from './pages/teacher/Groups';
import { GroupLayout } from './pages/teacher/GroupLayout';
import { LessonPage } from './pages/teacher/Lesson';
import { StudentsPage } from './pages/teacher/Students';
import { PrintPage } from './pages/teacher/Print';
import { ReasonsPage } from './pages/teacher/Reasons';
import { AttendancePage } from './pages/teacher/Attendance';
import { StatsPage } from './pages/teacher/Stats';
import { StudentViewPage, StudentHeroPage } from './pages/teacher/StudentView';
import { CabinetPage } from './pages/student/Cabinet';
import { MyHeroPage } from './pages/student/MyHero';

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

function PageSkeleton() {
  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-8 sm:px-6">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-48" />
    </div>
  );
}

const teacher = (el: ReactNode) => <RequireRole role="TEACHER">{el}</RequireRole>;
const student = (el: ReactNode) => <RequireRole role="STUDENT">{el}</RequireRole>;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
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
              <Route path="/s/:studentId" element={teacher(<StudentViewPage />)} />
              <Route path="/s/:studentId/hero" element={teacher(<StudentHeroPage />)} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
    </MotionConfig>
  </StrictMode>,
);
