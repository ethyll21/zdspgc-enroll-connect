import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { profiles } from "@/integrations/localdb/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Camera, User2, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_app/profile")({
  component: ProfilePage,
});

const profileSchema = z.object({
  full_name: z.string().min(1, { message: "Please enter your Full Name" }).max(120),
  contact_number: z.string().regex(/^09\d{9}$/, { message: "Please enter a valid 11-digit mobile number starting with 09" }).optional().or(z.literal("")),
  birthdate: z.string().optional().or(z.literal("")),
  gender: z.string().optional().or(z.literal("")),
  address: z.string().max(300).optional().or(z.literal("")),
});

function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: profile, refetch } = useQuery({
    queryKey: ["profile-me", user?.id],
    enabled: !!user,
    queryFn: () => profiles.me().then((r) => r.profile),
  });

  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: "",
      contact_number: "",
      birthdate: "",
      gender: "",
      address: "",
    },
  });

  useEffect(() => {
    if (profile) {
      form.reset({
        full_name:      profile.full_name ?? "",
        contact_number: profile.contact_number ?? "",
        birthdate:      profile.birthdate?.slice(0, 10) ?? "",
        gender:         profile.gender ?? "",
        address:        profile.address ?? "",
      });
    }
  }, [profile, form]);

  // ── Avatar selection & upload ────────────────────────────────────────────────
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Local preview
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    // Upload immediately
    setAvatarUploading(true);
    try {
      await profiles.uploadAvatar(file);
      toast.success("Profile picture updated!");
      refetch();
      refreshUser();
      queryClient.invalidateQueries({ queryKey: ["profile-me"] });
    } catch (err: any) {
      toast.error(err.message ?? "Failed to upload picture");
      setAvatarPreview(null);
    } finally {
      setAvatarUploading(false);
      // reset input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const currentAvatarSrc =
    avatarPreview ?? (profile?.avatar_url ? profiles.avatarUrl(profile.avatar_url) : null);

  // ── Profile save ─────────────────────────────────────────────────────────────
  const save = async (values: z.infer<typeof profileSchema>) => {
    setBusy(true);
    try {
      await profiles.update({
        full_name:      values.full_name,
        contact_number: values.contact_number || undefined,
        birthdate:      values.birthdate || undefined,
        gender:         values.gender || undefined,
        address:        values.address || undefined,
      });
      toast.success("Profile saved successfully");
      refetch();
      refreshUser();
      queryClient.invalidateQueries({ queryKey: ["profile-me"] });
    } catch (err: any) {
      toast.error(err.message ?? "Failed to save profile");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-20">

      {/* ── Avatar section ──────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden flex flex-col items-center justify-center gap-4 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm transition-all hover:shadow-md text-center">
        <div className="relative group shrink-0">
          {/* Avatar circle */}
          <div className="h-32 w-32 rounded-full overflow-hidden ring-4 ring-slate-50 bg-slate-100 flex items-center justify-center shadow-lg transition-transform duration-300 group-hover:scale-[1.02]">
            {currentAvatarSrc ? (
              <img
                src={currentAvatarSrc}
                alt="Profile picture"
                className="h-full w-full object-cover"
              />
            ) : (
              <User2 className="h-16 w-16 text-slate-300" />
            )}
          </div>

          {/* Camera overlay button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={avatarUploading}
            className="
              absolute bottom-1 right-1
              flex h-11 w-11 items-center justify-center
              rounded-full border-[3px] border-white
              bg-blue-600 text-white shadow-xl
              transition-all duration-200 hover:scale-110 hover:bg-blue-700
              disabled:opacity-60 disabled:cursor-not-allowed
            "
            title="Change profile picture"
          >
            {avatarUploading
              ? <Loader2 className="h-5 w-5 animate-spin" />
              : <Camera className="h-5 w-5" />
            }
          </button>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            className="hidden"
            onChange={handleAvatarChange}
          />
        </div>

        <div className="flex flex-col items-center space-y-2">
          <p className="text-2xl font-bold text-slate-800 tracking-tight">
            {profile?.full_name || user?.email}
          </p>
          <div className="inline-flex items-center justify-center rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 ring-1 ring-inset ring-blue-600/20 uppercase tracking-widest">
            {user?.role === "admin" ? "Registrar / Admin" : "Student"}
          </div>
        </div>
      </div>

      {/* ── Profile form ────────────────────────────────────────────────────── */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(save)} className="mt-4 space-y-4 rounded-xl border bg-card p-6 shadow-sm">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={user?.email ?? ""} disabled className="bg-muted/40" />
          </div>

          
          <FormField
            control={form.control}
            name="full_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full Name</FormLabel>
                <FormControl>
                  <Input maxLength={120} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid gap-4 md:grid-cols-2">

            <FormField
              control={form.control}
              name="birthdate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Birthdate</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="gender"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Gender</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || undefined}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Prefer not to say</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="address"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Address</FormLabel>
                <FormControl>
                  <Textarea rows={3} maxLength={300} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save changes"}</Button>
        </form>
      </Form>
    </div>
  );
}

