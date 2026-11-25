import { Navigate, matchPath, useLocation, useRoutes, type RouteObject } from "react-router";
import { Toaster } from "@/components/ui/sonner";
import { TopNav } from "@/components/top-nav";
import FeaturesPage from "@/pages/features";
import FeatureDetailsPage from "@/pages/feature-details";
import MacrosPage from "@/pages/macros";
import ExamplesPage from "@/pages/examples";
import SharedPage from "@/pages/shared";
import { SHARE_PATH } from "@/share/encode";

export { SHARE_PATH };
export const FEATURES_PATH = "/features";
export const MACROS_PATH = "/macros";
export const EXAMPLES_PATH = "/examples";

export const appRoutes: RouteObject[] = [
  { path: FEATURES_PATH, element: <FeaturesPage /> },
  { path: `${FEATURES_PATH}/:id`, element: <FeatureDetailsPage /> },
  { path: MACROS_PATH, element: <MacrosPage /> },
  { path: EXAMPLES_PATH, element: <ExamplesPage /> },
  { path: SHARE_PATH, element: <SharedPage /> },
  { path: "/", element: <Navigate to={FEATURES_PATH} replace /> },
  { path: "*", element: <Navigate to={FEATURES_PATH} replace /> },
];

export default function App() {
  const routes = useRoutes(appRoutes);
  const { pathname } = useLocation();
  return (
    <>
      <div className="flex h-dvh flex-col">
        {matchPath(SHARE_PATH, pathname) === null && <TopNav />}
        <div className="min-h-0 flex-1 overflow-auto">{routes}</div>
      </div>
      <Toaster />
    </>
  );
}
