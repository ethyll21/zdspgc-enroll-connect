import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
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
  const { user, refreshUser, isAdmin, loading } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

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
    <div className="mx-auto max-w-2xl pb-20">
      <h1 className="font-display text-3xl font-semibold text-primary">My Profile</h1>
      <p className="text-sm text-muted-foreground">Keep your information current for enrollment records.</p>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(save)} className="mt-6 space-y-4 rounded-xl border bg-card p-6 shadow-sm">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={user?.email ?? ""} disabled className="bg-muted/40" />
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Input value={user?.role === "admin" ? "Registrar / Admin" : "Student"} disabled className="bg-muted/40 capitalize" />
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
              name="contact_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact Number</FormLabel>
                  <FormControl>
                    <Input placeholder="09XXXXXXXXX" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
