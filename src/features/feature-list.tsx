import { Link } from "react-router";
import type { Feature } from "./schema";

export function FeatureList({ features }: { features: readonly Feature[] }) {
  return (
    <ul aria-label="Features" className="flex flex-col gap-2">
      {features.map((feature) => (
        <li key={feature.id} data-feature-id={feature.id} className="rounded-lg border p-3">
          <p className="font-medium">
            <Link to={`/features/${feature.id}`} className="underline-offset-4 hover:underline">
              {feature.name}
            </Link>
          </p>
          {feature.description !== "" && <p className="text-sm text-muted-foreground">{feature.description}</p>}
        </li>
      ))}
    </ul>
  );
}
