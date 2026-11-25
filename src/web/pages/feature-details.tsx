import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getDataDictionary, saveDataDictionary } from "@/data-dictionary/api";
import { DataDictionaryPane } from "@/data-dictionary/data-dictionary-pane";
import type { DataDictionaryRow } from "@/data-dictionary/schema";
import { getFeature, updateFeatureWireframe } from "@/features/api";
import type { Feature } from "@/features/schema";
import { getMacros } from "@/macros/api";
import { buildShareUrl, isShareUrlTooLong } from "@/share/encode";
import type { SharedWireframe } from "@/share/schema";
import { WireframeEditor } from "@/viewer/wireframe-editor";

const FEATURES_PATH = "/features";

export function FeatureDetailsView({
  feature,
  onSourceChange,
  dataDictionary,
  onDataDictionaryChange,
  sharedMacros,
  onShare,
}: {
  feature: Feature;
  onSourceChange: (source: string) => void;
  /** The `Share link` button is only shown when this is given. */
  onShare?: () => void;
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
          {onShare === undefined ? (
            <Link to={FEATURES_PATH} className="ml-auto text-sm text-muted-foreground underline">
              Back to features
            </Link>
          ) : (
            <div className="ml-auto flex flex-row items-center gap-3">
              <Button type="button" variant="outline" size="sm" onClick={onShare}>
                Share link
              </Button>
              <Link to={FEATURES_PATH} className="text-sm text-muted-foreground underline">
                Back to features
              </Link>
            </div>
          )}
        </div>
        {feature.description !== "" && <p className="text-sm text-muted-foreground">{feature.description}</p>}
      </div>
      <div className="min-h-0 flex-1">
        <WireframeEditor
          source={feature.wireframe}
          onSourceChange={onSourceChange}
          sharedMacros={sharedMacros}
          dataDictionary={dataDictionary}
        />
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
  // The editor waits for the macros and the data dictionary, or a use of a macro or a pointer would flash as an error.
  if (sharedMacros === undefined || dataDictionary === undefined) return null;

  // Edits update the editor immediately and are saved without waiting for the API.
  const onSourceChange = (wireframe: string) => {
    setFeature({ ...feature, wireframe });
    updateFeatureWireframe(id, wireframe).catch(() => {});
  };

  const onDataDictionaryChange = (rows: DataDictionaryRow[]) => {
    setDataDictionary(rows);
    saveDataDictionary(rows).catch(() => {});
  };

  const onShare = async () => {
    const data: SharedWireframe = {
      v: 1,
      name: feature.name,
      wireframe: feature.wireframe,
      macros: sharedMacros,
      dataDictionary,
    };
    const url = await buildShareUrl(window.location.origin, data);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      toast.error(`The link could not be copied. Copy it by hand: ${url}`);
      return;
    }
    if (isShareUrlTooLong(url)) toast.warning("Link copied, but it is long and may be cut off by some tools");
    else toast.success("Link copied");
  };

  return (
    <FeatureDetailsView
      feature={feature}
      onSourceChange={onSourceChange}
      onShare={onShare}
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
