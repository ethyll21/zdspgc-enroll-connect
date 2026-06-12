import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Eye, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { STATUS_META, REQUIRED_DOCUMENTS } from "@/lib/enrollment-constants";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/_app/applications/$appId")({
  component: ApplicationDetail,
});

function ApplicationDetail() {
  const { appId } = Route.useParams();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["application", appId],
    queryFn: async () => {
      const { data: app, error } = await supabase
        .from("applications")
        .select("*, program:programs(name, code)")
        .eq("id", appId)
        .single();
      if (error) throw error;
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email, contact_number, birthdate, gender, address")
        .eq("id", app.student_id)
        .maybeSingle();
      const { data: docs } = await supabase
        .from("application_documents")
        .select("*")
        .eq("application_id", appId)
        .order("uploaded_at");
      return { app: { ...app, profile }, docs: docs ?? [] };
    },
  });

  if (isLoading || !data) return <p className="p-6 text-muted-foreground">Loading…</p>;

  const { app, docs } = data;
  const meta = STATUS_META[app.status];
  const isOwner = user?.id === app.student_id;

  const viewDoc = async (path: string) => {
    const { data } = await supabase.storage.from("enrollment-documents").createSignedUrl(path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const decide = async (status: "approved" | "rejected" | "correction") => {
    if (!isAdmin) return;
    setBusy(true);
    const { error } = await supabase
      .from("applications")
      .update({ status, admin_remarks: remarks || null, reviewed_at: new Date().toISOString(), reviewed_by: user!.id })
      .eq("id", appId);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Application ${status}`);
    refetch();
  };

  const setDocStatus = async (docId: string, status: "approved" | "rejected") => {
    await supabase.from("application_documents").update({ status }).eq("id", docId);
    refetch();
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-20">
      <Link to={isAdmin ? "/admin/applications" : "/dashboard"} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Application</p>
            <h1 className="font-display text-2xl font-semibold text-primary">
              {app.program?.name} <span className="text-muted-foreground">({app.program?.code})</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {app.year_level} · {app.semester} · A.Y. {app.academic_year}
            </p>
          </div>
          <span className={`status-pill ${meta.tone}`}>{meta.label}</span>
        </div>
        {app.admin_remarks && (
          <div className="mt-4 rounded-md border-l-4 border-secondary bg-muted p-3 text-sm">
            <span className="font-medium">Registrar note: </span>{app.admin_remarks}
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Applicant">
          <InfoRow label="Full Name" value={app.profile?.full_name} />
          <InfoRow label="Email" value={app.profile?.email} />
          <InfoRow label="Contact" value={app.profile?.contact_number} />
          <InfoRow label="Birthdate" value={app.profile?.birthdate ? format(new Date(app.profile.birthdate), "PP") : "—"} />
          <InfoRow label="Gender" value={app.profile?.gender} />
          <InfoRow label="Address" value={app.profile?.address} />
        </Card>
        <Card title="Educational Background">
          <InfoRow label="Student Type" value={app.student_type} />
          <InfoRow label="Previous School" value={app.previous_school} />
          <InfoRow label="School Address" value={app.previous_school_address} />
          <InfoRow label="Year Graduated" value={app.year_graduated} />
          <InfoRow label="Submitted" value={format(new Date(app.submitted_at), "PPp")} />
          {app.reviewed_at && <InfoRow label="Reviewed" value={format(new Date(app.reviewed_at), "PPp")} />}
        </Card>
      </div>

      <Card title="Uploaded Documents">
        {docs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No documents uploaded.</p>
        ) : (
          <ul className="divide-y">
            {docs.map((d: any) => {
              const def = REQUIRED_DOCUMENTS.find((r) => r.key === d.document_type);
              return (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{def?.label ?? d.document_type}</p>
                    <p className="text-xs text-muted-foreground truncate">{d.file_name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`status-pill ${STATUS_META[d.status]?.tone ?? STATUS_META.pending.tone}`}>
                      {d.status}
                    </span>
                    <Button size="sm" variant="outline" onClick={() => viewDoc(d.file_path)}>
                      <Eye className="mr-1 h-3.5 w-3.5" /> View
                    </Button>
                    {isAdmin && d.status === "pending" && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => setDocStatus(d.id, "approved")}>Approve</Button>
                        <Button size="sm" variant="outline" onClick={() => setDocStatus(d.id, "rejected")}>Reject</Button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {isAdmin && app.status === "pending" && (
        <Card title="Registrar Decision">
          <Textarea
            placeholder="Add remarks for the student (optional, required for Reject / Request Correction)…"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            rows={3}
            maxLength={500}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={() => decide("approved")} disabled={busy} className="bg-success text-success-foreground hover:bg-success/90">
              <CheckCircle2 className="mr-2 h-4 w-4" /> Approve
            </Button>
            <Button onClick={() => decide("correction")} disabled={busy || !remarks} variant="outline">
              <AlertCircle className="mr-2 h-4 w-4" /> Request Correction
            </Button>
            <Button onClick={() => decide("rejected")} disabled={busy || !remarks} variant="destructive">
              <XCircle className="mr-2 h-4 w-4" /> Reject
            </Button>
          </div>
        </Card>
      )}

      {isOwner && app.status === "pending" && (
        <Button
          variant="destructive"
          onClick={async () => {
            if (!confirm("Withdraw this application?")) return;
            await supabase.from("applications").delete().eq("id", appId);
            toast.success("Application withdrawn");
            navigate({ to: "/dashboard" });
          }}
        >
          Withdraw application
        </Button>
      )}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <h2 className="font-display text-lg font-semibold text-primary">{title}</h2>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value || "—"}</span>
    </div>
  );
}
