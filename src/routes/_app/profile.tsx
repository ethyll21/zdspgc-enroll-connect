import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { profiles, auth } from "@/integrations/localdb/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Camera, User2, Loader2, Lock, Eye, EyeOff, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_app/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const queryClient = useQueryClient();

  // ── Avatar state ──────────────────────────────────────────────────────────
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Password state ────────────────────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);

  const { data: profile, refetch } = useQuery({
    queryKey: ["profile-me", user?.id],
    enabled: typeof window !== 'undefined' && !!user,
    queryFn: () => profiles.me().then((r) => r.profile),
  });

  const currentAvatarSrc =
    avatarPreview ?? (profile?.avatar_url ? profiles.avatarUrl(profile.avatar_url) : null);

  // ── Avatar upload ─────────────────────────────────────────────────────────
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
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
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ── Change password ───────────────────────────────────────────────────────
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("New password and confirmation do not match");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }
    setPwBusy(true);
    try {
      await auth.changePassword(currentPassword, newPassword);
      toast.success("Password changed successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err.message ?? "Failed to change password");
    } finally {
      setPwBusy(false);
    }
  };

  const isAdmin = user?.role === "admin";

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 pb-20">

      {/* ── Identity card ───────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* Decorative header strip */}
        <div className="h-24 bg-gradient-to-r from-[#0A2540] to-[#0C3D6B]" />

        <div className="flex flex-col items-center gap-3 px-8 pb-8 -mt-12 text-center">
          {/* Avatar */}
          <div className="relative group">
            <div className="h-24 w-24 rounded-full overflow-hidden ring-4 ring-white bg-slate-100 flex items-center justify-center shadow-lg transition-transform duration-300 group-hover:scale-[1.03]">
              {currentAvatarSrc ? (
                <img src={currentAvatarSrc} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                <User2 className="h-12 w-12 text-slate-300" />
              )}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarUploading}
              className="absolute bottom-0.5 right-0.5 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-[#0A2540] text-white shadow-lg transition-all duration-200 hover:scale-110 hover:bg-[#0C3D6B] disabled:opacity-60"
              title="Change profile picture"
            >
              {avatarUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            </button>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={handleAvatarChange} />
          </div>

          {/* Name */}
          <p className="text-2xl font-bold text-slate-800 tracking-tight mt-2">
            {profile?.full_name || user?.email}
          </p>

          {/* Role badge */}
          {isAdmin ? (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700 ring-1 ring-inset ring-amber-600/30 uppercase tracking-widest">
              <ShieldCheck className="h-3.5 w-3.5" />
              Registrar / Admin
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 ring-1 ring-inset ring-blue-600/20 uppercase tracking-widest">
              <User2 className="h-3.5 w-3.5" />
              Student
            </div>
          )}


        </div>
      </div>

      {/* ── Change Password ──────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* Section header */}
        <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/60 px-6 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0A2540]/8">
            <Lock className="h-4 w-4 text-[#0A2540]" />
          </div>
          <div>
            <p className="font-semibold text-sm text-slate-800">Change Password</p>
            <p className="text-xs text-slate-400">Keep your account secure with a strong password</p>
          </div>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-4 p-6">
          {/* Current password */}
          <div className="space-y-1.5">
            <Label htmlFor="current-password" className="text-sm font-medium text-slate-700">
              Current Password
            </Label>
            <div className="relative">
              <Input
                id="current-password"
                type={showCurrent ? "text" : "password"}
                placeholder="Enter current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowCurrent((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showCurrent ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* New password */}
          <div className="space-y-1.5">
            <Label htmlFor="new-password" className="text-sm font-medium text-slate-700">
              New Password
            </Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showNew ? "text" : "password"}
                placeholder="At least 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNew((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showNew ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Confirm password */}
          <div className="space-y-1.5">
            <Label htmlFor="confirm-password" className="text-sm font-medium text-slate-700">
              Confirm New Password
            </Label>
            <div className="relative">
              <Input
                id="confirm-password"
                type={showConfirm ? "text" : "password"}
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                className={`pr-10 ${
                  confirmPassword && newPassword !== confirmPassword
                    ? "border-rose-400 focus-visible:ring-rose-400"
                    : ""
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showConfirm ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>
            </div>
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="text-xs text-rose-500 mt-1">Passwords do not match</p>
            )}
          </div>

          <Button
            type="submit"
            disabled={pwBusy || (!!confirmPassword && newPassword !== confirmPassword)}
            className="w-full bg-[#0A2540] hover:bg-[#0C3D6B] text-white"
          >
            {pwBusy ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Updating…</> : "Update Password"}
          </Button>
        </form>
      </div>
    </div>
  );
}
