import React, { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import axios from "axios";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Download,
  Upload as UploadIcon,
  FileSpreadsheet,
  Loader2,
  AlertCircle,
  GitCompare,
  User as UserIcon,
  Clock,
} from "lucide-react";

interface ReportDefinition {
  id: string;
  label: string;
  description: string;
  countries: string[];
}

interface ReportSummary {
  uploadedBy: string;
  uploadedByDisplayName: string;
  uploadedAt: string;
  rowCount: number | null;
  originalFilename: string;
}

interface ReportState {
  current: ReportSummary | null;
  previous: ReportSummary | null;
  hasDelta: boolean;
}

function formatTimestamp(iso: string | undefined): string {
  if (!iso) return "—";
  const utc = iso.includes("T") ? iso : iso.replace(" ", "T") + "Z";
  const d = new Date(utc);
  if (isNaN(d.getTime())) return "Unknown";
  return (
    d.toLocaleString("en-AU", {
      timeZone: "Australia/Sydney",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }) + " AEST"
  );
}

export function ReportDetail() {
  const { reportType } = useParams<{ reportType: string }>();
  const [definition, setDefinition] = useState<ReportDefinition | null>(null);
  const [definitionError, setDefinitionError] = useState<string | null>(null);
  const [activeCountry, setActiveCountry] = useState<string>("AU");
  const [state, setState] = useState<ReportState | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    axios
      .get<ReportDefinition[]>("/api/reports")
      .then((res) => {
        const def = res.data.find((r) => r.id === reportType);
        if (!def) {
          setDefinitionError("Unknown report type");
        } else {
          setDefinition(def);
          if (def.countries.length > 0) {
            setActiveCountry((curr) =>
              def.countries.includes(curr) ? curr : def.countries[0]!,
            );
          }
        }
      })
      .catch(() => setDefinitionError("Failed to load reports"));
  }, [reportType]);

  const fetchState = async () => {
    if (!reportType || !activeCountry) return;
    setLoading(true);
    try {
      const res = await axios.get<ReportState>(
        `/api/reports/${reportType}/${activeCountry}`,
      );
      setState(res.data);
    } catch (err) {
      console.error("Failed to fetch report state:", err);
      setState(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchState();
    setUploadError(null);
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportType, activeCountry]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !reportType || !activeCountry) return;
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append("file", selectedFile);
      const res = await axios.post<ReportState>(
        `/api/reports/${reportType}/${activeCountry}/upload`,
        fd,
      );
      setState(res.data);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: any) {
      const msg =
        err?.response?.data?.error || err?.message || "Upload failed";
      setUploadError(msg);
    } finally {
      setUploading(false);
    }
  };

  if (definitionError) {
    return (
      <div className="bg-slate-50">
        <main className="max-w-6xl mx-auto p-8">
          <Card className="p-8 text-center text-slate-500">
            <AlertCircle className="w-8 h-8 mx-auto mb-3 text-red-400" />
            <p className="font-bold">{definitionError}</p>
            <Link
              to="/reporting"
              className="text-primary text-xs font-bold uppercase tracking-widest mt-4 inline-block"
            >
              Back to reports
            </Link>
          </Card>
        </main>
      </div>
    );
  }

  if (!definition) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  const downloadUrl = (variant: string) =>
    `/api/reports/${reportType}/${activeCountry}/download/${variant}`;

  return (
    <div className="bg-slate-50">
      <main className="max-w-6xl mx-auto p-8 space-y-8">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <Link
              to="/reporting"
              className="text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-primary inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-3 h-3" />
              All reports
            </Link>
            <h2 className="text-2xl font-bold text-slate-900 break-all">
              {definition.label}
            </h2>
            <p className="text-slate-500 text-sm">{definition.description}</p>
          </div>
          <Tabs
            value={activeCountry}
            onValueChange={(v: string) => setActiveCountry(v)}
          >
            <TabsList>
              {definition.countries.map((c) => (
                <TabsTrigger
                  key={c}
                  value={c}
                  className="px-4 text-[10px] font-bold uppercase tracking-widest"
                >
                  {c}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {loading ? (
          <div className="py-20 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : (
          <>
            <Card className="p-6 bg-white border-slate-200 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg text-primary">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">Current upload</h3>
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest">
                      Latest version for {activeCountry}
                    </p>
                  </div>
                </div>
              </div>

              {state?.current ? (
                <div className="space-y-4">
                  <MetadataRow summary={state.current} />
                  <div className="flex gap-3 flex-wrap">
                    <a href={downloadUrl("original")}>
                      <Button
                        variant="outline"
                        className="font-bold uppercase tracking-wider text-xs"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Original
                      </Button>
                    </a>
                    <a href={downloadUrl("cleansed")}>
                      <Button className="bg-primary hover:bg-primary/90 text-white font-bold uppercase tracking-wider text-xs">
                        <Download className="w-4 h-4 mr-2" />
                        Cleansed
                      </Button>
                    </a>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500 py-4">
                  No upload yet for {activeCountry}. Upload a Pimcore export
                  below to get started.
                </p>
              )}
            </Card>

            {state?.previous && (
              <Card className="p-6 bg-white border-slate-200 shadow-sm space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-100 rounded-lg text-slate-500">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900">
                        Previous upload
                      </h3>
                      <p className="text-[10px] text-slate-400 uppercase tracking-widest">
                        Kept as the delta baseline
                      </p>
                    </div>
                  </div>
                </div>
                <MetadataRow summary={state.previous} />
              </Card>
            )}

            {state?.hasDelta && (
              <Card className="p-6 bg-white border-slate-200 shadow-sm space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                      <GitCompare className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900">Delta</h3>
                      <p className="text-[10px] text-slate-400 uppercase tracking-widest">
                        New IMSKUs vs previous, with cleansing rules applied
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 flex-wrap">
                  <a href={downloadUrl("delta")}>
                    <Button className="bg-primary hover:bg-primary/90 text-white font-bold uppercase tracking-wider text-xs">
                      <Download className="w-4 h-4 mr-2" />
                      Delta
                    </Button>
                  </a>
                </div>
              </Card>
            )}

            <Card className="p-6 bg-white border-slate-200 shadow-sm space-y-5">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                  <UploadIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">
                    Upload new version
                  </h3>
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest">
                    Replaces the current {activeCountry} upload. Previous moves
                    to baseline.
                  </p>
                </div>
              </div>

              <form onSubmit={handleUpload} className="space-y-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={(e) =>
                    setSelectedFile(e.target.files?.[0] ?? null)
                  }
                  disabled={uploading}
                  className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border file:border-slate-200 file:bg-slate-50 file:text-xs file:font-bold file:uppercase file:tracking-wider file:text-slate-700 hover:file:bg-slate-100 file:cursor-pointer"
                />
                {uploadError && (
                  <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-lg text-xs font-bold flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span className="break-words">{uploadError}</span>
                  </div>
                )}
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    disabled={!selectedFile || uploading}
                    className="bg-primary hover:bg-primary/90 text-white font-bold uppercase tracking-wider text-xs px-8"
                  >
                    {uploading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <UploadIcon className="w-4 h-4 mr-2" />
                    )}
                    {uploading ? "Uploading..." : "Upload"}
                  </Button>
                </div>
              </form>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}

function MetadataRow({ summary }: { summary: ReportSummary }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-xs">
      <Field label="File name" value={summary.originalFilename} mono />
      <Field
        label="Rows"
        value={summary.rowCount?.toLocaleString() ?? "—"}
      />
      <Field
        label="Uploaded by"
        value={summary.uploadedByDisplayName}
        icon={<UserIcon className="w-3 h-3 text-slate-300" />}
      />
      <Field
        label="Uploaded at"
        value={formatTimestamp(summary.uploadedAt)}
        icon={<Clock className="w-3 h-3 text-slate-300" />}
      />
    </div>
  );
}

function Field({
  label,
  value,
  icon,
  mono,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-slate-400">
        {icon}
        {label}
      </div>
      <div
        className={`text-slate-900 break-all ${mono ? "font-mono text-[11px]" : "font-bold"}`}
      >
        {value}
      </div>
    </div>
  );
}
