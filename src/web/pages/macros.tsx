import { useEffect, useState } from "react";
import { getDataDictionary } from "@/data-dictionary/api";
import type { DataDictionaryRow } from "@/data-dictionary/schema";
import { getMacros, saveMacros } from "@/macros/api";
import { MacroEditor } from "@/macros/macro-editor";

export function MacrosView({
  source,
  onSourceChange,
  dataDictionary,
}: {
  source: string;
  onSourceChange: (source: string) => void;
  dataDictionary?: readonly DataDictionaryRow[];
}) {
  return (
    <main className="flex h-full min-h-0 flex-col gap-4 overflow-hidden p-4">
      <div className="flex flex-none flex-col gap-1">
        <h1 className="text-xl font-semibold">Macros</h1>
        <p className="text-sm text-muted-foreground">
          The macros defined here are shared by every feature's wire frame. Add a page to try them out.
        </p>
      </div>
      <div className="min-h-0 flex-1">
        <MacroEditor source={source} onSourceChange={onSourceChange} dataDictionary={dataDictionary} />
      </div>
    </main>
  );
}

export default function MacrosPage() {
  const [source, setSource] = useState<string | undefined>(undefined);
  const [dataDictionary, setDataDictionary] = useState<DataDictionaryRow[] | undefined>(undefined);

  useEffect(() => {
    let active = true;
    getMacros().then((loaded) => {
      if (active) setSource(loaded);
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

  // The editor waits for the data dictionary, or a pointer would flash as an unknown entity.
  if (source === undefined || dataDictionary === undefined) return null;

  // Edits update the editor immediately and are saved without waiting for the API.
  const onSourceChange = (next: string) => {
    setSource(next);
    saveMacros(next).catch(() => {});
  };

  return <MacrosView source={source} onSourceChange={onSourceChange} dataDictionary={dataDictionary} />;
}
