import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Save, ArrowLeft, Settings2, Loader2, AlertCircle, Edit2, Globe, Lock } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Pipeline, PipelineStep } from '../types';
import { PipelineBuilder } from '../components/PipelineBuilder';
import { useAuth } from '../contexts/AuthContext';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from '@/components/ui/dialog';

export function PipelineManager() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newSteps, setNewSteps] = useState<PipelineStep[]>([]);
  const [isShared, setIsShared] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { user } = useAuth();
  const navigate = useNavigate();

  const canManage = user?.role === 'admin' || user?.role === 'pipeline_editor';

  useEffect(() => {
    if (user && user.role === 'user') {
      navigate('/');
    }
    fetchPipelines();
  }, [user]);

  const fetchPipelines = async () => {
    try {
      const res = await axios.get('/api/pipelines');
      setPipelines(res.data);
    } catch (err: any) {
      console.error('Failed to fetch pipelines:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!newName || newSteps.length === 0) {
      setError('Please provide a name and at least one tool.');
      return;
    }
    
    setIsSaving(true);
    setError(null);
    try {
      if (editingId) {
        await axios.patch(`/api/pipelines/${editingId}`, { name: newName, steps: newSteps, isShared });
      } else {
        await axios.post('/api/pipelines', { name: newName, steps: newSteps, isShared });
      }
      setNewName('');
      setNewSteps([]);
      setIsShared(false);
      setIsCreating(false);
      setEditingId(null);
      fetchPipelines();
    } catch (err: any) {
      console.error('Failed to save pipeline:', err);
      setError(err.response?.data?.error || 'Failed to save pipeline. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (pipeline: Pipeline) => {
    setNewName(pipeline.name);
    setNewSteps(pipeline.steps);
    setIsShared(pipeline.isShared);
    setEditingId(pipeline.id);
    setIsCreating(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancel = () => {
    setIsCreating(false);
    setEditingId(null);
    setNewName('');
    setNewSteps([]);
    setIsShared(false);
    setError(null);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      await axios.delete(`/api/pipelines/${deleteId}`);
      setDeleteId(null);
      fetchPipelines();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete pipeline');
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="max-w-6xl mx-auto p-8 space-y-8">
        {!isCreating && (
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Saved Pipelines</h2>
              <p className="text-slate-500 text-sm">Reusable processing templates</p>
            </div>
            <Button 
              onClick={() => setIsCreating(true)}
              className="bg-primary hover:bg-primary/90 text-white font-bold uppercase tracking-wider px-8"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Template
            </Button>
          </div>
        )}

        {isCreating && (
          <Card className="p-8 bg-white border-slate-200 shadow-lg space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-6">
              <div className="space-y-1">
                <h3 className="font-bold text-slate-900">{editingId ? 'Edit Template' : 'New Template'}</h3>
                <p className="text-xs text-slate-400 uppercase tracking-widest">Configure steps and name your pipeline</p>
              </div>
              <div className="flex gap-3">
                <Button variant="ghost" onClick={handleCancel} className="text-slate-500 font-bold text-xs uppercase tracking-wider">
                  Cancel
                </Button>
                <Button 
                  onClick={handleSave} 
                  disabled={isSaving}
                  className="bg-primary hover:bg-primary/90 text-white font-bold uppercase tracking-wider px-8"
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  {isSaving ? 'Saving...' : editingId ? 'Update Template' : 'Save to Library'}
                </Button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-lg text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="space-y-4">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Template Name</label>
                  <Input 
                    placeholder="e.g., E-commerce Standard" 
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="bg-slate-50 border-slate-200 focus-visible:ring-primary/50 h-11"
                  />
                </div>
                <div className="flex items-center space-x-2 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <Checkbox 
                    id="shared" 
                    checked={isShared} 
                    onCheckedChange={(checked) => setIsShared(!!checked)}
                  />
                  <div className="grid gap-1.5 leading-none">
                    <label
                      htmlFor="shared"
                      className="text-sm font-bold text-slate-900 leading-none cursor-pointer flex items-center gap-2"
                    >
                      <Globe className="w-3.5 h-3.5 text-primary" />
                      Shared Template
                    </label>
                    <p className="text-[10px] text-slate-500 font-medium">
                      If enabled, all users will be able to view and use this pipeline.
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden h-[600px]">
                <PipelineBuilder steps={newSteps} setSteps={setNewSteps} />
              </div>
            </div>
          </Card>
        )}

        {!isCreating && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {pipelines.map((p) => (
              <Card key={p.id} className="p-6 bg-white border-slate-200 shadow-sm space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary">
                      <Settings2 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900">{p.name}</h3>
                        {p.isShared ? (
                          <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 text-[8px] font-bold uppercase tracking-wider px-1.5 py-0 h-4">
                            <Globe className="w-2.5 h-2.5 mr-1" />
                            Shared
                          </Badge>
                        ) : (
                          <Badge className="bg-slate-50 text-slate-500 border-slate-100 text-[8px] font-bold uppercase tracking-wider px-1.5 py-0 h-4">
                            <Lock className="w-2.5 h-2.5 mr-1" />
                            Private
                          </Badge>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 uppercase tracking-widest">
                        {p.steps.length} Steps • Created {new Date(p.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  {(p.userId === user?.id || user?.role === 'admin') && (
                    <div className="flex gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleEdit(p)}
                        className="text-slate-300 hover:text-primary hover:bg-primary/5"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => setDeleteId(p.id)}
                        className="text-slate-300 hover:text-red-500 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {p.steps.map((step, idx) => (
                    <Badge key={idx} variant="secondary" className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-slate-200">
                      {step.type.replace('_', ' ')}
                    </Badge>
                  ))}
                </div>
              </Card>
            ))}
            {pipelines.length === 0 && (
              <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-300 gap-4">
                <Settings2 className="w-16 h-16 opacity-10" />
                <p className="font-bold uppercase tracking-widest">No saved pipelines</p>
              </div>
            )}
          </div>
        )}
      </main>

      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Pipeline</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this pipeline? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Delete Pipeline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
