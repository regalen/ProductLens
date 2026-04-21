import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, ChevronRight, Loader2 } from "lucide-react";

interface ReportDefinition {
  id: string;
  label: string;
  description: string;
  countries: string[];
}

export function Reporting() {
  const [reports, setReports] = useState<ReportDefinition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get<ReportDefinition[]>("/api/reports")
      .then((res) => setReports(res.data))
      .catch((err) => console.error("Failed to fetch reports:", err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-slate-50">
      <main className="max-w-6xl mx-auto p-8 space-y-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Reporting</h2>
          <p className="text-slate-500 text-sm">
            Process Pimcore exports — cleanse, compare, and download.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {reports.map((r) => (
            <Link key={r.id} to={`/reporting/${r.id}`}>
              <Card className="p-6 bg-white border-slate-200 shadow-sm hover:shadow-md hover:border-primary/30 transition-all cursor-pointer h-full">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary shrink-0">
                      <BarChart3 className="w-5 h-5" />
                    </div>
                    <div className="space-y-2 min-w-0">
                      <h3 className="font-bold text-slate-900 break-all">
                        {r.label}
                      </h3>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        {r.description}
                      </p>
                      <div className="flex gap-1.5 flex-wrap pt-1">
                        {r.countries.map((c) => (
                          <Badge
                            key={c}
                            className="bg-slate-50 text-slate-500 border-slate-200 text-[9px] font-bold uppercase tracking-widest px-1.5 py-0 h-4"
                          >
                            {c}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 shrink-0 mt-2" />
                </div>
              </Card>
            </Link>
          ))}
          {reports.length === 0 && (
            <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-300 gap-4">
              <BarChart3 className="w-16 h-16 opacity-10" />
              <p className="font-bold uppercase tracking-widest">
                No reports configured
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
