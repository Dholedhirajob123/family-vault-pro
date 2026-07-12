import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Upload, Trash2, Pencil, Eye, Download, ShieldCheck, Loader2, KeyRound, Lock, Unlock } from "lucide-react";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

interface Member { id: string; name: string; slug: string; password_hash: string | null; }
interface Doc {
  id: string; member_id: string; document_name: string;
  registration_number: string | null; document_date: string | null;
  file_path: string; file_name: string; upload_date: string;
}

async function signedUrl(path: string) {
  const { data, error } = await supabase.storage.from("documents").createSignedUrl(path, 3600);
  if (error) throw error; return data.signedUrl;
}

function AdminPage() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  const membersQ = useQuery({
    queryKey: ["members-admin"],
    queryFn: async () => (await supabase.from("family_members").select("id,name,slug,password_hash").order("sort_order")).data as Member[] ?? [],
  });
  const members = membersQ.data ?? [];

  const { data: docs = [], refetch } = useQuery({
    queryKey: ["docs-admin"],
    enabled: isAdmin,
    queryFn: async () => (await supabase.from("documents").select("id,member_id,document_name,registration_number,document_date,file_path,file_name,upload_date").order("created_at", { ascending: false })).data as Doc[] ?? [],
  });

  const [filter, setFilter] = useState("");
  const filtered = useMemo(() => {
    const s = filter.toLowerCase();
    if (!s) return docs;
    return docs.filter((d) => [d.document_name, d.file_name, d.registration_number ?? ""].some((v) => v.toLowerCase().includes(s)));
  }, [docs, filter]);

  const memberName = (id: string) => members.find((m) => m.id === id)?.name ?? "—";

  const [claiming, setClaiming] = useState(false);
  const claimAdmin = async () => {
    setClaiming(true);
    const { data, error } = await supabase.rpc("claim_first_admin");
    setClaiming(false);
    if (error) return toast.error(error.message);
    if (data) { toast.success("You are now the admin."); window.location.reload(); }
    else toast.error("An admin already exists. Ask them to grant you access.");
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;
  if (!user) return null;

  if (!isAdmin) {
    return (
      <Card className="glass mx-auto max-w-md rounded-3xl border-0 p-8 text-center">
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl gradient-primary">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-bold">Admin access required</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Signed in as <span className="font-medium">{user.email}</span>. If you're the first person setting this up, claim admin access below.
        </p>
        <Button onClick={claimAdmin} disabled={claiming} className="mt-4 rounded-full gradient-primary border-0">
          {claiming && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Claim admin access
        </Button>
      </Card>
    );
  }

  const refreshAll = () => {
    refetch();
    membersQ.refetch();
    qc.invalidateQueries({ queryKey: ["documents-all"] });
    qc.invalidateQueries({ queryKey: ["member"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground">Upload documents and set access passwords per family member.</p>
        </div>
        <UploadDialog members={members} onDone={refreshAll} />
      </div>

      <Card className="glass rounded-3xl border-0 p-4 md:p-6">
        <h2 className="mb-3 text-lg font-bold">Member access passwords</h2>
        <p className="mb-4 text-sm text-muted-foreground">Set a password to protect a member's documents. Leave blank and save to remove the password (open access).</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((m) => (
            <MemberPasswordCard key={m.id} m={m} onDone={refreshAll} />
          ))}
        </div>
      </Card>

      <Card className="glass rounded-3xl border-0 p-4">
        <Input placeholder="Filter documents…" value={filter} onChange={(e) => setFilter(e.target.value)} className="max-w-sm rounded-full" />
      </Card>

      <Card className="glass rounded-3xl border-0 p-2 md:p-4">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document</TableHead>
                <TableHead>Member</TableHead>
                <TableHead>Reg. No.</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">No documents.</TableCell></TableRow>
              ) : filtered.map((d) => (
                <DocRow key={d.id} d={d} memberName={memberName(d.member_id)} members={members} onChanged={refreshAll} />
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        <Link to="/" className="hover:underline">← Back to portal</Link>
      </p>
    </div>
  );
}

function MemberPasswordCard({ m, onDone }: { m: Member; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [pwd, setPwd] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("set_member_password", { _member_id: m.id, _new_password: pwd });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(pwd ? "Password updated" : "Password removed");
    setPwd(""); setOpen(false); onDone();
  };

  return (
    <div className="flex items-center justify-between rounded-2xl border border-border/40 bg-background/40 p-3">
      <div>
        <div className="font-medium">{m.name}</div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          {m.password_hash ? <><Lock className="h-3 w-3" /> Protected</> : <><Unlock className="h-3 w-3" /> Open</>}
        </div>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline" className="rounded-full"><KeyRound className="mr-1 h-3.5 w-3.5" /> Set password</Button>
        </DialogTrigger>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Password for {m.name}</DialogTitle></DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor={`pw-${m.id}`}>New password</Label>
            <Input id={`pw-${m.id}`} type="text" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="Leave blank to remove password" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={busy} className="gradient-primary border-0">
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DocRow({ d, memberName, members, onChanged }: { d: Doc; memberName: string; members: Member[]; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const view = async () => { try { window.open(await signedUrl(d.file_path), "_blank"); } catch { toast.error("Failed"); } };
  const dl = async () => {
    try { const a = document.createElement("a"); a.href = await signedUrl(d.file_path); a.download = d.file_name; document.body.appendChild(a); a.click(); a.remove(); } catch { toast.error("Failed"); }
  };
  const del = async () => {
    if (!confirm(`Delete "${d.document_name}"? This cannot be undone.`)) return;
    await supabase.storage.from("documents").remove([d.file_path]);
    const { error } = await supabase.from("documents").delete().eq("id", d.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted"); onChanged();
  };

  return (
    <TableRow>
      <TableCell><div className="font-medium">{d.document_name}</div><div className="text-xs text-muted-foreground">{d.file_name}</div></TableCell>
      <TableCell>{memberName}</TableCell>
      <TableCell className="text-sm">{d.registration_number || <span className="text-muted-foreground">—</span>}</TableCell>
      <TableCell className="text-sm text-muted-foreground">{d.document_date ? new Date(d.document_date).toLocaleDateString() : "—"}</TableCell>
      <TableCell className="text-right">
        <Button size="icon" variant="ghost" className="rounded-full" onClick={view}><Eye className="h-4 w-4" /></Button>
        <Button size="icon" variant="ghost" className="rounded-full" onClick={dl}><Download className="h-4 w-4" /></Button>
        <Button size="icon" variant="ghost" className="rounded-full" onClick={() => setOpen(true)}><Pencil className="h-4 w-4" /></Button>
        <Button size="icon" variant="ghost" className="rounded-full text-destructive" onClick={del}><Trash2 className="h-4 w-4" /></Button>
        {open && <EditDialog d={d} members={members} onClose={() => setOpen(false)} onDone={onChanged} />}
      </TableCell>
    </TableRow>
  );
}

function UploadDialog({ members, onDone }: { members: Member[]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ member_id: "", document_name: "", registration_number: "", document_date: "" });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!file) return toast.error("Select a PDF or image");
    if (!form.member_id || !form.document_name) return toast.error("Fill required fields");
    setBusy(true);
    try {
      const path = `${form.member_id}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
      const up = await supabase.storage.from("documents").upload(path, file, { contentType: file.type || "application/octet-stream" });
      if (up.error) throw up.error;
      const { data: userData } = await supabase.auth.getUser();
      const ins = await supabase.from("documents").insert({
        member_id: form.member_id,
        document_name: form.document_name,
        category: "Other",
        registration_number: form.registration_number || null,
        document_date: form.document_date || null,
        upload_date: new Date().toISOString().slice(0, 10),
        file_path: path,
        file_name: file.name,
        uploaded_by: userData.user?.id ?? null,
      });
      if (ins.error) throw ins.error;
      toast.success("Uploaded");
      setOpen(false); setFile(null);
      setForm({ member_id: "", document_name: "", registration_number: "", document_date: "" });
      onDone();
    } catch (e: any) { toast.error(e.message ?? "Upload failed"); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-full gradient-primary border-0"><Upload className="mr-2 h-4 w-4" /> Upload Document</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Upload Document</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <Field label="Family Member">
            <Select value={form.member_id} onValueChange={(v) => setForm({ ...form, member_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select member" /></SelectTrigger>
              <SelectContent>{members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Document Name"><Input value={form.document_name} onChange={(e) => setForm({ ...form, document_name: e.target.value })} placeholder="e.g. Passport, Aadhaar, Photo" /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Registration Number"><Input value={form.registration_number} onChange={(e) => setForm({ ...form, registration_number: e.target.value })} placeholder="e.g. A1234567" /></Field>
            <Field label="Document Date"><Input type="date" value={form.document_date} onChange={(e) => setForm({ ...form, document_date: e.target.value })} /></Field>
          </div>
          <Field label="File (PDF or Photo)"><Input type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy} className="gradient-primary border-0">
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditDialog({ d, members, onClose, onDone }: { d: Doc; members: Member[]; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({
    member_id: d.member_id,
    document_name: d.document_name,
    registration_number: d.registration_number ?? "",
    document_date: d.document_date ?? "",
  });
  const [replace, setReplace] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      let file_path = d.file_path, file_name = d.file_name;
      if (replace) {
        const path = `${form.member_id}/${Date.now()}-${replace.name.replace(/[^\w.\-]+/g, "_")}`;
        const up = await supabase.storage.from("documents").upload(path, replace, { contentType: replace.type || "application/octet-stream" });
        if (up.error) throw up.error;
        await supabase.storage.from("documents").remove([d.file_path]);
        file_path = path; file_name = replace.name;
      }
      const { error } = await supabase.from("documents").update({
        member_id: form.member_id,
        document_name: form.document_name,
        registration_number: form.registration_number || null,
        document_date: form.document_date || null,
        file_path, file_name,
      }).eq("id", d.id);
      if (error) throw error;
      toast.success("Saved"); onClose(); onDone();
    } catch (e: any) { toast.error(e.message ?? "Save failed"); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Edit Document</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <Field label="Family Member">
            <Select value={form.member_id} onValueChange={(v) => setForm({ ...form, member_id: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Document Name"><Input value={form.document_name} onChange={(e) => setForm({ ...form, document_name: e.target.value })} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Registration Number"><Input value={form.registration_number} onChange={(e) => setForm({ ...form, registration_number: e.target.value })} /></Field>
            <Field label="Document Date"><Input type="date" value={form.document_date} onChange={(e) => setForm({ ...form, document_date: e.target.value })} /></Field>
          </div>
          <Field label={`Replace file (current: ${d.file_name})`}>
            <Input type="file" accept="application/pdf,image/*" onChange={(e) => setReplace(e.target.files?.[0] ?? null)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={busy} className="gradient-primary border-0">
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid gap-1.5"><Label>{label}</Label>{children}</div>;
}
