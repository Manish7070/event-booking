import { Suspense, useEffect } from "react";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { AppRoutes } from "./routes/AppRoutes.js";
import { useAuthStore } from "./store/useAuthStore.js";
import { queryClient } from "./api/queryClient.js";
import { Skeleton } from "./components/ui.js";
export function App() {
  const checkAuth = useAuthStore((s) => s.checkAuth);
  useEffect(() => {
    void checkAuth();
  }, [checkAuth]);
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense
          fallback={
            <div className="container section">
              <Skeleton />
            </div>
          }
        >
          <AppRoutes />
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
