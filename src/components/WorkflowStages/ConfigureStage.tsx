import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Settings2, Check, Layout, Sparkles, Loader2 } from 'lucide-react';
import axios from 'axios';
import { Pipeline, PipelineStep } from '../../types';
import { PipelineBuilder } from '../PipelineBuilder';

import { useAuth } from '../../contexts/AuthContext';

interface ConfigureStageProps {
  workflowId: string;
  onRefresh: () => void;
  currentPipelineId?: string;
}

export function ConfigureStage({ workflowId, onRefresh, currentPipelineId }: ConfigureStageProps) {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [customSteps, setCustomSteps] = useState<PipelineStep[]>([]);
  const [isCustom, setIsCustom] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const canCreateCustom = user?.role === 'admin' || user?.role === 'pipeline_editor';

  useEffect(() => {
    fetchPipelines();
  }, []);

  const fetchPipelines = async () => {
    try {
      const res = await axios.get('/api/pipelines');
      setPipelines(res.data);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPipeline = async (id: string) => {
    try {
      await axios.patch(`/api/workflows/${workflowId}`, { pipeline_id: id });
      onRefresh();
    } catch (err: any) {
      console.error('Failed to select pipeline:', err);
    }
  };

  const handleCreateOneTime = async () => {
    try {
      // For one-time, we save it as a "One-time" pipeline and assign it
      const res = await axios.post('/api/pipelines', { name: `One-time (${workflowId.slice(0,4)})`, steps: customSteps });
      await handleSelectPipeline(res.data.id);
    } catch (err: any) {
      console.error('Failed to create one-time pipeline:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="space-y-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Saved Templates</h3>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest">Select a pre-configured pipeline</p>
          </div>

          <div className="space-y-3">
            {pipelines.map((p) => (
              <Card 
                key={p.id} 
                onClick={() => handleSelectPipeline(p.id)}
                className={`p-4 cursor-pointer transition-all border-2 ${currentPipelineId === p.id ? 'border-primary bg-primary/5 shadow-md' : 'border-slate-200 bg-white hover:border-slate-300'}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${currentPipelineId === p.id ? 'bg-primary text-white' : 'bg-slate-50 text-slate-400'}`}>
                      <Settings2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{p.name}</h4>
                      <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">{p.steps.length} Steps</p>
                    </div>
                  </div>
                  {currentPipelineId === p.id && <Check className="w-4 h-4 text-primary" />}
                </div>
              </Card>
            ))}
            {canCreateCustom && (
              <Card 
                onClick={() => setIsCustom(true)}
                className={`p-4 cursor-pointer transition-all border-2 border-dashed ${isCustom ? 'border-primary bg-primary/5' : 'border-slate-200 bg-white hover:border-slate-300'}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${isCustom ? 'bg-primary text-white' : 'bg-slate-50 text-slate-400'}`}>
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Custom Pipeline</h4>
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Configure one-time steps</p>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          {isCustom ? (
            <Card className="bg-white border-slate-200 shadow-lg overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <Layout className="w-5 h-5 text-primary" />
                  <h3 className="font-bold text-slate-900">Configure Custom Pipeline</h3>
                </div>
                <Button 
                  onClick={handleCreateOneTime}
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
          ) : currentPipelineId ? (
            <Card className="p-12 bg-white border-slate-200 shadow-sm flex flex-col items-center justify-center text-center space-y-6">
              <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center">
                <Check className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900">Pipeline Selected</h3>
                <p className="text-slate-500 text-sm mt-1">You are ready to preview the results with the selected template.</p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {pipelines.find(p => p.id === currentPipelineId)?.steps.map((step, idx) => (
                  <Badge key={idx} variant="secondary" className="bg-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-600 px-3 py-1">
                    {step.type.replace('_', ' ')}
                  </Badge>
                ))}
              </div>
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
