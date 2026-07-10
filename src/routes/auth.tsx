import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const handle = async (mode: "in" | "up") => {
    setBusy(true);
    const res = mode === "in" ? await signIn(email, password) : await signUp(email, password);
    setBusy(false);
    if (res.error) return toast.error(res.error);
    toast.success(mode === "in" ? "Signed in" : "Account created");
    navigate({ to: "/" });
  };

  return (
    <div className="mx-auto max-w-md">
      <Card className="glass rounded-3xl border-0 p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl gradient-primary">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold">Admin Access</h1>
          <p className="text-sm text-muted-foreground">Sign in to manage documents.</p>
        </div>
        <Tabs defaultValue="in">
          <TabsList className="grid w-full grid-cols-2 rounded-full">
            <TabsTrigger value="in" className="rounded-full">Sign in</TabsTrigger>
            <TabsTrigger value="up" className="rounded-full">Create account</TabsTrigger>
          </TabsList>
          {(["in", "up"] as const).map((mode) => (
            <TabsContent key={mode} value={mode} className="space-y-3 pt-4">
              <div>
                <Label htmlFor={`e-${mode}`}>Email</Label>
                <Input id={`e-${mode}`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-xl" />
              </div>
              <div>
                <Label htmlFor={`p-${mode}`}>Password</Label>
                <Input id={`p-${mode}`} type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="rounded-xl" />
              </div>
              <Button disabled={busy} onClick={() => handle(mode)} className="w-full rounded-full gradient-primary border-0">
                {mode === "in" ? "Sign in" : "Create account"}
              </Button>
            </TabsContent>
          ))}
        </Tabs>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          After creating your account, an existing admin (or a maintainer) must grant you the admin role in the backend.
        </p>
      </Card>
    </div>
  );
}
