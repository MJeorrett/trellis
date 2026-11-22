import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createFeature } from "./api";
import { emptyFeatureForm, validateFeatureForm, type FeatureFormValues } from "./logic";
import type { Feature } from "./schema";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (feature: Feature) => void;
};

export function CreateFeatureDialog({ open, onOpenChange, onCreated }: Props) {
  const [values, setValues] = useState<FeatureFormValues>(emptyFeatureForm);
  const [error, setError] = useState<string | undefined>();
  const [creating, setCreating] = useState(false);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setValues(emptyFeatureForm);
      setError(undefined);
    }
    onOpenChange(next);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const result = validateFeatureForm(values);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(undefined);
    setCreating(true);
    try {
      const created = await createFeature(result.input);
      setValues(emptyFeatureForm);
      onCreated(created);
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <form className="grid gap-4" onSubmit={handleSubmit} noValidate>
          <DialogHeader>
            <DialogTitle>Create feature</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="feature-name">Name</Label>
            <Input
              id="feature-name"
              value={values.name}
              aria-invalid={error !== undefined}
              onChange={(e) => setValues({ ...values, name: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="feature-description">Description</Label>
            <Textarea
              id="feature-description"
              value={values.description}
              onChange={(e) => setValues({ ...values, description: e.target.value })}
            />
          </div>
          {error !== undefined && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={creating}>
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
