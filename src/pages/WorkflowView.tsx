import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  ChevronRight, 
  Upload, 
  Settings2, 
  Eye, 
  Download, 
  CheckCircle2,
  Loader2,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import axios from 'axios';
import { Workflow, WorkflowImage, WorkflowStatus } from '../types';
import { IngestStage } from '../components/WorkflowStages/IngestStage';
import { ConfigureStage } from '../components/WorkflowStages/ConfigureStage';
import { PreviewStage } from '../components/WorkflowStages/PreviewStage';
import { OutputStage } from '../components/WorkflowStages/OutputStage';

const STAGES: { id: WorkflowStatus; label: string; icon: any }[] = [
  { id: 'ingest', label: 'Ingest', icon: Upload },
  { id: 'configure', label: 'Pipeline', icon: Settings2 },
  { id: 'preview', label: 'Preview', icon: Eye },
  { id: 'processing', label: 'Output', icon: Download }
];

export function WorkflowView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [images, setImages] = useState<WorkflowImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const fetchWorkflow = async () => {
      try {
        const res = await axios.get(`/api/workflows/${id}`, { signal: controller.signal });
        setWorkflow(res.data);
        setImages(res.data.images);
        setLoading(false);
      } catch (err: any) {
        if (!axios.isCancel(err)) {
          setError(err.response?.data?.error || 'Failed to load workflow');
          setLoading(false);
        }
      }
    };
    fetchWorkflow();
    return () => controller.abort();
  }, [id]);

  useEffect(() => {
    if (workflow?.status === 'completed') return;
    const controller = new AbortController();
    const fetchWorkflow = async () => {
      try {
        const res = await axios.get(`/api/workflows/${id}`, { signal: controller.signal });
        setWorkflow(res.data);
        setImages(res.data.images);
        setLoading(false);
      } catch (err: any) {
        if (!axios.isCancel(err)) {
          setError(err.response?.data?.error || 'Failed to load workflow');
          setLoading(false);
        }
      }
    };
    const interval = setInterval(fetchWorkflow, 3000);
    return () => {
      clearInterval(interval);
      controller.abort();
    };
  }, [id, workflow?.status]);

  const fetchWorkflow = async () => {
    try {
      const res = await axios.get(`/api/workflows/${id}`);
      setWorkflow(res.data);
      setImages(res.data.images);
      setLoading(false);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load workflow');
      setLoading(false);
    }
  };

  const updateStatus = async (status: WorkflowStatus) => {
    try {
      await axios.patch(`/api/workflows/${id}`, { status });
      fetchWorkflow();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update status');
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  if (!workflow) return <div className="p-8 text-center">Workflow not found</div>;

  const currentStageIndex = STAGES.findIndex(s => s.id === (workflow.status === 'completed' ? 'processing' : workflow.status));

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="h-14 bg-white border-b border-slate-200 px-8 flex items-center justify-between shadow-sm sticky top-16 z-40">
        <div className="flex items-center gap-4">
          <Link to="/">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-primary">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="h-6 w-px bg-slate-100" />
          <div>
            <h1 className="font-bold text-slate-900 tracking-tight text-sm">{workflow.name}</h1>
            <p className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">Workflow ID: {workflow.id.slice(0, 8)}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {STAGES.map((stage, idx) => {
            const Icon = stage.icon;
            const isActive = idx === currentStageIndex;
            const isPast = idx < currentStageIndex;
            return (
              <React.Fragment key={stage.id}>
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all ${isActive ? 'bg-primary text-white shadow-md shadow-blue-900/10' : isPast ? 'text-primary' : 'text-slate-300'}`}>
                  <Icon className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">{stage.label}</span>
                  {isPast && <CheckCircle2 className="w-3 h-3" />}
                </div>
                {idx < STAGES.length - 1 && <ChevronRight className="w-3 h-3 text-slate-200" />}
              </React.Fragment>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          {currentStageIndex > 0 && (
            <Button 
              variant="outline" 
              onClick={() => updateStatus(STAGES[currentStageIndex - 1]!.id)} 
              className="border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-xs px-6"
            >
              Back
            </Button>
          )}
          {workflow.status === 'ingest' && images.length > 0 && (
            <Button onClick={() => updateStatus('configure')} className="bg-primary hover:bg-primary/90 text-white font-bold uppercase tracking-wider text-xs px-6">
              Next: Configure
            </Button>
          )}
          {workflow.status === 'configure' && workflow.pipelineId && (
            <Button onClick={() => updateStatus('preview')} className="bg-primary hover:bg-primary/90 text-white font-bold uppercase tracking-wider text-xs px-6">
              Next: Preview
            </Button>
          )}
          {workflow.status === 'preview' && (
            <Button onClick={() => updateStatus('processing')} className="bg-primary hover:bg-primary/90 text-white font-bold uppercase tracking-wider text-xs px-6">
              Next: Output
            </Button>
          )}
          {workflow.status === 'completed' && (
             <Badge className="bg-emerald-500 text-white font-bold uppercase tracking-wider px-4 py-1">
               Completed
             </Badge>
          )}
        </div>
      </div>

      <main className="flex-1 p-8 overflow-auto">
        <div className="max-w-7xl mx-auto">
          {workflow.status === 'ingest' && <IngestStage workflowId={workflow.id} images={images} onRefresh={fetchWorkflow} />}
          {workflow.status === 'configure' && <ConfigureStage workflowId={workflow.id} onRefresh={fetchWorkflow} currentPipelineId={workflow.pipelineId} />}
          {workflow.status === 'preview' && <PreviewStage workflowId={workflow.id} images={images} onRefresh={fetchWorkflow} />}
          {(workflow.status === 'processing' || workflow.status === 'completed') && <OutputStage workflow={workflow} images={images} onRefresh={fetchWorkflow} />}
        </div>
      </main>

      {error && (
        <div className="fixed bottom-8 right-8 bg-red-500 text-white p-4 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-4">
          <AlertCircle className="w-5 h-5" />
          <p className="text-sm font-bold">{error}</p>
          <Button variant="ghost" size="icon" onClick={() => setError(null)} className="text-white hover:bg-white/10">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
