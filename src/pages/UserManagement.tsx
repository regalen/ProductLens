import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  Plus, 
  Trash2, 
  Edit2, 
  ArrowLeft, 
  Loader2, 
  AlertCircle,
  Shield,
  User as UserIcon,
  Settings2,
  Save,
  X,
  Clock,
  Folder,
  Image as ImageIcon
} from 'lucide-react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { User, UserRole } from '../types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    username: '',
    displayName: '',
    password: '',
    role: 'user' as UserRole
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await axios.get('/api/admin/users');
      setUsers(res.data);
      setLoading(false);
    } catch (err: any) {
      setError('Failed to load users');
      setLoading(false);
    }
  };

  const handleOpenDialog = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        username: user.username,
        displayName: user.displayName,
        password: '',
        role: user.role
      });
    } else {
      setEditingUser(null);
      setFormData({
        username: '',
        displayName: '',
        password: '',
        role: 'user'
      });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (editingUser) {
        await axios.patch(`/api/admin/users/${editingUser.id}`, formData);
      } else {
        await axios.post('/api/admin/users', formData);
      }
      setIsDialogOpen(false);
      fetchUsers();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save user');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      await axios.delete(`/api/admin/users/${id}`);
      fetchUsers();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete user');
    }
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'admin': return <Badge className="bg-red-500 text-white font-bold uppercase tracking-wider text-[8px]">Admin</Badge>;
      case 'pipeline_editor': return <Badge className="bg-blue-500 text-white font-bold uppercase tracking-wider text-[8px]">Editor</Badge>;
      default: return <Badge className="bg-slate-500 text-white font-bold uppercase tracking-wider text-[8px]">User</Badge>;
    }
  };

  const formatLastLogin = (iso?: string | null): string => {
    if (!iso) return 'Never';
    // SQLite CURRENT_TIMESTAMP returns naive UTC ("YYYY-MM-DD HH:MM:SS"); tag as UTC so JS parses correctly.
    const utc = iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z';
    const d = new Date(utc);
    if (isNaN(d.getTime())) return 'Unknown';
    return d.toLocaleString('en-AU', {
      timeZone: 'Australia/Sydney',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }) + ' AEST';
  };

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'admin': return <Shield className="w-4 h-4 text-red-500" />;
      case 'pipeline_editor': return <Settings2 className="w-4 h-4 text-blue-500" />;
      default: return <UserIcon className="w-4 h-4 text-slate-400" />;
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="bg-slate-50">
      <main className="max-w-6xl mx-auto p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">User Management</h2>
            <p className="text-slate-500 text-sm">Manage access and permissions</p>
          </div>
          <Button onClick={() => handleOpenDialog()} className="bg-primary hover:bg-primary/90 text-white font-bold uppercase tracking-wider text-xs px-6">
            <Plus className="w-4 h-4 mr-2" />
            Create User
          </Button>
        </div>
        {error && (
          <div className="mb-6 bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
            <AlertCircle className="w-4 h-4" />
            {error}
            <Button variant="ghost" size="icon" onClick={() => setError(null)} className="ml-auto h-6 w-6 text-red-400">
              <X className="w-3 h-3" />
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {users.map((u) => (
            <Card key={u.id} className="p-6 bg-white border-slate-200 hover:border-primary/50 transition-all shadow-sm relative group overflow-hidden">
              <div className="absolute top-0 right-0 p-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(u)} className="h-8 w-8 text-slate-400 hover:text-primary">
                  <Edit2 className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(u.id)} className="h-8 w-8 text-slate-400 hover:text-red-500">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
                  {getRoleIcon(u.role)}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">{u.displayName}</h3>
                  <p className="text-xs text-slate-400 font-medium">@{u.username}</p>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between pt-4 border-t border-slate-50">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Role</span>
                  {getRoleBadge(u.role)}
                </div>
                {u.mustChangePassword && (
                  <Badge variant="outline" className="text-amber-500 border-amber-200 text-[8px] font-bold uppercase tracking-wider">
                    Reset Required
                  </Badge>
                )}
              </div>

              <div className="mt-3 flex items-center gap-2 text-slate-400">
                <Clock className="w-3 h-3" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Last Login</span>
                <span className="text-[10px] font-medium text-slate-500 ml-auto tabular-nums">
                  {formatLastLogin(u.lastLoginAt)}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 pt-3 border-t border-slate-50">
                <div className="flex items-center gap-2 text-slate-400">
                  <Folder className="w-3 h-3" />
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold uppercase tracking-widest">Workflows</span>
                    <span className="text-sm font-bold text-slate-700 tabular-nums">
                      {(u.workflowsCreatedTotal ?? 0).toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <ImageIcon className="w-3 h-3" />
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold uppercase tracking-widest">Images</span>
                    <span className="text-sm font-bold text-slate-700 tabular-nums">
                      {(u.imagesProcessedTotal ?? 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </main>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Edit User' : 'Create New User'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Username</label>
              <Input
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                disabled={!!editingUser}
                className="bg-slate-50 border-slate-200"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Display Name</label>
              <Input
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                className="bg-slate-50 border-slate-200"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                {editingUser ? 'Reset Password (optional)' : 'Password'}
              </label>
              <Input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="bg-slate-50 border-slate-200"
                required={!editingUser}
              />
              {editingUser && <p className="text-[10px] text-slate-400 italic">Leave blank to keep current password</p>}
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Role</label>
              <Select 
                value={formData.role} 
                onValueChange={(v) => { if (v) setFormData({ ...formData, role: v as UserRole }); }}
              >
                <SelectTrigger className="w-full bg-slate-50 border-slate-200">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent className="w-auto">
                  <SelectItem value="user">User (Workflows only)</SelectItem>
                  <SelectItem value="pipeline_editor">Pipeline Editor (Workflows + Pipelines)</SelectItem>
                  <SelectItem value="admin">Administrator (Full Access)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving} className="bg-primary text-white font-bold uppercase tracking-wider">
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                {editingUser ? 'Save Changes' : 'Create User'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
