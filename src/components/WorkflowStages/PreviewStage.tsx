import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Play, CheckCircle2, XCircle, Eye, Info, Maximize2 } from 'lucide-react';
import axios from 'axios';
import { WorkflowImage } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';

interface PreviewStageProps {
  workflowId: string;
  images: WorkflowImage[];
  onRefresh: () => void;
}

export function PreviewStage({ workflowId, images, onRefresh }: PreviewStageProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [viewImage, setViewImage] = useState<WorkflowImage | null>(null);

  const startPreview = async () => {
    setIsProcessing(true);
    try {
      await axios.post(`/api/workflows/${workflowId}/preview`);
      // The API returns 202, we poll via onRefresh in the parent
    } catch (err: any) {
      console.error('Failed to start preview:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleSelection = async (id: string, current: boolean) => {
    await axios.patch(`/api/images/${id}`, { selected: !current });
    onRefresh();
  };

  const selectedCount = images.filter(img => img.selected).length;
  const completedCount = images.filter(img => img.previewPath).length;
  const isAllDone = completedCount === images.length && images.length > 0;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-6">
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-900">Preview Results</h3>
            <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">
              {selectedCount} of {images.length} images selected for final output
            </p>
          </div>
          <div className="h-10 w-px bg-slate-100" />
          <div className="flex items-center gap-4">
             <div className="text-center">
               <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-1">Status</p>
               <Badge variant="secondary" className={`${isAllDone ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'} font-bold uppercase tracking-wider`}>
                 {isAllDone ? 'Ready' : 'Pending Preview'}
               </Badge>
             </div>
          </div>
        </div>
        <div className="flex gap-3">
          <Button 
            onClick={startPreview} 
            disabled={isProcessing}
            className="bg-primary hover:bg-primary/90 text-white font-bold uppercase tracking-wider text-xs px-8 h-11 shadow-lg shadow-blue-900/10"
          >
            {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2 fill-current" />}
            Run Preview
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-8">
        {images.map((img) => (
          <motion.div
            key={img.id}
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <Card 
              className={`group aspect-square bg-white border-2 overflow-hidden relative transition-all ${img.selected ? 'border-primary shadow-md' : 'border-slate-100 opacity-60 grayscale'}`}
            >
              <div 
                className="w-full h-full cursor-pointer"
                onClick={() => toggleSelection(img.id, img.selected)}
              >
                {img.previewPath ? (
                  <img 
                    src={`/api/previews/${img.id}`} 
                    className="w-full h-full object-contain p-4"
                    alt="Preview"
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-300">
                    {img.status === 'processing' ? <Loader2 className="w-8 h-8 animate-spin" /> : <Eye className="w-8 h-8 opacity-20" />}
                    <p className="text-[10px] font-bold uppercase tracking-widest">Awaiting Preview</p>
                  </div>
                )}
              </div>
              
              <div className="absolute top-3 right-3 flex gap-2">
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-8 w-8 bg-white/90 backdrop-blur-sm border border-slate-200 text-slate-600 hover:text-primary shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    setViewImage(img);
                  }}
                >
                  <Maximize2 className="w-4 h-4" />
                </Button>
                {img.selected ? (
                  <div className="bg-primary text-white rounded-full p-1 shadow-sm">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                ) : (
                  <div className="bg-slate-200 text-slate-400 rounded-full p-1">
                    <XCircle className="w-5 h-5" />
                  </div>
                )}
              </div>

              {img.previewPath && img.previewWidth && img.previewHeight && (
                <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-md px-2 py-0.5 text-[10px] font-bold text-slate-600 shadow-sm tabular-nums group-hover:opacity-0 transition-opacity">
                  {img.previewWidth} &times; {img.previewHeight}
                </div>
              )}

              <div className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm p-3 border-t border-slate-100 transform translate-y-full group-hover:translate-y-0 transition-transform">
                <p className="text-[10px] font-bold text-slate-600 uppercase truncate">
                  {img.originalUrl ? new URL(img.originalUrl).pathname.split('/').pop() : 'Uploaded Image'}
                </p>
                {img.previewWidth && img.previewHeight && (
                  <p className="text-[10px] font-medium text-slate-500 tabular-nums mt-0.5">
                    {img.previewWidth} &times; {img.previewHeight} px
                  </p>
                )}
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      <Dialog open={!!viewImage} onOpenChange={(open) => !open && setViewImage(null)}>
        <DialogContent className="sm:max-w-3xl aspect-square flex flex-col p-0 overflow-hidden bg-slate-200 border-slate-300 rounded-3xl shadow-2xl">
          <DialogHeader className="p-4 bg-white/80 backdrop-blur-md border-b border-slate-200">
            <DialogTitle className="text-slate-900 text-xs font-bold uppercase tracking-widest">
              Full Size Preview
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto p-12 flex items-center justify-center">
            {viewImage && (
              <img 
                src={`/api/previews/${viewImage.id}`} 
                className="max-w-full max-h-full object-contain"
                alt="Full Size"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700 leading-relaxed">
          <span className="font-bold uppercase tracking-wider mr-2">Pro Tip:</span>
          Click on an image card to deselect it from the final batch. Deselected images will not be processed at full resolution or included in the final exports.
        </p>
      </div>
    </div>
  );
}
