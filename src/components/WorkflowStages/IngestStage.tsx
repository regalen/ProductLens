import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, Link as LinkIcon, Search, Loader2, Trash2, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import axios from 'axios';
import { WorkflowImage } from '../../types';
import { ScraperResults } from '../ScraperResults';

interface IngestStageProps {
  workflowId: string;
  images: WorkflowImage[];
  onRefresh: () => void;
}

export function IngestStage({ workflowId, images, onRefresh }: IngestStageProps) {
  const [urlList, setUrlList] = useState('');
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [scrapedImages, setScrapedImages] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const formData = new FormData();
    Array.from(e.target.files).forEach((file: File) => formData.append('files', file));
    setIsProcessing(true);
    setError(null);
    try {
      await axios.post(`/api/workflows/${workflowId}/upload`, formData);
      onRefresh();
    } catch (err: any) {
      console.error('Upload failed:', err);
      setError(err.response?.data?.error || 'Upload failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUrlSubmit = async () => {
    const urls = urlList.split('\n').map(u => u.trim()).filter(u => u);
    if (urls.length === 0) return;
    setIsProcessing(true);
    setError(null);
    try {
      await axios.post(`/api/workflows/${workflowId}/urls`, { urls });
      setUrlList('');
      onRefresh();
    } catch (err: any) {
      console.error('URL fetch failed:', err);
      setError(err.response?.data?.error || 'URL fetch failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleScrapeSubmit = async () => {
    if (!scrapeUrl) return;
    setIsProcessing(true);
    setError(null);
    try {
      const res = await axios.post('/api/scrape', { url: scrapeUrl });
      setScrapedImages(res.data.images);
      if (res.data.images.length === 0) {
        setError('No suitable images found on this page.');
      }
    } catch (err: any) {
      console.error('Scrape failed:', err);
      setError(err.response?.data?.error || 'Scrape failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSelectScraped = async (url: string) => {
    setIsProcessing(true);
    try {
      await axios.post(`/api/workflows/${workflowId}/urls`, { urls: [url] });
      onRefresh();
    } catch (err: any) {
      console.error('Scraped image selection failed:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemoveImage = async (id: string) => {
    try {
      await axios.delete(`/api/images/${id}`);
      onRefresh();
    } catch (err: any) {
      console.error('Failed to remove image:', err);
    }
  };

  const handleResetStep = async () => {
    // In an iframe, window.confirm might be blocked.
    // For now we'll proceed directly to fix the "doesn't work" issue.
    try {
      await axios.delete(`/api/workflows/${workflowId}/reset`);
      onRefresh();
    } catch (err: any) {
      console.error('Failed to reset step:', err);
      setError('Failed to reset step');
    }
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-1 p-6 bg-white border-slate-200 shadow-sm space-y-6">
          <div className="space-y-1">
            <h3 className="font-bold text-slate-900">Add Images</h3>
            <p className="text-xs text-slate-400 uppercase tracking-widest">Mix and match ingest methods</p>
          </div>

          <Tabs defaultValue="upload" className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-slate-50 p-1">
              <TabsTrigger value="upload" className="text-[10px] font-bold uppercase tracking-wider">Upload</TabsTrigger>
              <TabsTrigger value="urls" className="text-[10px] font-bold uppercase tracking-wider">URLs</TabsTrigger>
              <TabsTrigger value="scrape" className="text-[10px] font-bold uppercase tracking-wider">Scrape</TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="mt-4 space-y-4">
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:border-primary/50 transition-colors relative group">
                <input
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  aria-label="Upload image files"
                  accept="image/jpeg,image/png,image/webp,image/avif,image/tiff,image/gif"
                />
                <Upload className="w-8 h-8 text-slate-300 mx-auto mb-3 group-hover:text-primary transition-colors" />
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Drop files or click</p>
              </div>
            </TabsContent>

            <TabsContent value="urls" className="mt-4 space-y-4">
              <textarea 
                value={urlList}
                onChange={(e) => setUrlList(e.target.value)}
                placeholder="Paste one URL per line..."
                className="w-full h-32 bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs focus:outline-none focus:border-primary transition-colors"
              />
              <Button onClick={handleUrlSubmit} disabled={isProcessing} className="w-full bg-primary hover:bg-primary/90 text-white font-bold uppercase tracking-wider text-xs h-10">
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Fetch URLs'}
              </Button>
            </TabsContent>

            <TabsContent value="scrape" className="mt-4 space-y-4">
              <Input 
                value={scrapeUrl}
                onChange={(e) => setScrapeUrl(e.target.value)}
                placeholder="https://store.com/product"
                className="bg-slate-50 border-slate-200 text-xs"
              />
              <Button onClick={handleScrapeSubmit} disabled={isProcessing} className="w-full bg-primary hover:bg-primary/90 text-white font-bold uppercase tracking-wider text-xs h-10">
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Scan Page'}
              </Button>
            </TabsContent>
          </Tabs>

          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-lg text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <p>{error}</p>
            </div>
          )}
        </Card>

        <div className="lg:col-span-2 space-y-8">
          {scrapedImages && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-primary" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">Scraper Results</h3>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setScrapedImages(null)} className="text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-600">Close Results</Button>
              </div>
              <ScraperResults 
                images={scrapedImages.map(img => img.url)} 
                onSelect={handleSelectScraped} 
                addedUrls={images.map(img => img.originalUrl).filter(Boolean) as string[]}
              />
              <div className="h-px bg-slate-100" />
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">Ingested Assets ({images.length})</h3>
              </div>
              {images.length > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleResetStep}
                  className="text-[10px] font-bold uppercase tracking-wider text-red-400 hover:text-red-500 hover:bg-red-50"
                >
                  <RefreshCw className="w-3 h-3 mr-2" />
                  Reset Step
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {images.map((img) => (
                <Card key={img.id} className="aspect-square bg-white border-slate-200 overflow-hidden relative group shadow-sm hover:shadow-md transition-all">
                  {img.status === 'pending' && (
                    <div className="absolute inset-0 bg-slate-50/80 backdrop-blur-[1px] flex items-center justify-center z-10">
                      <Loader2 className="w-5 h-5 text-primary animate-spin" />
                    </div>
                  )}
                  {img.status === 'failed' && (
                    <div className="absolute inset-0 bg-red-50 flex flex-col items-center justify-center p-2 text-center z-10">
                      <AlertCircle className="w-5 h-5 text-red-400 mb-1" />
                      <p className="text-[8px] text-red-500 font-bold uppercase line-clamp-2">{img.errorMessage}</p>
                    </div>
                  )}
                  {img.localPath && (
                    <img 
                      src={`/api/assets/${img.id}`} 
                      className="w-full h-full object-contain p-2"
                      alt="Ingested"
                    />
                  )}
                  <div className="absolute top-2 right-2 flex gap-1 z-20">
                     {img.status === 'completed' ? (
                       <CheckCircle2 className="w-4 h-4 text-emerald-500 fill-white" />
                     ) : img.status === 'failed' ? (
                       <AlertCircle className="w-4 h-4 text-red-500 fill-white" />
                     ) : null}
                     <Button
                       variant="ghost"
                       size="icon"
                       className="h-6 w-6 bg-white/90 backdrop-blur-sm border border-slate-200 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                       onClick={() => handleRemoveImage(img.id)}
                     >
                       <Trash2 className="w-3 h-3" />
                     </Button>
                  </div>
                </Card>
              ))}
              {images.length === 0 && (
                <div className="col-span-full py-20 border-2 border-dashed border-slate-100 rounded-2xl flex flex-col items-center justify-center text-slate-200 gap-2">
                  <Upload className="w-12 h-12 opacity-20" />
                  <p className="text-[10px] font-bold uppercase tracking-widest">No images ingested yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
