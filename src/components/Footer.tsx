import * as React from "react";
import { Github, Bug } from "lucide-react";

const REPO_URL = "https://github.com/regalen/ProductLens";
const ISSUES_URL = "https://github.com/regalen/ProductLens/issues";

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white px-8 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        <span className="normal-case">
          <span className="text-slate-500 tracking-tight">ProductLens</span>{' '}
          <span className="text-slate-500">v{__APP_VERSION__}</span>
        </span>
        <nav className="flex items-center gap-5">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 hover:text-primary transition-colors"
          >
            <Github className="w-3 h-3" />
            GitHub
          </a>
          <a
            href={ISSUES_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 hover:text-primary transition-colors"
          >
            <Bug className="w-3 h-3" />
            Report an Issue
          </a>
        </nav>
      </div>
    </footer>
  );
}
