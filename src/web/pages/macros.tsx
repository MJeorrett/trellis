import { useEffect, useState } from "react";
import { getMacros, saveMacros } from "@/macros/api";
import { MacroEditor } from "@/macros/macro-editor";

export function MacrosView({ source, onSourceChange }: { source: string; onSourceChange: (source: string) => void }) {
  return (
    <main className="flex h-full min-h-0 flex-col gap-4 overflow-hidden p-4">
      <div className="flex flex-none flex-col gap-1">
        <h1 className="text-xl font-semibold">Macros</h1>
        <p className="text-sm text-muted-foreground">
          The macros defined here are shared by every feature's wire frame. Add a page to try them out.
        </p>
      </div>
      <div className="min-h-0 flex-1">
        <MacroEditor source={source} onSourceChange={onSourceChange} />
      </div>
    </main>
  );
}

export default function MacrosPage() {
  const [source, setSource] = useState<string | undefined>(undefined);

  useEffect(() => {
    let active = true;
    getMacros().then((loaded) => {
      if (active) setSource(loaded);
    });
    return () => {
      active = false;
    };
  }, []);

  if (source === undefined) return null;

  // Edits update the editor immediately and are saved without waiting for the API.
  const onSourceChange = (next: string) => {
    setSource(next);
    saveMacros(next).catch(() => {});
  };

  return <MacrosView source={source} onSourceChange={onSourceChange} />;
}
