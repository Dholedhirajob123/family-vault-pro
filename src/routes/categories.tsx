import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { CATEGORIES, categoryBadgeClass } from "@/lib/categories";

export const Route = createFileRoute("/categories")({
  component: CategoriesPage,
});

function CategoriesPage() {
  const { data: docs = [] } = useQuery({
    queryKey: ["docs-all-cat"],
    queryFn: async () => (await supabase.from("documents").select("category")).data ?? [],
  });
  const counts = new Map<string, number>();
  (docs as any[]).forEach((d) => counts.set(d.category, (counts.get(d.category) ?? 0) + 1));

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-extrabold">Categories</h1>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {CATEGORIES.map((c) => (
          <Card key={c} className="glass rounded-3xl border-0 p-5">
            <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${categoryBadgeClass(c)}`}>{c}</span>
            <div className="mt-3 text-3xl font-bold">{counts.get(c) ?? 0}</div>
            <div className="text-xs text-muted-foreground">documents</div>
          </Card>
        ))}
      </div>
    </div>
  );
}
