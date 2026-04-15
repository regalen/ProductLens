import * as React from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Layout as LayoutIcon, LogOut, Users, Image as ImageIcon, BarChart3, Puzzle, Network } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "../contexts/AuthContext";
import { Footer } from "./Footer";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface NavItemProps {
  label: string;
  icon: React.ReactNode;
  to?: string;
  isActive?: boolean;
  isComingSoon?: boolean;
  key?: string;
}

function NavItem({ label, icon, to, isActive, isComingSoon }: NavItemProps) {
  const content = (
    <div className={`flex items-center gap-2 px-4 h-10 rounded-md transition-all ${
      isActive 
        ? 'bg-primary/10 text-primary font-bold' 
        : isComingSoon 
          ? 'text-slate-300 cursor-not-allowed' 
          : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
    }`}>
      {icon}
      <span className="text-[11px] uppercase tracking-wider">{label}</span>
    </div>
  );

  if (isComingSoon || !to) {
    return (
      <Tooltip>
        <TooltipTrigger>
          {content}
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-[10px] font-bold">Coming Soon</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Link to={to}>
      {content}
    </Link>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const isAdmin = user?.role === 'admin';

  const navItems: NavItemProps[] = [
    { label: "Image Processing", icon: <ImageIcon className="w-4 h-4" />, to: "/", isActive: location.pathname === "/" || location.pathname.startsWith("/workflow") || location.pathname === "/pipelines" },
    { label: "Reporting", icon: <BarChart3 className="w-4 h-4" />, isComingSoon: true },
    { label: "Add Ons", icon: <Puzzle className="w-4 h-4" />, isComingSoon: true },
    { label: "Taxonomy Mapping", icon: <Network className="w-4 h-4" />, isComingSoon: true },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between shadow-sm sticky top-0 z-50">
        <div className="flex items-center gap-12">
          <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-lg shadow-primary/20">
              <LayoutIcon className="text-white w-5 h-5" />
            </div>
            <h1 className="font-semibold text-slate-900 tracking-tighter text-lg">ProductLens</h1>
          </Link>

          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => (
              <NavItem 
                key={item.label} 
                label={item.label}
                icon={item.icon}
                to={item.to}
                isActive={item.isActive}
                isComingSoon={item.isComingSoon}
              />
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-6">
          {isAdmin && (
            <Link to="/users">
              <Button variant="ghost" className={`text-slate-500 hover:text-primary gap-2 ${location.pathname === '/users' ? 'text-primary bg-primary/5' : ''}`}>
                <Users className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Users</span>
              </Button>
            </Link>
          )}
          
          <div className="h-8 w-px bg-slate-100 mx-2" />

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-slate-900 leading-none">{user?.displayName}</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mt-1">@{user?.username}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={logout} className="text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {children}
      </main>

      <Footer />
    </div>
  );
}
