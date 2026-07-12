import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { ArrowRight, Lock, Unlock } from "lucide-react";

export const Route = createFileRoute("/members/")({
  component: MembersIndex,
});

function initials(n: string) { return n.split(" ").map(s => s[0]).join("").slice(0,2).toUpperCase(); }

function MembersIndex() {
  const { data: members = [] } = useQuery({
    queryKey: ["members"],
    queryFn: async () => {
      const { data, error } = await supabase.from("family_members").select("id,name,slug,password_hash").order("sort_order");
      if (error) throw error;
      return data;
    },
  });
  const { data: docs = [] } = useQuery({
    queryKey: ["documents-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("documents").select("member_id");
      if (error) throw error;
      return data;
    },
  });
  const counts = new Map<string, number>();
  docs.forEach((d: any) => counts.set(d.member_id, (counts.get(d.member_id) ?? 0) + 1));

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-extrabold">Family Members</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {members.map((m: any, i: number) => (
          <Link key={m.id} to="/members/$slug" params={{ slug: m.slug }}>
            <Card className="glass rounded-3xl border-0 p-6 transition-all hover:-translate-y-1">
              <div className="flex items-center gap-4">
                <div className="grid h-16 w-16 place-items-center rounded-2xl font-bold text-white"
                  style={{ background: `linear-gradient(135deg, oklch(0.55 0.21 ${240 + i * 15}), oklch(0.68 0.18 ${240 + i * 15}))` }}>
                  {initials(m.name)}
                </div>
                <div className="flex-1">
                  <div className="text-lg font-semibold">{m.name}</div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    {m.password_hash ? <><Lock className="h-3 w-3" /> Protected</> : <><Unlock className="h-3 w-3" /> Open</>}
                  </div>
                  <div className="text-sm text-muted-foreground">{counts.get(m.id) ?? 0} document{(counts.get(m.id) ?? 0) === 1 ? "" : "s"}</div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
