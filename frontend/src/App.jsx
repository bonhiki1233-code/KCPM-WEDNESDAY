import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProjectListView from './pages/ProjectListView';
import UserProfile from './pages/UserProfile';
import AdminDashboard from './pages/AdminDashboard';
import StudentDashboard from './pages/StudentDashboard';
import LecturerDashboard from './pages/LecturerDashboard';
import TopicManagement from './pages/TopicManagement';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import TeamManagement from './pages/TeamManagement';
import TeamDetail from './pages/TeamDetail';
import KanBanBoard from './pages/KanBanBoard';
import TeamMeetings from './pages/TeamMeetings';
import TeamChat from './pages/TeamChat';
import MentoringPage from './pages/MentoringPage';
import EvaluationPage from './pages/EvaluationPage';
import SubmissionsPage from './pages/SubmissionsPage';
import PeerReviewsPage from './pages/PeerReviewsPage';
import ResourcesPage from './pages/ResourcesPage';
import { useAuth, getDefaultDashboardPath, resolveRoleName } from './components/AuthContext';
import { initSocket, disconnectSocket } from './services/socketService';

const adminRoleGate = ['ADMIN', 'STAFF', 'HEAD_DEPT'];

const LoadingScreen = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
    Loading...
  </div>
);

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, isAuthReady } = useAuth();

  if (!isAuthReady) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && allowedRoles.length) {
    const userRole = resolveRoleName(user);
    if (!userRole || !allowedRoles.includes(userRole)) {
      return <Navigate to={getDefaultDashboardPath(user)} replace />;
    }
  }

  return children;
};

const PublicRoute = ({ children }) => {
  const { user, isAuthReady } = useAuth();

  if (!isAuthReady) {
    return <LoadingScreen />;
  }

  if (user) {
    return <Navigate to={getDefaultDashboardPath(user)} replace />;
  }

  return children;
};

const LandingRedirect = () => {
  const { user, isAuthReady } = useAuth();

  if (!isAuthReady) {
    return <LoadingScreen />;
  }

  if (user) {
    return <Navigate to={getDefaultDashboardPath(user)} replace />;
  }

  return <Navigate to="/login" replace />;
};

const App = () => {
  const { token } = useAuth();

  React.useEffect(() => {
    if (token) {
      initSocket(token);
    } else {
      disconnectSocket();
    }
  }, [token]);

  return (
    <Routes>
      <Route path="/" element={<LandingRedirect />} />
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
      <Route path="/student" element={<ProtectedRoute allowedRoles={['STUDENT']}><StudentDashboard /></ProtectedRoute>} />
      <Route path="/lecturer" element={<ProtectedRoute allowedRoles={['LECTURER']}><LecturerDashboard /></ProtectedRoute>} />
      <Route path="/topics" element={<ProtectedRoute><TopicManagement /></ProtectedRoute>} />
      <Route path="/mentoring" element={<ProtectedRoute allowedRoles={['LECTURER', 'ADMIN', 'STAFF', 'HEAD_DEPT']}><MentoringPage /></ProtectedRoute>} />
      <Route path="/evaluations" element={<ProtectedRoute allowedRoles={['LECTURER', 'ADMIN', 'STAFF', 'HEAD_DEPT']}><EvaluationPage /></ProtectedRoute>} />
      <Route path="/projects" element={<ProtectedRoute><ProjectListView /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
      <Route path="/teams" element={<ProtectedRoute><TeamManagement /></ProtectedRoute>} />
      <Route path="/teams/:teamId" element={<ProtectedRoute><TeamDetail /></ProtectedRoute>} />
      <Route path="/kanban" element={<ProtectedRoute><KanBanBoard /></ProtectedRoute>} />
      <Route path="/video" element={<ProtectedRoute><TeamMeetings /></ProtectedRoute>} />
      <Route path="/chat" element={<ProtectedRoute><TeamChat /></ProtectedRoute>} />
      <Route path="/submission" element={<ProtectedRoute><SubmissionsPage /></ProtectedRoute>} />
      <Route path="/peer-review" element={<ProtectedRoute><PeerReviewsPage /></ProtectedRoute>} />
      <Route path="/resources" element={<ProtectedRoute><ResourcesPage /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute allowedRoles={adminRoleGate}><AdminDashboard /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;