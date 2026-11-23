import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { getDataDictionary, saveDataDictionary } from "@/data-dictionary/api";
import { DataDictionaryPane } from "@/data-dictionary/data-dictionary-pane";
import type { DataDictionaryRow } from "@/data-dictionary/schema";
import { getFeature, updateFeatureWireframe } from "@/features/api";
import type { Feature } from "@/features/schema";
import { getMacros } from "@/macros/api";
import { WireframeEditor } from "@/viewer/wireframe-editor";

const FEATURES_PATH = "/features";

export function FeatureDetailsView({
  feature,
  onSourceChange,
  dataDictionary,
  onDataDictionaryChange,
  sharedMacros,
}: {
  feature: Feature;
  onSourceChange: (source: string) => void;
  /** The global macros source, usable in the wire frame. */
  sharedMacros?: string;
  /** `undefined` until the data dictionary has loaded, when the pane is not shown. */
  dataDictionary?: DataDictionaryRow[];
  onDataDictionaryChange?: (rows: DataDictionaryRow[]) => void;
}) {
  return (
    <main className="flex h-full min-h-0 flex-col gap-4 overflow-hidden p-4">
      <div className="flex flex-none flex-col gap-1">
        <div className="flex flex-row items-center gap-2">
          <h1 className="text-xl font-semibold">Feature: {feature.name}</h1>
          <Link to={FEATURES_PATH} className="ml-auto text-sm text-muted-foreground underline">
            Back to features
          </Link>
        </div>
        {feature.description !== "" && <p className="text-sm text-muted-foreground">{feature.description}</p>}
      </div>
      <div className="min-h-0 flex-1">
        <WireframeEditor source={feature.wireframe} onSourceChange={onSourceChange} sharedMacros={sharedMacros} />
      </div>
      {dataDictionary !== undefined && (
        <DataDictionaryPane
          className="flex-none"
          rows={dataDictionary}
          onRowsChange={onDataDictionaryChange ?? (() => {})}
        />
      )}
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
  const [dataDictionary, setDataDictionary] = useState<DataDictionaryRow[] | undefined>(undefined);
  const [sharedMacros, setSharedMacros] = useState<string | undefined>(undefined);

  useEffect(() => {
    let active = true;
    getFeature(id).then((found) => {
      if (active) setFeature(found ?? null);
    });
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    let active = true;
    getMacros().then((source) => {
      if (active) setSharedMacros(source);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    getDataDictionary().then((rows) => {
      if (active) setDataDictionary(rows);
    });
    return () => {
      active = false;
    };
  }, []);

  if (feature === undefined) return null;
  if (feature === null) return <FeatureNotFound />;
  // The editor waits for the macros, or a use of one would flash as an unknown type.
  if (sharedMacros === undefined) return null;

  // Edits update the editor immediately and are saved without waiting for the API.
  const onSourceChange = (wireframe: string) => {
    setFeature({ ...feature, wireframe });
    updateFeatureWireframe(id, wireframe).catch(() => {});
  };

  const onDataDictionaryChange = (rows: DataDictionaryRow[]) => {
    setDataDictionary(rows);
    saveDataDictionary(rows).catch(() => {});
  };

  return (
    <FeatureDetailsView
      feature={feature}
      onSourceChange={onSourceChange}
      sharedMacros={sharedMacros}
      dataDictionary={dataDictionary}
      onDataDictionaryChange={onDataDictionaryChange}
    />
  );
}

export default function FeatureDetailsPage() {
  const { id = "" } = useParams();
  return <FeatureDetailsLoader key={id} id={id} />;
}
