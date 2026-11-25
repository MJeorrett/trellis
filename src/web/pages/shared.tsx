import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router";
import { Card, CardContent } from "@/components/ui/card";
import { DataDictionaryTable } from "@/data-dictionary/data-dictionary-table";
import { decodeShare, shareDataFromHash } from "@/share/encode";
import type { SharedWireframe } from "@/share/schema";
import { compileSyntax } from "@/syntax/compile";
import { PageTabs } from "@/viewer/pages";

const APP_PATH = "/features";

export function SharedFrame({ children }: { children?: ReactNode }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex-none border-b">
        <div className="mx-auto flex max-w-6xl p-2">
          <Link to={APP_PATH} className="text-sm font-semibold underline">
            Trellis
          </Link>
        </div>
      </header>
      {children}
      <footer className="flex-none border-t p-2 text-center text-sm text-muted-foreground">
        Shared by{" "}
        <Link to={APP_PATH} className="underline">
          Trellis
        </Link>
      </footer>
    </div>
  );
}

export function SharedView({ data }: { data: SharedWireframe }) {
  const [selectedPage, setSelectedPage] = useState(0);
  const result = useMemo(
    () => compileSyntax(data.wireframe, data.macros, data.dataDictionary),
    [data.wireframe, data.macros, data.dataDictionary],
  );

  return (
    <SharedFrame>
      <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4">
        <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-4">
          <h1 className="flex-none text-xl font-semibold">{data.name}</h1>
          <Card className="min-h-0 flex-1 overflow-hidden">
            <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {result.ok ? (
                <PageTabs pages={result.ast.pages} selectedIndex={selectedPage} onSelect={setSelectedPage} />
              ) : (
                <pre role="alert" className="whitespace-pre-wrap text-xs text-destructive">
                  {result.error}
                </pre>
              )}
            </CardContent>
          </Card>
        </div>
        <section aria-label="Data dictionary" className="mx-auto flex w-full max-w-6xl flex-none flex-col gap-2">
          <h2 className="text-lg font-medium">Data dictionary</h2>
          <DataDictionaryTable rows={data.dataDictionary} />
        </section>
      </main>
    </SharedFrame>
  );
}

export function InvalidShareView() {
  return (
    <SharedFrame>
      <main className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-2 p-4">
        <p>This link is not valid</p>
      </main>
    </SharedFrame>
  );
}

/** `undefined` until the hash has been decoded, then the data or `null` when it cannot be read. */
export default function SharedPage() {
  const { hash } = useLocation();
  const [data, setData] = useState<SharedWireframe | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    decodeShare(shareDataFromHash(hash)).then((decoded) => {
      if (active) setData(decoded ?? null);
    });
    return () => {
      active = false;
    };
  }, [hash]);

  if (data === undefined) return <SharedFrame />;
  if (data === null) return <InvalidShareView />;
  return <SharedView key={hash} data={data} />;
}
