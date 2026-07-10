import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Eye, Search, ArrowLeft, FileText } from "lucide-react";
import { CATEGORIES, categoryBadgeClass } from "@/lib/categories";
import { toast } from "sonner";

export const Route = createFileRoute("/members/$slug")({
  component: MemberPage,
});

interface Member { id: string; name: string; slug: string; }
interface Doc {
  id: string;
  document_name: string;
  category: string;
  description: string | null;
  keywords: string | null;
  file_path: string;
  file_name: string;
  upload_date: string;
}

async function signedUrl(path: string) {
  const { data, error } = await supabase.storage.from("documents").createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

function MemberPage() {
  const { slug } = Route.useParams();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");

  const memberQ = useQuery({
    queryKey: ["member", slug],
    queryFn: async () => {
      const { data, error } = await supabase.from("family_members").select("*").eq("slug", slug).maybeSingle();
      if (error) throw error;
      return data as Member | null;
    },
  });

  const docsQ = useQuery({
    queryKey: ["docs", memberQ.data?.id],
    enabled: !!memberQ.data?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("member_id", memberQ.data!.id)
        .order("upload_date", { ascending: false });
      if (error) throw error;
      return data as Doc[];
    },
  });

  const filtered = useMemo(() => {
    const list = docsQ.data ?? [];
    const s = q.trim().toLowerCase();
    return list.filter((d) => {
      if (cat !== "all" && d.category !== cat) return false;
      if (!s) return true;
      return (
        d.document_name.toLowerCase().includes(s) ||
        d.category.toLowerCase().includes(s) ||
        d.file_name.toLowerCase().includes(s) ||
        (d.keywords ?? "").toLowerCase().includes(s) ||
        (d.description ?? "").toLowerCase().includes(s)
      );
    });
  }, [docsQ.data, q, cat]);

  const handleView = async (d: Doc) => {
    try {
      const url = await signedUrl(d.file_path);
      window.open(url, "_blank");
    } catch (e) { toast.error("Unable to open file"); }
  };

  const handleDownload = async (d: Doc) => {
    try {
      const url = await signedUrl(d.file_path);
      const a = document.createElement("a");
      a.href = url;
      a.download = d.file_name;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch { toast.error("Unable to download"); }
  };

  if (memberQ.isLoading) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;
  if (!memberQ.data) return <div className="p-8 text-center">Member not found.</div>;

  const m = memberQ.data;

  return (
    <div className="space-y-6">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Home
      </Link>

      <Card className="glass rounded-3xl border-0 p-6 md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">{m.name} — Documents</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {filtered.length} of {docsQ.data?.length ?? 0} certificate{(docsQ.data?.length ?? 0) === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search documents…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-full rounded-full pl-9 sm:w-72"
              />
            </div>
            <Select value={cat} onValueChange={setCat}>
              <SelectTrigger className="rounded-full sm:w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <Card className="glass rounded-3xl border-0 p-2 md:p-4">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Sr.</TableHead>
                <TableHead>Document Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Upload Date</TableHead>
                <TableHead>File</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    No documents found.
                  </TableCell>
                </TableRow>
              ) : filtered.map((d, i) => (
                <TableRow key={d.id} className="hover:bg-accent/50">
                  <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                  <TableCell>
                    <div className="font-medium">{d.document_name}</div>
                    {d.description && <div className="text-xs text-muted-foreground">{d.description}</div>}
                  </TableCell>
                  <TableCell>
                    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${categoryBadgeClass(d.category)}`}>{d.category}</span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{new Date(d.upload_date).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <FileText className="h-3.5 w-3.5" /> <span className="max-w-[16ch] truncate">{d.file_name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" className="rounded-full" onClick={() => handleView(d)}>
                        <Eye className="mr-1 h-3.5 w-3.5" /> View
                      </Button>
                      <Button size="sm" variant="ghost" className="rounded-full" onClick={() => handleDownload(d)}>
                        <Download className="mr-1 h-3.5 w-3.5" /> Download
                      </Button>
                    </div>
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
