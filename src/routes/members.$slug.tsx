import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Eye, Search, ArrowLeft, FileText, Lock, Loader2, Share2, MoreVertical } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/members/$slug")({
  component: MemberPage,
});

interface Member { id: string; name: string; slug: string; password_hash: string | null; }
interface Doc {
  id: string;
  document_name: string;
  registration_number: string | null;
  document_date: string | null;
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
  const [unlocked, setUnlocked] = useState(false);
  const [pwd, setPwd] = useState("");
  const [checking, setChecking] = useState(false);
  const [showReset, setShowReset] = useState(false);

  const memberQ = useQuery({
    queryKey: ["member", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("family_members")
        .select("id,name,slug,password_hash")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data as Member | null;
    },
  });

  const hasPassword = !!memberQ.data?.password_hash;

  useEffect(() => {
    if (!memberQ.data) return;
    if (!hasPassword) { setUnlocked(true); return; }
    if (sessionStorage.getItem(`member-unlock:${slug}`) === "1") setUnlocked(true);
  }, [memberQ.data, hasPassword, slug]);

  const docsQ = useQuery({
    queryKey: ["docs", memberQ.data?.id],
    enabled: !!memberQ.data?.id && unlocked,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("id,document_name,registration_number,document_date,file_path,file_name,upload_date")
        .eq("member_id", memberQ.data!.id)
        .order("document_date", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data as Doc[];
    },
  });

  const filtered = useMemo(() => {
    const list = docsQ.data ?? [];
    const s = q.trim().toLowerCase();
    if (!s) return list;
    return list.filter((d) =>
      d.document_name.toLowerCase().includes(s) ||
      (d.registration_number ?? "").toLowerCase().includes(s) ||
      d.file_name.toLowerCase().includes(s)
    );
  }, [docsQ.data, q]);

  const handleView = async (d: Doc) => {
    try { 
      const url = await signedUrl(d.file_path);
      window.open(url, "_blank"); 
    } catch { 
      toast.error("Unable to open document"); 
    }
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
      toast.success("Download started");
    } catch { 
      toast.error("Unable to download document"); 
    }
  };

  const handleShare = async (d: Doc) => {
    try {
      const url = await signedUrl(d.file_path);
      const res = await fetch(url);
      if (!res.ok) throw new Error("fetch failed");
      const blob = await res.blob();
      const file = new File([blob], d.file_name, { type: blob.type || "application/octet-stream" });

      const caption = `${d.document_name}${d.registration_number ? ` • Reg No: ${d.registration_number}` : ""}${d.document_date ? ` • ${new Date(d.document_date).toLocaleDateString()}` : ""}`;

      // Share the actual file (PDF / image) via native share sheet
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: d.document_name, text: caption });
          return;
        } catch (e: any) {
          if (e?.name === "AbortError") return;
        }
      }

      // Fallback: trigger a download of the file so user can attach it manually
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = d.file_name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
      toast.success("File downloaded — attach it in your chat app to share");
    } catch (error: any) {
      if (error?.name !== "AbortError") {
        toast.error("Unable to share document");
      }
    }
  };


  const submitPassword = async () => {
    if (!pwd) return;
    setChecking(true);
    const { data, error } = await supabase.rpc("verify_member_password", { _slug: slug, _password: pwd });
    setChecking(false);
    if (error) return toast.error(error.message);
    if (data === true) {
      sessionStorage.setItem(`member-unlock:${slug}`, "1");
      setUnlocked(true);
      setPwd("");
    } else {
      toast.error("Incorrect password");
    }
  };

  if (memberQ.isLoading) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;
  if (!memberQ.data) return <div className="p-8 text-center">Member not found.</div>;

  const m = memberQ.data;

  if (!unlocked) {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Home
        </Link>
        {!showReset ? (
          <Card className="glass rounded-3xl border-0 p-8 text-center">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl gradient-primary">
              <Lock className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-bold">{m.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">Enter the password set by the admin to view this member's documents.</p>
            <div className="mt-5 space-y-3 text-left">
              <div>
                <Label htmlFor="mp">Password</Label>
                <Input
                  id="mp"
                  type="password"
                  value={pwd}
                  onChange={(e) => setPwd(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitPassword()}
                  className="rounded-xl"
                  autoFocus
                />
              </div>
              <Button onClick={submitPassword} disabled={checking} className="w-full rounded-full gradient-primary border-0">
                {checking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Unlock
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowReset(true)}
              className="mt-3 text-xs text-muted-foreground hover:text-foreground w-full"
            >
              Forgot password? Reset here
            </Button>
          </Card>
        ) : (
          <Card className="glass rounded-3xl border-0 p-8 text-center">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl gradient-primary">
              <Lock className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-bold">Reset Password</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Please ask the admin to reset the password for {m.name} from the admin dashboard.
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowReset(false)}
              className="mt-4 text-xs text-muted-foreground hover:text-foreground w-full"
            >
              Back to login
            </Button>
          </Card>
        )}
      </div>
    );
  }

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
              {filtered.length} of {docsQ.data?.length ?? 0} document{(docsQ.data?.length ?? 0) === 1 ? "" : "s"}
            </p>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or reg. no…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full rounded-full pl-9 sm:w-80"
            />
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
                <TableHead className="hidden md:table-cell">Registration No.</TableHead>
                <TableHead className="hidden md:table-cell">Date</TableHead>
                <TableHead className="hidden sm:table-cell">File</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {docsQ.isLoading ? (
                <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">Loading…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">No documents found.</TableCell>
                </TableRow>
              ) : filtered.map((d, i) => (
                <TableRow key={d.id} className="hover:bg-accent/50">
                  <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="font-medium">{d.document_name}</TableCell>
                  <TableCell className="hidden md:table-cell text-sm">
                    {d.registration_number || <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                    {d.document_date ? new Date(d.document_date).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <FileText className="h-3.5 w-3.5" /> 
                      <span className="max-w-[12ch] md:max-w-[16ch] truncate">{d.file_name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="ghost" className="rounded-full h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => handleView(d)} className="cursor-pointer">
                            <Eye className="mr-2 h-4 w-4" />
                            <span>View Document</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDownload(d)} className="cursor-pointer">
                            <Download className="mr-2 h-4 w-4" />
                            <span>Download</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleShare(d)} className="cursor-pointer">
                            <Share2 className="mr-2 h-4 w-4" />
                            <span>Share</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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