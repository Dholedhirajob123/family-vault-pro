import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Files, Calendar, Users } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Home,
});

interface Member {
  id: string;
  name: string;
  slug: string;
}
interface Doc {
  id: string;
  document_name: string;
  upload_date: string;
  member_id: string;
  created_at: string;
}

function initials(name: string) {
  return name
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function Home() {
  const membersQ = useQuery({
    queryKey: ["members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("family_members")
        .select("id,name,slug")
        .order("sort_order");
      if (error) throw error;
      return data as Member[];
    },
  });

  const docsQ = useQuery({
    queryKey: ["documents-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("id,document_name,upload_date,member_id,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Doc[];
    },
  });

  const members = membersQ.data ?? [];
  const docs = docsQ.data ?? [];
  const totalDocs = docs.length;
  const countsByMember = new Map<string, number>();
  docs.forEach((d) => {
    countsByMember.set(d.member_id, (countsByMember.get(d.member_id) ?? 0) + 1);
  });
  const recent = docs.slice(0, 5);

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="glass rounded-3xl p-8 md:p-12">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <Badge variant="secondary" className="rounded-full">Family Vault</Badge>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight md:text-5xl">
              Dhole Family <span className="bg-gradient-to-r from-[oklch(0.55_0.21_260)] to-[oklch(0.63_0.20_260)] bg-clip-text text-transparent">Certificate Portal</span>
            </h1>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              A secure, searchable home for every family document — Aadhaar, marksheets, property papers and more.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-2">
            <Stat icon={<Users className="h-4 w-4" />} label="Members" value={members.length} />
            <Stat icon={<Files className="h-4 w-4" />} label="Certificates" value={totalDocs} />
          </div>
        </div>
      </section>

      {/* Members */}
      <section>
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-xl font-semibold">Family Members</h2>
          <span className="text-sm text-muted-foreground">Click a card to view documents</span>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {members.map((m, i) => (
            <Link key={m.id} to="/members/$slug" params={{ slug: m.slug }} className="group">
              <Card className="glass rounded-3xl border-0 p-5 transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-[var(--shadow-elev)]">
                <div className="mb-4 flex items-center gap-3">
                  <div
                    className="grid h-14 w-14 place-items-center rounded-2xl font-bold text-white shadow-md"
                    style={{
                      background: `linear-gradient(135deg, oklch(0.55 0.21 ${240 + i * 15}), oklch(0.68 0.18 ${240 + i * 15}))`,
                    }}
                  >
                    {initials(m.name)}
                  </div>
                  <div>
                    <div className="font-semibold leading-tight">{m.name}</div>
                    <div className="text-xs text-muted-foreground">Family Member</div>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold">{countsByMember.get(m.id) ?? 0}</div>
                    <div className="text-xs text-muted-foreground">certificates</div>
                  </div>
                  <Button size="sm" variant="ghost" className="rounded-full group-hover:bg-primary group-hover:text-primary-foreground">
                    View <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </Button>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </section>

   
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="glass-strong rounded-2xl px-4 py-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="mt-1 text-xl font-bold">{value}</div>
    </div>
  );
}