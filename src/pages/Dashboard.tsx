import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Plus, Folder, Clock, ChevronRight, ChevronLeft, Layout, LogOut, Loader2, AlertCircle, Trash2, Edit2, Save, Users } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Workflow } from '../types';
import { useAuth } from '../contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const PAGE_SIZE = 12;

export function Dashboard() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [newWorkflowName, setNewWorkflowName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const [renamingWorkflow, setRenamingWorkflow] = useState<{ id: string, name: string } | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  const totalPages = Math.max(1, Math.ceil(workflows.length / PAGE_SIZE));
  const pagedWorkflows = workflows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const canManagePipelines = user?.role === 'admin' || user?.role === 'pipeline_editor';
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const fetchWorkflows = async () => {
    try {
      const res = await axios.get('/api/workflows');
      setWorkflows(res.data);
    } catch (err: any) {
      console.error('Failed to fetch workflows:', err);
    }
  };

  const handleCreateWorkflow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkflowName) {
      setError('Please provide a name for the workflow.');
      return;
    }
    
    setIsCreating(true);
    setError(null);
    try {
      const res = await axios.post('/api/workflows', { name: newWorkflowName });
      if (res.data?.id) {
        navigate(`/workflow/${res.data.id}`);
      } else {
        throw new Error('No ID returned from server');
      }
    } catch (err: any) {
      console.error('Failed to create workflow:', err);
      setError(err.response?.data?.error || 'Failed to create workflow. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteWorkflow = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await axios.delete(`/api/workflows/${id}`);
      fetchWorkflows();
    } catch (err: any) {
      console.error('Failed to delete workflow:', err);
      setError('Failed to delete workflow.');
    }
  };

  const handleRenameWorkflow = async (e: React.MouseEvent, id: string, currentName: string) => {
    e.preventDefault();
    e.stopPropagation();
    setRenamingWorkflow({ id, name: currentName });
    setRenameValue(currentName);
  };

  const submitRename = async () => {
    if (!renamingWorkflow || !renameValue || renameValue === renamingWorkflow.name) {
      setRenamingWorkflow(null);
      return;
    }
    setIsRenaming(true);
    try {
      await axios.patch(`/api/workflows/${renamingWorkflow.id}`, { name: renameValue });
      setRenamingWorkflow(null);
      fetchWorkflows();
    } catch (err: any) {
      console.error('Failed to rename workflow:', err);
      setError('Failed to rename workflow.');
    } finally {
      setIsRenaming(false);
    }
  };

  return (
    <div className="bg-slate-50">
      <main className="max-w-6xl mx-auto p-8 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Workflows</h2>
            <p className="text-slate-500 text-sm">Manage your batch processing jobs</p>
          </div>
          {canManagePipelines && (
            <Link to="/pipelines">
              <Button variant="outline" className="border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-bold text-xs uppercase tracking-wider">
                Manage Pipelines
              </Button>
            </Link>
          )}
        </div>

        <Card className="p-6 bg-white border-slate-200 shadow-sm space-y-4">
          <form onSubmit={handleCreateWorkflow} className="flex gap-4">
            <Input 
              placeholder="New workflow name (e.g. VPN, IM SKU, Product Line)" 
              value={newWorkflowName}
              onChange={(e) => setNewWorkflowName(e.target.value)}
              className="bg-slate-50 border-slate-200 focus-visible:ring-primary/50"
              disabled={isCreating}
            />
            <Button 
              type="submit" 
              disabled={isCreating}
              className="bg-primary hover:bg-primary/90 text-white font-bold uppercase tracking-wider px-8"
            >
              {isCreating ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              {isCreating ? 'Creating...' : 'New Job'}
            </Button>
          </form>
          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-lg text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pagedWorkflows.map((wf) => (
            <Link key={wf.id} to={`/workflow/${wf.id}`}>
              <Card className="group p-5 bg-white border-slate-200 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="flex flex-col h-full space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="p-2 bg-slate-50 rounded-lg text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                      <Folder className="w-5 h-5" />
                    </div>
                    <div className="flex gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-slate-300 hover:text-primary hover:bg-primary/5"
                        onClick={(e) => handleRenameWorkflow(e, wf.id, wf.name)}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-slate-300 hover:text-red-500 hover:bg-red-50"
                        onClick={(e) => handleDeleteWorkflow(e, wf.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 group-hover:text-primary transition-colors">{wf.name}</h3>
                    <div className="flex items-center gap-2 mt-1 text-slate-400">
                      <Clock className="w-3 h-3" />
                      <span className="text-[10px] uppercase font-bold tracking-widest">
                        {new Date(wf.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">View Details</span>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </div>
                </div>
              </Card>
            </Link>
          ))}
          {workflows.length === 0 && (
            <div className="col-span-full py-20 flex flex-col items-center justify-center text-slate-300 gap-4">
              <Folder className="w-16 h-16 opacity-10" />
              <p className="font-bold uppercase tracking-widest">No workflows found</p>
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="border-slate-200 bg-white text-slate-600 font-bold text-xs uppercase tracking-wider"
              >
                <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="border-slate-200 bg-white text-slate-600 font-bold text-xs uppercase tracking-wider"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </main>

      <Dialog open={!!renamingWorkflow} onOpenChange={(open) => !open && setRenamingWorkflow(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Rename Workflow</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">New Name</label>
              <Input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                className="bg-slate-50 border-slate-200 focus-visible:ring-primary/50"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && submitRename()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenamingWorkflow(null)} disabled={isRenaming}>
              Cancel
            </Button>
            <Button onClick={submitRename} disabled={isRenaming} className="bg-primary text-white">
              {isRenaming ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
