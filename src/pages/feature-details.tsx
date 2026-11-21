import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { getFeature, updateFeatureWireframe } from "@/features/api";
import type { Feature } from "@/features/schema";
import { WireframeEditor } from "@/viewer/wireframe-editor";

const FEATURES_PATH = "/features";

/** The details of a loaded feature: heading, description and its wire frame editor. */
export function FeatureDetailsView({
  feature,
  onSourceChange,
}: {
  feature: Feature;
  onSourceChange: (source: string) => void;
}) {
  return (
    <main className="flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-1">
        <Link to={FEATURES_PATH} className="text-sm text-muted-foreground underline">
          Back to features
        </Link>
        <h1 className="text-xl font-semibold">Feature: {feature.name}</h1>
        {feature.description !== "" && <p className="text-sm text-muted-foreground">{feature.description}</p>}
      </div>
      <h2 className="text-lg font-medium">Wireframe</h2>
      <WireframeEditor source={feature.wireframe} onSourceChange={onSourceChange} />
    </main>
  );
}

export function FeatureNotFound() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-2 p-4">
      <p>Feature not found</p>
      <Link to={FEATURES_PATH} className="text-sm underline">
        Back to features
      </Link>
    </main>
  );
}

/** `undefined` until the mock API has answered, then the feature or `null` when the id is unknown. */
function FeatureDetailsLoader({ id }: { id: string }) {
  const [feature, setFeature] = useState<Feature | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    getFeature(id).then((found) => {
      if (active) setFeature(found ?? null);
    });
    return () => {
      active = false;
    };
  }, [id]);

  if (feature === undefined) return null;
  if (feature === null) return <FeatureNotFound />;

  // Edits update the editor immediately and are saved without waiting for the API.
  const onSourceChange = (wireframe: string) => {
    setFeature({ ...feature, wireframe });
    updateFeatureWireframe(id, wireframe).catch(() => {});
  };

  return <FeatureDetailsView feature={feature} onSourceChange={onSourceChange} />;
}

export default function FeatureDetailsPage() {
  const { id = "" } = useParams();
  return <FeatureDetailsLoader key={id} id={id} />;
}
