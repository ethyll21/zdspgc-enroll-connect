import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);

  const { data: profile, refetch } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      return data;
    },
  });

  const [form, setForm] = useState({
    full_name: "", contact_number: "", birthdate: "", gender: "", address: "",
  });

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name ?? "",
        contact_number: profile.contact_number ?? "",
        birthdate: profile.birthdate ?? "",
        gender: profile.gender ?? "",
        address: profile.address ?? "",
      });
    }
  }, [profile]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from("profiles").upsert({
      id: user!.id,
      email: user!.email!,
      ...form,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Profile saved");
    refetch();
  };

  return (
    <div className="mx-auto max-w-2xl pb-20">
      <h1 className="font-display text-3xl font-semibold text-primary">My Profile</h1>
      <p className="text-sm text-muted-foreground">Keep your information current.</p>

      <form onSubmit={save} className="mt-6 space-y-4 rounded-xl border bg-card p-6 shadow-sm">
        <div className="space-y-2">
          <Label>Email</Label>
          <Input value={user?.email ?? ""} disabled />
        </div>
        <div className="space-y-2">
          <Label>Full Name</Label>
          <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} maxLength={120} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Contact Number</Label>
            <Input value={form.contact_number} onChange={(e) => setForm({ ...form, contact_number: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Birthdate</Label>
            <Input type="date" value={form.birthdate} onChange={(e) => setForm({ ...form, birthdate: e.target.value })} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Gender</Label>
          <Input value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Address</Label>
          <Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={3} />
        </div>
        <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save changes"}</Button>
      </form>
    </div>
  );
}
