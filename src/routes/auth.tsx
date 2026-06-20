import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Dumbbell, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";


import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";


export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Login — SRGYM" },
      { name: "description", content: "Login to your SRGYM account." },
    ],
  }),
  component: Auth,
});



const loginSchema = z.object({
  idNo: z.string().trim().min(1).max(50),
  password: z.string().min(1).max(72),
});

function Auth() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  return (
    <div className="relative isolate min-h-screen bg-background">
      <div className="absolute inset-0 -z-10 bg-gradient-hero opacity-50" />
      <div className="absolute inset-0 -z-10 grid-bg opacity-30" />

      <Link to="/" className="absolute left-4 top-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground sm:left-8 sm:top-8">
        <ArrowLeft className="h-4 w-4" /> Back home
      </Link>

      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-16 sm:px-6">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-widest text-primary">
            <Dumbbell className="h-3 w-3" /> SR GYM
          </div>
          <h1 className="mt-4 font-display text-3xl font-extrabold">Welcome to <span className="text-gradient-red">SRGYM</span></h1>
          <p className="mt-2 text-sm text-muted-foreground">Members area — track your fitness journey.</p>
        </div>

        <div className="glass-strong rounded-2xl p-6 shadow-card">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}

function LoginForm() {
  const navigate = useNavigate();
  const [idNo, setIdNo] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const p = loginSchema.safeParse({ idNo, password });
    if (!p.success) {
      toast.error(p.error.issues[0].message);
      return;
    }

    setLoading(true);

    const { data: authData, error: authErr } = await supabase
      .from("auth")
      .select("email")
      .eq("user_id", p.data.idNo)
      .maybeSingle();

    if (authErr) {
      setLoading(false);
      toast.error(authErr.message);
      return;
    }

    if (!authData) {
      setLoading(false);
      toast.error("Invalid user ID or password. Please check and try again.");
      return;
    }

    const { email: user_email } = authData;

    const { data: signInData, error } = await supabase.auth.signInWithPassword({
      email: user_email,
      password: p.data.password,
    });

    setLoading(false);
    if (error) { toast.error(error.message); return; }

    toast.success("Welcome back!");

    // Redirect based on role
    const userId = signInData.user?.id;
    if (userId) {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      const isAdmin = (roles ?? []).some((r) => r.role === "admin");
      navigate({ to: isAdmin ? "/admin" : "/dashboard" });
    } else {
      navigate({ to: "/dashboard" });
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label htmlFor="li-idno">ID No</Label>
        <Input id="li-idno" value={idNo} onChange={(e) => setIdNo(e.target.value)} placeholder="e.g. SR1" required />
      </div>
      <div>
        <div className="flex items-center justify-between">
          <Label htmlFor="li-pw">Password</Label>
        </div>
        <div className="relative">
          <Input id="li-pw" type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button type="button" onClick={() => setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <Button type="submit" disabled={loading} className="w-full bg-gradient-red text-primary-foreground shadow-red">
        {loading ? "Logging in..." : "Login"}
      </Button>
    </form>
  );
}
