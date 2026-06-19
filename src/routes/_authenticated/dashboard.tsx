import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Calendar, CreditCard, ClipboardList, Apple, FileText, Activity,
  PlayCircle, Plus, BellRing, CheckCircle2, Clock, AlertCircle, Download,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { INR, fmtDate, daysBetween } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "My Dashboard — SRGYM" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => (await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle()).data,
    enabled: !!user,
  });

  const { data: membership } = useQuery({
    queryKey: ["membership", user?.id],
    queryFn: async () => (await supabase.from("memberships").select("*, membership_plans(name)").eq("user_id", user!.id).order("end_date", { ascending: false }).limit(1).maybeSingle()).data,
    enabled: !!user,
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["payments", user?.id],
    queryFn: async () => (await supabase.from("payments").select("*").eq("user_id", user!.id).order("due_date", { ascending: false })).data ?? [],
    enabled: !!user,
  });

  const { data: attendance = [] } = useQuery({
    queryKey: ["attendance", user?.id],
    queryFn: async () => (await supabase.from("attendance").select("*").eq("user_id", user!.id).order("date", { ascending: false }).limit(60)).data ?? [],
    enabled: !!user,
  });

  const { data: workouts = [] } = useQuery({
    queryKey: ["workouts", user?.id],
    queryFn: async () => (await supabase.from("workout_plans").select("*").eq("user_id", user!.id).order("created_at", { ascending: false })).data ?? [],
    enabled: !!user,
  });

  const { data: diets = [] } = useQuery({
    queryKey: ["diets", user?.id],
    queryFn: async () => (await supabase.from("diet_plans").select("*").eq("user_id", user!.id).order("created_at", { ascending: false })).data ?? [],
    enabled: !!user,
  });

  const { data: leaves = [] } = useQuery({
    queryKey: ["leaves", user?.id],
    queryFn: async () => (await supabase.from("leave_requests").select("*").eq("user_id", user!.id).order("created_at", { ascending: false })).data ?? [],
    enabled: !!user,
  });

  const { data: notifs = [] } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async () => (await supabase.from("notifications").select("*").or(`user_id.eq.${user!.id},user_id.is.null`).order("created_at", { ascending: false }).limit(30)).data ?? [],
    enabled: !!user,
  });

  // Real-time notification updates
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("notif-" + user.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => {
        qc.invalidateQueries({ queryKey: ["notifications", user.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  const unread = notifs.filter((n) => !n.is_read).length;
  const daysLeft = membership ? daysBetween(membership.end_date) : null;
  const expired = daysLeft !== null && daysLeft < 0;
  const todayMarked = attendance.some((a) => a.date === new Date().toISOString().slice(0, 10));

  async function checkIn() {
    const today = new Date().toISOString().slice(0, 10);
    const { error } = await supabase.from("attendance").insert({ user_id: user!.id, date: today });
    if (error) toast.error(error.message);
    else {
      toast.success("Checked in for today 💪");
      qc.invalidateQueries({ queryKey: ["attendance", user!.id] });
    }
  }

  return (
    <AppShell
      title={`Hey, ${profile?.full_name?.split(" ")[0] ?? "Athlete"} 👋`}
      subtitle="Your training command centre."
      notifCount={unread}
    >
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          icon={Calendar}
          label="Membership"
          value={membership?.membership_plans?.name ?? "—"}
          sub={membership ? (expired ? "Expired" : `${daysLeft} days left`) : "No active plan"}
          tone={expired ? "danger" : daysLeft !== null && daysLeft < 14 ? "warn" : "ok"}
        />
        <StatCard
          icon={CreditCard}
          label="Payment"
          value={
            payments.some((p) => p.status === "overdue")
              ? "Overdue"
              : payments.some((p) => p.status === "pending")
              ? "Pending"
              : "Up to date"
          }
          sub={payments[0] ? `Last: ${fmtDate(payments[0].due_date)}` : "No payments"}
          tone={payments.some((p) => p.status === "overdue") ? "danger" : "ok"}
        />
        <StatCard
          icon={Activity}
          label="Attendance (30d)"
          value={`${attendance.filter((a) => daysBetween(a.date) > -30).length} days`}
          sub={`${Math.round((attendance.filter((a) => daysBetween(a.date) > -30).length / 30) * 100)}%`}
          tone="ok"
        />
        <StatCard
          icon={BellRing}
          label="Notifications"
          value={`${unread}`}
          sub="unread"
          tone={unread > 0 ? "warn" : "ok"}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={checkIn} disabled={todayMarked} className="bg-gradient-red text-primary-foreground shadow-red">
          <PlayCircle className="mr-2 h-4 w-4" />
          {todayMarked ? "Checked in today" : "Check in now"}
        </Button>
        <LeaveDialog />
      </div>

      <Tabs defaultValue="overview" className="mt-6">
        <TabsList className="bg-muted">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="workout">Workout</TabsTrigger>
          <TabsTrigger value="diet">Diet</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="leaves">Leaves</TabsTrigger>
          <TabsTrigger value="notifs">Notifications</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">Membership details</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {membership ? (
                <>
                  <Row label="Plan" value={membership.membership_plans?.name ?? "—"} />
                  <Row label="Start" value={fmtDate(membership.start_date)} />
                  <Row label="Expires" value={fmtDate(membership.end_date)} />
                  <Row label="Status" value={<Badge variant={expired ? "destructive" : "default"}>{expired ? "expired" : membership.status}</Badge>} />
                  <Row label="Frozen" value={membership.frozen ? "Yes" : "No"} />
                </>
              ) : <p className="text-muted-foreground">No active membership. Visit reception to enroll.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Recent activity</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {notifs.slice(0, 5).map((n) => (
                <div key={n.id} className="flex gap-3 rounded-lg border border-border p-3 text-sm">
                  <BellRing className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <div className="font-medium">{n.title}</div>
                    <div className="text-xs text-muted-foreground">{n.message}</div>
                  </div>
                </div>
              ))}
              {notifs.length === 0 && <p className="text-sm text-muted-foreground">All caught up.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workout" className="mt-4">
          <PlansList icon={ClipboardList} items={workouts} empty="No workout plan assigned yet. Speak to your trainer." />
        </TabsContent>
        <TabsContent value="diet" className="mt-4">
          <PlansList icon={Apple} items={diets} empty="No diet plan assigned yet." />
        </TabsContent>

        <TabsContent value="payments" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-muted text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">Due</th>
                    <th className="px-4 py-3 text-left">Amount</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Receipt</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-t border-border">
                      <td className="px-4 py-3">{fmtDate(p.due_date)}</td>
                      <td className="px-4 py-3 font-medium">{INR(p.amount)}</td>
                      <td className="px-4 py-3"><PayStatus s={p.status} /></td>
                      <td className="px-4 py-3 text-muted-foreground">{p.receipt_no ?? "—"}</td>
                      <td className="px-4 py-3 text-right">
                        {p.status === "paid" && (
                          <Button size="sm" variant="outline" onClick={() => downloadReceipt(p, profile?.full_name)}>
                            <Download className="mr-1 h-3 w-3" /> Receipt
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {payments.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No payments yet.</td></tr>}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attendance" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Last 60 days</CardTitle></CardHeader>
            <CardContent>
              <AttendanceGrid attendance={attendance.map((a) => a.date)} />
              <p className="mt-4 text-sm text-muted-foreground">
                {attendance.length} sessions logged. Keep showing up. 💪
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leaves" className="mt-4 space-y-3">
          {leaves.map((l) => (
            <Card key={l.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
                <div>
                  <div className="font-medium">{fmtDate(l.start_date)} → {fmtDate(l.end_date)}</div>
                  <div className="text-sm text-muted-foreground">{l.reason}</div>
                  {l.admin_notes && <div className="mt-1 text-xs text-primary">Note: {l.admin_notes}</div>}
                </div>
                <Badge variant={l.status === "approved" ? "default" : l.status === "rejected" ? "destructive" : "secondary"}>{l.status}</Badge>
              </CardContent>
            </Card>
          ))}
          {leaves.length === 0 && <p className="text-sm text-muted-foreground">No leave requests yet.</p>}
        </TabsContent>

        <TabsContent value="notifs" className="mt-4 space-y-2">
          {notifs.map((n) => (
            <Card key={n.id} className={n.is_read ? "opacity-60" : ""}>
              <CardContent className="flex gap-3 py-4">
                <BellRing className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                <div className="flex-1">
                  <div className="font-medium">{n.title}</div>
                  <div className="mt-0.5 text-sm text-muted-foreground">{n.message}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{fmtDate(n.created_at)}</div>
                </div>
                {!n.is_read && (
                  <Button size="sm" variant="ghost" onClick={async () => {
                    await supabase.from("notifications").update({ is_read: true }).eq("id", n.id);
                    qc.invalidateQueries({ queryKey: ["notifications", user?.id] });
                  }}>Mark read</Button>
                )}
              </CardContent>
            </Card>
          ))}
          {notifs.length === 0 && <p className="text-sm text-muted-foreground">No notifications.</p>}
        </TabsContent>

        <TabsContent value="profile" className="mt-4">
          <ProfileForm profile={profile} />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function StatCard({ icon: Icon, label, value, sub, tone }: { icon: any; label: string; value: string; sub: string; tone: "ok" | "warn" | "danger" }) {
  const toneCls = tone === "danger" ? "text-destructive" : tone === "warn" ? "text-primary" : "text-foreground";
  return (
    <div className="glass rounded-xl p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
        <Icon className={`h-4 w-4 ${toneCls}`} />
      </div>
      <div className={`mt-3 font-display text-2xl font-extrabold ${toneCls}`}>{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/40 py-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function PayStatus({ s }: { s: string }) {
  if (s === "paid") return <Badge className="bg-green-600/20 text-green-400 hover:bg-green-600/20"><CheckCircle2 className="mr-1 h-3 w-3" /> Paid</Badge>;
  if (s === "overdue") return <Badge variant="destructive"><AlertCircle className="mr-1 h-3 w-3" /> Overdue</Badge>;
  return <Badge variant="secondary"><Clock className="mr-1 h-3 w-3" /> Pending</Badge>;
}

function PlansList({ icon: Icon, items, empty }: { icon: any; items: any[]; empty: string }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="space-y-3">
      {items.map((p) => (
        <Card key={p.id}>
          <CardHeader className="flex flex-row items-start gap-3 space-y-0">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-red">
              <Icon className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-base">{p.title}</CardTitle>
              <p className="text-xs text-muted-foreground">{fmtDate(p.created_at)}</p>
            </div>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm text-muted-foreground">{p.content}</CardContent>
        </Card>
      ))}
    </div>
  );
}

function AttendanceGrid({ attendance }: { attendance: string[] }) {
  const set = new Set(attendance);
  const days = Array.from({ length: 60 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (59 - i));
    return d.toISOString().slice(0, 10);
  });
  return (
    <div className="grid grid-cols-15 gap-1.5 sm:grid-cols-30" style={{ gridTemplateColumns: "repeat(15, minmax(0, 1fr))" }}>
      {days.map((d) => (
        <div
          key={d}
          title={d}
          className={`aspect-square rounded ${set.has(d) ? "bg-gradient-red" : "bg-muted/60"}`}
        />
      ))}
    </div>
  );
}

function LeaveDialog() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ start_date: "", end_date: "", reason: "" });
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!form.start_date || !form.end_date || !form.reason.trim()) return toast.error("All fields are required");
    setLoading(true);
    const { error } = await supabase.from("leave_requests").insert({ ...form, user_id: user!.id });
    setLoading(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Leave submitted for approval");
      setOpen(false);
      setForm({ start_date: "", end_date: "", reason: "" });
      qc.invalidateQueries({ queryKey: ["leaves", user?.id] });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline"><Plus className="mr-2 h-4 w-4" /> Request leave</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Request leave</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>From</Label>
              <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            </div>
            <div>
              <Label>To</Label>
              <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Reason</Label>
            <Textarea rows={3} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Travel / illness / personal" />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={loading} className="bg-gradient-red text-primary-foreground">Submit</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProfileForm({ profile }: { profile: any }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [form, setForm] = useState({
    full_name: profile?.full_name ?? "",
    phone: profile?.phone ?? "",
    address: profile?.address ?? "",
    emergency_contact: profile?.emergency_contact ?? "",
  });
  useEffect(() => {
    if (profile) setForm({
      full_name: profile.full_name ?? "",
      phone: profile.phone ?? "",
      address: profile.address ?? "",
      emergency_contact: profile.emergency_contact ?? "",
    });
  }, [profile]);

  async function save() {
    const { error } = await supabase.from("profiles").update(form).eq("id", user!.id);
    if (error) toast.error(error.message);
    else { toast.success("Profile updated"); qc.invalidateQueries({ queryKey: ["profile", user?.id] }); }
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Profile</CardTitle></CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div><Label>Full name</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
        <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        <div className="md:col-span-2"><Label>Address</Label><Textarea rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
        <div className="md:col-span-2"><Label>Emergency contact</Label><Input value={form.emergency_contact} onChange={(e) => setForm({ ...form, emergency_contact: e.target.value })} /></div>
        <div className="md:col-span-2"><Button onClick={save} className="bg-gradient-red text-primary-foreground">Save profile</Button></div>
      </CardContent>
    </Card>
  );
}

function downloadReceipt(p: any, name?: string) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Receipt ${p.receipt_no ?? p.id}</title>
<style>body{font-family:system-ui;padding:40px;color:#111}h1{color:#dc2626}table{width:100%;border-collapse:collapse;margin-top:20px}td{padding:8px;border-bottom:1px solid #eee}</style></head>
<body><h1>SRGYM AND FITNESS CENTRE</h1><p>Payment Receipt</p>
<table>
<tr><td>Receipt No</td><td>${p.receipt_no ?? p.id}</td></tr>
<tr><td>Member</td><td>${name ?? "—"}</td></tr>
<tr><td>Amount</td><td>₹ ${p.amount}</td></tr>
<tr><td>Due date</td><td>${p.due_date}</td></tr>
<tr><td>Paid at</td><td>${p.paid_at ?? "—"}</td></tr>
<tr><td>Status</td><td>${p.status}</td></tr>
</table><p style="margin-top:40px;color:#666">Thank you for training with us.</p></body></html>`;
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `receipt-${p.receipt_no ?? p.id}.html`;
  a.click();
  URL.revokeObjectURL(url);
}
