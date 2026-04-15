import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Settings2, Check, Layout, Sparkles, Loader2, Globe, Lock } from 'lucide-react';
import axios from 'axios';
import { Pipeline, PipelineStep } from '../../types';
import { PipelineBuilder } from '../PipelineBuilder';

interface ConfigureStageProps {
  workflowId: string;
  onRefresh: () => void;
  currentPipelineId?: string;
  currentInlineSteps?: PipelineStep[] | null;
}

export function ConfigureStage({
  workflowId,
  onRefresh,
  currentPipelineId,
  currentInlineSteps,
}: ConfigureStageProps) {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [customSteps, setCustomSteps] = useState<PipelineStep[]>([]);
  const [isCustom, setIsCustom] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPipelines();
  }, []);

  // If the workflow already has inline one-time steps, preload the builder with them
  // so editing a one-time pipeline stays editable after navigation.
  useEffect(() => {
    if (currentInlineSteps && currentInlineSteps.length > 0) {
      setCustomSteps(currentInlineSteps);
    }
  }, [currentInlineSteps]);

  const fetchPipelines = async () => {
    try {
      const res = await axios.get('/api/pipelines');
      setPipelines(res.data);
    } finally {
      setLoading(false);
    }
  };

  const { sharedPipelines, privatePipelines } = useMemo(() => {
    const shared: Pipeline[] = [];
    const priv: Pipeline[] = [];
    for (const p of pipelines) {
      (p.isShared ? shared : priv).push(p);
    }
    return { sharedPipelines: shared, privatePipelines: priv };
  }, [pipelines]);

  const hasInlineSteps = !!(currentInlineSteps && currentInlineSteps.length > 0);

  const handleSelectPipeline = async (id: string) => {
    try {
      setIsCustom(false);
      await axios.patch(`/api/workflows/${workflowId}`, { pipeline_id: id });
      onRefresh();
    } catch (err: any) {
      console.error('Failed to select pipeline:', err);
    }
  };

  const handleApplyOneTime = async () => {
    try {
      await axios.patch(`/api/workflows/${workflowId}`, { steps: customSteps });
      setIsCustom(false);
      onRefresh();
    } catch (err: any) {
      console.error('Failed to apply one-time pipeline:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  const selectedPipeline = currentPipelineId
    ? pipelines.find((p) => p.id === currentPipelineId)
    : undefined;

  const renderPipelineCard = (p: Pipeline) => (
    <Card
      key={p.id}
      onClick={() => handleSelectPipeline(p.id)}
      className={`p-4 cursor-pointer transition-all border-2 ${currentPipelineId === p.id ? 'border-primary bg-primary/5 shadow-md' : 'border-slate-200 bg-white hover:border-slate-300'}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`p-2 rounded-lg shrink-0 ${currentPipelineId === p.id ? 'bg-primary text-white' : 'bg-slate-50 text-slate-400'}`}>
            <Settings2 className="w-4 h-4" />
          </div>
          <div className="min-w-0 space-y-1">
            <h4 className="text-sm font-bold text-slate-900 truncate">{p.name}</h4>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">{p.steps.length} Steps</p>
            {p.description && (
              <p className="text-xs text-slate-500 leading-snug line-clamp-2 whitespace-pre-wrap">
                {p.description}
              </p>
            )}
          </div>
        </div>
        {currentPipelineId === p.id && <Check className="w-4 h-4 text-primary shrink-0 mt-2" />}
      </div>
    </Card>
  );

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="space-y-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Saved Templates</h3>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest">Select a pre-configured pipeline</p>
          </div>

          <Card className="p-4 bg-white border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Globe className="w-3.5 h-3.5 text-primary" />
              <h4 className="text-[11px] font-bold uppercase tracking-widest text-slate-600">Shared Templates</h4>
              <Badge className="bg-slate-50 text-slate-400 border-slate-100 text-[9px] font-bold uppercase px-1.5 py-0 h-4">
                {sharedPipelines.length}
              </Badge>
            </div>
            {sharedPipelines.length === 0 ? (
              <p className="text-[11px] text-slate-300 font-bold uppercase tracking-widest py-3 text-center">
                No shared templates
              </p>
            ) : (
              <div className="space-y-2">
                {sharedPipelines.map(renderPipelineCard)}
              </div>
            )}
          </Card>

          <Card className="p-4 bg-white border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Lock className="w-3.5 h-3.5 text-slate-500" />
              <h4 className="text-[11px] font-bold uppercase tracking-widest text-slate-600">My Private Templates</h4>
              <Badge className="bg-slate-50 text-slate-400 border-slate-100 text-[9px] font-bold uppercase px-1.5 py-0 h-4">
                {privatePipelines.length}
              </Badge>
            </div>
            {privatePipelines.length === 0 ? (
              <p className="text-[11px] text-slate-300 font-bold uppercase tracking-widest py-3 text-center">
                No private templates
              </p>
            ) : (
              <div className="space-y-2">
                {privatePipelines.map(renderPipelineCard)}
              </div>
            )}
          </Card>

          <Card
            onClick={() => setIsCustom(true)}
            className={`p-4 cursor-pointer transition-all border-2 border-dashed ${isCustom || (hasInlineSteps && !currentPipelineId) ? 'border-primary bg-primary/5' : 'border-slate-200 bg-white hover:border-slate-300'}`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${isCustom || (hasInlineSteps && !currentPipelineId) ? 'bg-primary text-white' : 'bg-slate-50 text-slate-400'}`}>
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">One-Time Pipeline</h4>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Single-use, not saved</p>
              </div>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2">
          {isCustom ? (
            <Card className="bg-white border-slate-200 shadow-lg overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <Layout className="w-5 h-5 text-primary" />
                  <h3 className="font-bold text-slate-900">Configure One-Time Pipeline</h3>
                </div>
                <Button
                  onClick={handleApplyOneTime}
                  disabled={customSteps.length === 0}
                  className="bg-primary hover:bg-primary/90 text-white font-bold uppercase tracking-wider text-xs px-8"
                >
                  Apply to Workflow
                </Button>
              </div>
              <div className="h-[600px]">
                <PipelineBuilder steps={customSteps} setSteps={setCustomSteps} />
              </div>
            </Card>
          ) : selectedPipeline ? (
            <Card className="p-12 bg-white border-slate-200 shadow-sm flex flex-col items-center justify-center text-center space-y-6">
              <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center">
                <Check className="w-8 h-8" />
              </div>
              <div className="space-y-2 max-w-lg">
                <h3 className="text-xl font-bold text-slate-900">{selectedPipeline.name}</h3>
                {selectedPipeline.description && (
                  <p className="text-sm text-slate-500 leading-relaxed whitespace-pre-wrap">
                    {selectedPipeline.description}
                  </p>
                )}
                <p className="text-slate-400 text-xs uppercase tracking-widest font-bold pt-1">
                  Ready to preview
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {selectedPipeline.steps.map((step, idx) => (
                  <Badge key={idx} variant="secondary" className="bg-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-600 px-3 py-1">
                    {step.type.replace('_', ' ')}
                  </Badge>
                ))}
              </div>
            </Card>
          ) : hasInlineSteps ? (
            <Card className="p-12 bg-white border-slate-200 shadow-sm flex flex-col items-center justify-center text-center space-y-6">
              <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center">
                <Sparkles className="w-8 h-8" />
              </div>
              <div className="space-y-2 max-w-lg">
                <h3 className="text-xl font-bold text-slate-900">One-Time Pipeline</h3>
                <p className="text-sm text-slate-500">
                  Single-use configuration applied to this workflow. Not saved to the template library.
                </p>
                <p className="text-slate-400 text-xs uppercase tracking-widest font-bold pt-1">
                  Ready to preview
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {currentInlineSteps!.map((step, idx) => (
                  <Badge key={idx} variant="secondary" className="bg-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-600 px-3 py-1">
                    {step.type.replace('_', ' ')}
                  </Badge>
                ))}
              </div>
              <Button
                variant="outline"
                onClick={() => setIsCustom(true)}
                className="text-xs font-bold uppercase tracking-wider"
              >
                Edit Steps
              </Button>
            </Card>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4 py-20">
              <Settings2 className="w-16 h-16 opacity-10" />
              <p className="font-bold uppercase tracking-widest">Select a pipeline to proceed</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
