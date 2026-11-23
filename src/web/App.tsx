import { Navigate, useRoutes, type RouteObject } from "react-router";
import { Toaster } from "@/components/ui/sonner";
import { TopNav } from "@/components/top-nav";
import FeaturesPage from "@/pages/features";
import FeatureDetailsPage from "@/pages/feature-details";
import MacrosPage from "@/pages/macros";

export const FEATURES_PATH = "/features";
export const MACROS_PATH = "/macros";

export const appRoutes: RouteObject[] = [
  { path: FEATURES_PATH, element: <FeaturesPage /> },
  { path: `${FEATURES_PATH}/:id`, element: <FeatureDetailsPage /> },
  { path: MACROS_PATH, element: <MacrosPage /> },
  { path: "/", element: <Navigate to={FEATURES_PATH} replace /> },
  { path: "*", element: <Navigate to={FEATURES_PATH} replace /> },
];

export default function App() {
  const routes = useRoutes(appRoutes);
  return (
    <>
      <div className="flex h-dvh flex-col">
        <TopNav />
        <div className="min-h-0 flex-1 overflow-auto">{routes}</div>
      </div>
      <Toaster />
    </>
  );
}
