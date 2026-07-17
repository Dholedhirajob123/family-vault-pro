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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { 
  Upload, Trash2, Pencil, Eye, Download, Loader2, KeyRound, 
  Lock, Unlock, Plus, MoreVertical, Image as ImageIcon, FileText, X, Camera, FilePlus
} from "lucide-react";
import { jsPDF } from "jspdf";

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
  const { user, loading } = useAuth();
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
    enabled: !!user,
    queryFn: async () => (await supabase.from("documents").select("id,member_id,document_name,registration_number,document_date,file_path,file_name,upload_date").order("created_at", { ascending: false })).data as Doc[] ?? [],
  });

  const [filter, setFilter] = useState("");
  const filtered = useMemo(() => {
    const s = filter.toLowerCase();
    if (!s) return docs;
    return docs.filter((d) => [d.document_name, d.file_name, d.registration_number ?? ""].some((v) => v.toLowerCase().includes(s)));
  }, [docs, filter]);

  const memberName = (id: string) => {
    if (id === "other") return "Other";
    return members.find((m) => m.id === id)?.name ?? "—";
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading…</div>;
  if (!user) return null;

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
        <div className="flex gap-2 flex-wrap">
          <BulkPasswordDialog members={members} onDone={refreshAll} />
          <AddMemberDialog onDone={refreshAll} />
          <UploadDialog members={members} onDone={refreshAll} />
        </div>
      </div>

      <Card className="glass rounded-3xl border-0 p-4 md:p-6">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">Family members & passwords</h2>
            <p className="text-xs text-muted-foreground">Set, change, or reset the password required to view each member's documents.</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((m) => (
            <MemberPasswordCard key={m.id} m={m} onDone={refreshAll} />
          ))}
          {members.length === 0 && (
            <p className="text-sm text-muted-foreground">No members yet. Click "Add member" to create one.</p>
          )}
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
                <TableHead className="hidden sm:table-cell">Member</TableHead>
                <TableHead className="hidden md:table-cell">Reg. No.</TableHead>
                <TableHead className="hidden md:table-cell">Date</TableHead>
                <TableHead className="hidden md:table-cell">Type</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">No documents.</TableCell></TableRow>
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

