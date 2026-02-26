import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import Layout from './components/common/Layout';
import Login from './pages/Login';
import Setup from './pages/Setup';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import AcceptInvite from './pages/AcceptInvite';
import ChangePassword from './pages/ChangePassword';
import Dashboard from './pages/Dashboard';
import Family from './pages/Family';
import ChildTemplates from './pages/ChildTemplates';
import Assets from './pages/Assets';
import AssetDetails from './pages/AssetDetails';
import Goals from './pages/Goals';
import Simulator from './pages/Simulator';
import SavingsPots from './pages/SavingsPots';
import Settings from './pages/Settings';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, mustChangePassword } = useAuthStore();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  if (mustChangePassword) {
    return <Navigate to="/change-password" replace />;
  }
  
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, mustChangePassword } = useAuthStore();
  
  if (isAuthenticated && !mustChangePassword) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/setup" element={<Setup />} />
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
      <Route path="/reset-password" element={<PublicRoute><ResetPassword /></PublicRoute>} />
      <Route path="/accept-invite" element={<PublicRoute><AcceptInvite /></PublicRoute>} />
      <Route path="/change-password" element={<ChangePassword />} />
      
      {/* Private routes */}
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="family" element={<Family />} />
        <Route path="child-templates" element={<ChildTemplates />} />
        <Route path="assets" element={<Assets />} />
        <Route path="assets/:id" element={<AssetDetails />} />
        <Route path="goals" element={<Goals />} />
        <Route path="savings-pots" element={<SavingsPots />} />
        <Route path="simulator" element={<Simulator />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      
      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
