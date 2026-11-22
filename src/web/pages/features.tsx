import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { listFeatures } from "@/features/api";
import { CreateFeatureDialog } from "@/features/create-feature-dialog";
import { FeatureList } from "@/features/feature-list";
import { appendFeature } from "@/features/logic";
import type { Feature } from "@/features/schema";

export default function FeaturesPage() {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    listFeatures().then((list) => {
      if (active) setFeatures(list);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Features</h1>
        <Button onClick={() => setOpen(true)}>Create feature</Button>
      </div>
      <FeatureList features={features} />
      <CreateFeatureDialog
        open={open}
        onOpenChange={setOpen}
        onCreated={(created) => {
          setFeatures((current) => appendFeature(current, created));
          toast.success(`Feature "${created.name}" created`);
        }}
      />
    </main>
  );
}
