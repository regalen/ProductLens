import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Link, useNavigate } from 'react-router-dom';
import { LogIn, UserPlus, Loader2 } from 'lucide-react';
import { Footer } from '../components/Footer';

export function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login(username, password);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <div className="flex-1 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 space-y-6 bg-white shadow-xl border-slate-200">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mx-auto mb-4">
            <LogIn className="text-white w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Welcome Back</h1>
          <p className="text-slate-500 text-sm">Sign in to your Ingram Micro Asset Portal</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Username</label>
            <Input 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="bg-white border-slate-200"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Password</label>
            <Input 
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-white border-slate-200"
              required
            />
          </div>
          {error && <p className="text-red-500 text-xs font-bold">{error}</p>}
          <Button type="submit" disabled={submitting} className="w-full bg-primary hover:bg-primary/90 text-white font-bold uppercase tracking-wider h-11">
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Signing In...
              </span>
            ) : 'Sign In'}
          </Button>
        </form>
      </Card>
      </div>
      <Footer />
    </div>
  );
}