function BulkPasswordDialog({ members, onDone }: { members: Member[]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [pwd, setPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [busy, setBusy] = useState(false);

  const apply = async () => {
    if (!pwd) return toast.error("Enter a password");
    if (pwd !== confirmPwd) return toast.error("Passwords do not match");
    if (pwd.length < 3) return toast.error("Password must be at least 3 characters");
    if (members.length === 0) return toast.error("No members to update");

    setBusy(true);
    let ok = 0, fail = 0;
    for (const m of members) {
      const { error } = await supabase.rpc("set_member_password", { _member_id: m.id, _new_password: pwd });
      if (error) fail++; else ok++;
    }
    setBusy(false);
    if (fail === 0) toast.success(`Password set for all ${ok} member${ok === 1 ? "" : "s"}`);
    else toast.error(`Updated ${ok}, failed ${fail}`);
    setPwd(""); setConfirmPwd(""); setOpen(false); onDone();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="rounded-full">
          <KeyRound className="mr-2 h-4 w-4" /> Set password for all
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Set one password for all members</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">
          This will overwrite the current password of all {members.length} member{members.length === 1 ? "" : "s"}.
        </p>
        <div className="grid gap-3">
          <div>
            <Label htmlFor="bulk-pw">New password</Label>
            <Input id="bulk-pw" type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="bulk-cpw">Confirm password</Label>
            <Input id="bulk-cpw" type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} />
            {pwd !== confirmPwd && confirmPwd && <p className="mt-1 text-xs text-destructive">Passwords do not match</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => { setOpen(false); setPwd(""); setConfirmPwd(""); }}>Cancel</Button>
          <Button onClick={apply} disabled={busy} className="gradient-primary border-0">
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Apply to all
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MemberPasswordCard({ m, onDone }: { m: Member; onDone: () => void }) {
  const [open, setOpen] = useState(false);

  const [pwd, setPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!pwd) {
      const { error } = await supabase.rpc("set_member_password", { _member_id: m.id, _new_password: "" });
      if (error) return toast.error(error.message);
      toast.success("Password removed");
      setPwd(""); setConfirmPwd(""); setOpen(false); onDone();
      return;
    }
    
    if (pwd !== confirmPwd) return toast.error("Passwords do not match");
    if (pwd.length < 3) return toast.error("Password must be at least 3 characters");
    
    setBusy(true);
    const { error } = await supabase.rpc("set_member_password", { _member_id: m.id, _new_password: pwd });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated");
    setPwd(""); setConfirmPwd(""); setOpen(false); onDone();
  };

  const deleteMember = async () => {
    if (!confirm(`Delete "${m.name}" and all their documents? This cannot be undone.`)) return;
    try {
      const { data: memberDocs } = await supabase.from("documents").select("file_path").eq("member_id", m.id);
      if (memberDocs && memberDocs.length > 0) {
        const filePaths = memberDocs.map((d: any) => d.file_path);
        await supabase.storage.from("documents").remove(filePaths);
        await supabase.from("documents").delete().eq("member_id", m.id);
      }
      const { error } = await supabase.from("family_members").delete().eq("id", m.id);
      if (error) throw error;
      toast.success("Member deleted");
      onDone();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to delete member");
    }
  };

  return (
    <div className="flex items-center justify-between rounded-2xl border border-border/40 bg-background/40 p-3">
      <div>
        <div className="font-medium">{m.name}</div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          {m.password_hash ? <><Lock className="h-3 w-3" /> Protected</> : <><Unlock className="h-3 w-3" /> Open</>}
        </div>
      </div>
      <div className="flex gap-1">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="rounded-full"><KeyRound className="mr-1 h-3.5 w-3.5" /> Set / Reset</Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Password for {m.name}</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div>
                <Label htmlFor={`pw-${m.id}`}>New password</Label>
                <Input id={`pw-${m.id}`} type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="Leave blank to remove password" />
              </div>
              {pwd && (
                <div>
                  <Label htmlFor={`cpw-${m.id}`}>Confirm password</Label>
                  <Input id={`cpw-${m.id}`} type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} placeholder="Re-enter password" />
                  {pwd !== confirmPwd && confirmPwd && <p className="mt-1 text-xs text-destructive">Passwords do not match</p>}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => { setOpen(false); setPwd(""); setConfirmPwd(""); }}>Cancel</Button>
              <Button onClick={save} disabled={busy || (!!pwd && pwd !== confirmPwd)} className="gradient-primary border-0">
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Button size="sm" variant="ghost" className="rounded-full text-destructive hover:bg-destructive/10" onClick={deleteMember}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function DocRow({ d, memberName, members, onChanged }: { d: Doc; memberName: string; members: Member[]; onChanged: () => void }) {
  const [editOpen, setEditOpen] = useState(false);
  
  const view = async () => { 
    try { 
      window.open(await signedUrl(d.file_path), "_blank"); 
    } catch { 
      toast.error("Failed to open document"); 
    } 
  };
  
  const dl = async () => {
    try { 
      const a = document.createElement("a"); 
      a.href = await signedUrl(d.file_path); 
      a.download = d.file_name; 
      document.body.appendChild(a); 
      a.click(); 
      a.remove(); 
      toast.success("Download started");
    } catch { 
      toast.error("Failed to download"); 
    }
  };
  
  const del = async () => {
    if (!confirm(`Delete "${d.document_name}"? This cannot be undone.`)) return;
    try {
      await supabase.storage.from("documents").remove([d.file_path]);
      const { error } = await supabase.from("documents").delete().eq("id", d.id);
      if (error) throw error;
      toast.success("Document deleted"); 
      onChanged();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to delete");
    }
  };

  // Check file type
  const getFileType = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext || '')) {
      return { type: 'image', icon: ImageIcon, label: 'Image' };
    }
    if (['pdf'].includes(ext || '')) {
      return { type: 'pdf', icon: FileText, label: 'PDF' };
    }
    return { type: 'other', icon: FileText, label: 'Document' };
  };

  const fileInfo = getFileType(d.file_name);
  const FileIcon = fileInfo.icon;

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2">
          <FileIcon className="h-4 w-4 text-muted-foreground" />
          <div>
            <div className="font-medium">{d.document_name}</div>
            <div className="text-xs text-muted-foreground">{d.file_name}</div>
          </div>
        </div>
      </TableCell>
      <TableCell className="hidden sm:table-cell">{memberName}</TableCell>
      <TableCell className="hidden md:table-cell text-sm">
        {d.registration_number || <span className="text-muted-foreground">—</span>}
      </TableCell>
      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
        {d.document_date ? new Date(d.document_date).toLocaleDateString() : "—"}
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
          fileInfo.type === 'image' 
            ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' 
            : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
        }`}>
          <FileIcon className="h-3 w-3" />
          {fileInfo.label}
        </span>
      </TableCell>
      <TableCell className="text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" className="rounded-full h-8 w-8 p-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={view} className="cursor-pointer">
              <Eye className="mr-2 h-4 w-4" /> View Document
            </DropdownMenuItem>
            <DropdownMenuItem onClick={dl} className="cursor-pointer">
              <Download className="mr-2 h-4 w-4" /> Download
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setEditOpen(true)} className="cursor-pointer">
              <Pencil className="mr-2 h-4 w-4" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={del} className="cursor-pointer text-destructive focus:text-destructive">
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {editOpen && <EditDialog d={d} members={members} onClose={() => setEditOpen(false)} onDone={onChanged} />}
      </TableCell>
    </TableRow>
  );
}

type CapturedImage = { id: string; file: File; dataUrl: string };

async function imagesToPdf(images: CapturedImage[], baseName: string): Promise<File> {
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  for (let i = 0; i < images.length; i++) {
    const { dataUrl } = images[i];
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const el = new window.Image();
      el.onload = () => res(el);
      el.onerror = rej;
      el.src = dataUrl;
    });
    const ratio = Math.min(pageW / img.width, pageH / img.height);
    const w = img.width * ratio;
    const h = img.height * ratio;
    const x = (pageW - w) / 2;
    const y = (pageH - h) / 2;
    if (i > 0) pdf.addPage();
    const fmt = dataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
    pdf.addImage(dataUrl, fmt, x, y, w, h);
  }
  const blob = pdf.output("blob");
  return new File([blob], `${baseName || "document"}.pdf`, { type: "application/pdf" });
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onloadend = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

function UploadDialog({ members, onDone }: { members: Member[]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ member_id: "", document_name: "", registration_number: "", document_date: "" });
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [images, setImages] = useState<CapturedImage[]>([]);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setPdfFile(null); setImages([]);
    setForm({ member_id: "", document_name: "", registration_number: "", document_date: "" });
  };

  const addFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const arr = Array.from(fileList);
    const pdf = arr.find((f) => f.type === "application/pdf");
    if (pdf) {
      setPdfFile(pdf); setImages([]);
      return;
    }
    const imgs = arr.filter((f) => f.type.startsWith("image/"));
    if (imgs.length === 0) return toast.error("Select a PDF or image");
    const captured: CapturedImage[] = [];
    for (const f of imgs) {
      captured.push({ id: `${Date.now()}-${Math.random()}`, file: f, dataUrl: await readAsDataURL(f) });
    }
    setPdfFile(null);
    setImages((prev) => [...prev, ...captured]);
  };

  const removeImage = (id: string) => setImages((prev) => prev.filter((i) => i.id !== id));

  const doUpload = async (mode: "keep" | "pdf") => {
    if (!form.member_id || !form.document_name) return toast.error("Fill required fields");
    let uploadFile: File | null = null;

    if (pdfFile) {
      uploadFile = pdfFile;
    } else if (images.length > 0) {
      if (mode === "pdf") {
        try {
          uploadFile = await imagesToPdf(images, form.document_name);
        } catch (e: any) {
          return toast.error("Failed to build PDF: " + (e?.message ?? ""));
        }
      } else {
        if (images.length > 1) return toast.error("Keeping as image supports only 1 photo. Use 'Create PDF' for multiple, or remove extras.");
        uploadFile = images[0].file;
      }
    } else {
      return toast.error("Add a file or take a photo");
    }

    setBusy(true);
    try {
      const safeName = uploadFile.name.replace(/[^\w.\-]+/g, "_");
      const path = `${form.member_id}/${Date.now()}-${safeName}`;
      const up = await supabase.storage.from("documents").upload(path, uploadFile, {
        contentType: uploadFile.type || "application/octet-stream",
      });
      if (up.error) throw up.error;

      const { data: userData } = await supabase.auth.getUser();
      const ins = await supabase.from("documents").insert({
        member_id: form.member_id,
        document_name: form.document_name,
        registration_number: form.registration_number || null,
        document_date: form.document_date || null,
        category: uploadFile.type.startsWith("image/") ? "Image" : "Document",
        upload_date: new Date().toISOString().slice(0, 10),
        file_path: path,
        file_name: uploadFile.name,
        uploaded_by: userData.user?.id ?? null,
      });
      if (ins.error) throw ins.error;

      toast.success("Uploaded successfully");
      setOpen(false); reset(); onDone();
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally { setBusy(false); }
  };

  const hasImages = images.length > 0;
  const hasPdf = !!pdfFile;

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button className="rounded-full gradient-primary border-0"><Upload className="mr-2 h-4 w-4" /> Upload</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Upload Document</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <Field label="Family Member">
            <Select value={form.member_id} onValueChange={(v) => setForm({ ...form, member_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select member" /></SelectTrigger>
              <SelectContent>
                {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Document Name">
            <Input value={form.document_name} onChange={(e) => setForm({ ...form, document_name: e.target.value })} placeholder="e.g. Passport, Aadhaar, Photo" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Registration Number">
              <Input value={form.registration_number} onChange={(e) => setForm({ ...form, registration_number: e.target.value })} placeholder="e.g. A1234567" />
            </Field>
            <Field label="Document Date">
              <Input type="date" value={form.document_date} onChange={(e) => setForm({ ...form, document_date: e.target.value })} />
            </Field>
          </div>

          <Field label="File / Photos">
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border bg-background/60 px-3 py-2 text-sm hover:bg-background">
                <FilePlus className="h-4 w-4" /> Choose file(s)
                <input type="file" accept="application/pdf,image/*" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
              </label>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border bg-background/60 px-3 py-2 text-sm hover:bg-background">
                <Camera className="h-4 w-4" /> Take photo
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
              </label>
              {(hasPdf || hasImages) && (
                <Button type="button" variant="ghost" size="sm" className="rounded-full" onClick={reset}>
                  <X className="mr-1 h-3.5 w-3.5" /> Clear
                </Button>
              )}
            </div>

            {hasPdf && (
              <div className="mt-2 flex items-center gap-2 rounded-lg border p-2 text-sm">
                <FileText className="h-4 w-4" />
                <span className="truncate">{pdfFile!.name}</span>
                <span className="ml-auto text-xs text-muted-foreground">{(pdfFile!.size / 1024).toFixed(1)} KB</span>
              </div>
            )}

            {hasImages && (
              <div className="mt-2 space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  {images.map((img, idx) => (
                    <div key={img.id} className="relative overflow-hidden rounded-lg border">
                      <img src={img.dataUrl} alt={`page ${idx + 1}`} className="h-24 w-full object-cover" />
                      <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 text-[10px] text-white">{idx + 1}</span>
                      <button type="button" onClick={() => removeImage(img.id)} className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {images.length} photo{images.length === 1 ? "" : "s"} — choose how to upload below.
                </p>
              </div>
            )}
          </Field>
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
          <Button variant="ghost" onClick={() => { setOpen(false); reset(); }}>Cancel</Button>
          {hasPdf ? (
            <Button onClick={() => doUpload("keep")} disabled={busy} className="gradient-primary border-0">
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Upload PDF
            </Button>
          ) : hasImages ? (
            <>
              {images.length === 1 && (
                <Button variant="outline" onClick={() => doUpload("keep")} disabled={busy} className="rounded-full">
                  <ImageIcon className="mr-2 h-4 w-4" /> Keep as image
                </Button>
              )}
              <Button onClick={() => doUpload("pdf")} disabled={busy} className="gradient-primary border-0">
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <FileText className="mr-2 h-4 w-4" /> Create PDF & upload
              </Button>
            </>
          ) : (
            <Button disabled className="gradient-primary border-0 opacity-50">Upload</Button>
          )}
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
  const [preview, setPreview] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] ?? null;
    setReplace(selectedFile);
    
    if (selectedFile && selectedFile.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
    } else {
      setPreview(null);
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      let file_path = d.file_path, file_name = d.file_name;
      if (replace) {
        const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!validTypes.includes(replace.type)) {
          toast.error("Please upload a PDF or image file");
          setBusy(false);
          return;
        }
        
        const path = `${form.member_id}/${Date.now()}-${replace.name.replace(/[^\w.\-]+/g, "_")}`;
        const up = await supabase.storage.from("documents").upload(path, replace, { 
          contentType: replace.type || "application/octet-stream" 
        });
        if (up.error) throw up.error;
        await supabase.storage.from("documents").remove([d.file_path]);
        file_path = path; 
        file_name = replace.name;
      }
      const { error } = await supabase.from("documents").update({
        member_id: form.member_id,
        document_name: form.document_name,
        registration_number: form.registration_number || null,
        document_date: form.document_date || null,
        file_path, file_name,
      }).eq("id", d.id);
      if (error) throw error;
      toast.success("Document updated successfully"); 
      onClose(); 
      onDone();
    } catch (e: any) { 
      toast.error(e.message ?? "Save failed"); 
    }
    finally { setBusy(false); }
  };

  const isImage = replace?.type?.startsWith('image/');

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Edit Document</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <Field label="Family Member">
            <Select value={form.member_id} onValueChange={(v) => setForm({ ...form, member_id: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Document Name">
            <Input 
              value={form.document_name} 
              onChange={(e) => setForm({ ...form, document_name: e.target.value })} 
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Registration Number">
              <Input 
                value={form.registration_number} 
                onChange={(e) => setForm({ ...form, registration_number: e.target.value })} 
              />
            </Field>
            <Field label="Document Date">
              <Input 
                type="date" 
                value={form.document_date} 
                onChange={(e) => setForm({ ...form, document_date: e.target.value })} 
              />
            </Field>
          </div>
          <Field label={`Replace file (current: ${d.file_name})`}>
            <Input 
              type="file" 
              accept="application/pdf,image/*" 
              onChange={handleFileChange} 
            />
            {replace && (
              <div className="mt-2">
                <p className="text-xs text-muted-foreground">
                  {replace.name} ({(replace.size / 1024).toFixed(1)} KB) - {replace.type.startsWith('image/') ? '🖼️ Image' : '📄 PDF'}
                </p>
                {isImage && preview && (
                  <div className="mt-2 rounded-lg border overflow-hidden">
                    <img src={preview} alt="Preview" className="max-h-48 w-full object-contain" />
                  </div>
                )}
              </div>
            )}
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

function AddMemberDialog({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) return toast.error("Enter member name");
    setBusy(true);
    try {
      const slug = name.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^\w\-]/g, "");
      const { data: lastMember } = await supabase.from("family_members").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
      const sort_order = (lastMember?.sort_order ?? 0) + 1;
      
      const { error } = await supabase.from("family_members").insert({
        name: name.trim(),
        slug,
        sort_order,
      });
      if (error) throw error;
      toast.success("Member added successfully");
      setName("");
      setOpen(false);
      onDone();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to add member");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-full gradient-primary border-0"><Plus className="mr-2 h-4 w-4" /> Add Member</Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Add Family Member</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <Field label="Member Name">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="e.g. John Dhole"
              autoFocus
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy} className="gradient-primary border-0">
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Add Member
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}