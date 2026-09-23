import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore.js";
import { LoadingState } from "../components/common/LoadingState.js";

export const ProtectedRoute: React.FC = () => {
  const location = useLocation();
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return <LoadingState fullScreen message="Verifying session..." />;
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`}
        replace
      />
    );
  }

  return <Outlet />;
};

interface RoleRouteProps {
  allowedRoles: Array<"USER" | "ORGANIZER" | "ADMIN">;
}

export const RoleRoute: React.FC<RoleRouteProps> = ({ allowedRoles }) => {
  const { user, isLoading } = useAuthStore();

  if (isLoading) {
    return <LoadingState fullScreen message="Checking authorization..." />;
  }

  if (!user || !allowedRoles.includes(user.role)) {
    return <Navigate to={user ? "/forbidden" : "/login"} replace />;
  }

  return <Outlet />;
};
