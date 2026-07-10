import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Eye, Search as SearchIcon } from "lucide-react";
import { CATEGORIES, categoryBadgeClass } from "@/lib/categories";
import { toast } from "sonner";

export const Route = createFileRoute("/search")({
  component: SearchPage,
});

async function signedUrl(path: string) {
  const { data, error } = await supabase.storage.from("documents").createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

function SearchPage() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [member, setMember] = useState<string>("all");

  const { data: members = [] } = useQuery({
    queryKey: ["members"],
    queryFn: async () => (await supabase.from("family_members").select("id,name,slug").order("sort_order")).data ?? [],
  });
  const { data: docs = [] } = useQuery({
    queryKey: ["docs-search"],
    queryFn: async () => (await supabase.from("documents").select("*").order("upload_date", { ascending: false })).data ?? [],
  });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (docs as any[]).filter((d) => {
      if (cat !== "all" && d.category !== cat) return false;
      if (member !== "all" && d.member_id !== member) return false;
      if (!s) return true;
      return [d.document_name, d.category, d.file_name, d.keywords, d.description]
        .filter(Boolean).some((v: string) => v.toLowerCase().includes(s));
    });
  }, [docs, q, cat, member]);

  const memberName = (id: string) => (members as any[]).find((m) => m.id === id)?.name ?? "—";
  const memberSlug = (id: string) => (members as any[]).find((m) => m.id === id)?.slug ?? "";

  const view = async (path: string) => {
    try { window.open(await signedUrl(path), "_blank"); } catch { toast.error("Unable to open"); }
  };
  const dl = async (path: string, name: string) => {
    try {
      const a = document.createElement("a"); a.href = await signedUrl(path); a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
    } catch { toast.error("Unable to download"); }
  };

  return (
    <div className="space-y-6">
      <Card className="glass rounded-3xl border-0 p-6">
        <h1 className="text-2xl font-extrabold">Search Documents</h1>
        <p className="text-sm text-muted-foreground">Search across all family members by name, category, keyword or file.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr,180px,180px]">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="rounded-full pl-9" />
          </div>
          <Select value={cat} onValueChange={setCat}>
            <SelectTrigger className="rounded-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={member} onValueChange={setMember}>
            <SelectTrigger className="rounded-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All members</SelectItem>
              {(members as any[]).map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="glass rounded-3xl border-0 p-2 md:p-4">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Sr.</TableHead>
                <TableHead>Document</TableHead>
                <TableHead>Member</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">No matches.</TableCell></TableRow>
              ) : filtered.map((d: any, i: number) => (
                <TableRow key={d.id}>
                  <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                  <TableCell><div className="font-medium">{d.document_name}</div><div className="text-xs text-muted-foreground">{d.file_name}</div></TableCell>
                  <TableCell><Link to="/members/$slug" params={{ slug: memberSlug(d.member_id) }} className="hover:underline">{memberName(d.member_id)}</Link></TableCell>
                  <TableCell><span className={`rounded-full border px-2.5 py-0.5 text-xs ${categoryBadgeClass(d.category)}`}>{d.category}</span></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{new Date(d.upload_date).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" className="rounded-full" onClick={() => view(d.file_path)}><Eye className="mr-1 h-3.5 w-3.5" />View</Button>
                    <Button size="sm" variant="ghost" className="rounded-full" onClick={() => dl(d.file_path, d.file_name)}><Download className="mr-1 h-3.5 w-3.5" />Download</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
