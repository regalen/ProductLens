import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Download,
  FileSpreadsheet,
  Archive,
  ExternalLink,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Play,
  RefreshCw,
  Share2,
  X,
  MinusCircle,
  Trash2
} from 'lucide-react';
import axios from 'axios';
import { WorkflowImage, IMAGE_TYPES, Workflow } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { Progress } from '@/components/ui/progress';

interface OutputStageProps {
  workflow: Workflow;
  images: WorkflowImage[];
  onRefresh: () => void;
}

export function OutputStage({ workflow, images, onRefresh }: OutputStageProps) {
  const workflowId = workflow.id;
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startFullProcess = async () => {
    setIsProcessing(true);
    setError(null);
    try {
      await axios.post(`/api/workflows/${workflowId}/process`);
      // API returns 202, we poll via onRefresh in the parent
      setIsProcessing(false);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to start processing');
      setIsProcessing(false);
    }
  };

  const handleTypeChange = async (imageId: string, type: string) => {
    await axios.patch(`/api/images/${imageId}`, { type });
    onRefresh();
  };

  const clearType = async (imageId: string) => {
    await axios.patch(`/api/images/${imageId}`, { type: null });
    onRefresh();
  };

  const deselectImage = async (imageId: string) => {
    await axios.patch(`/api/images/${imageId}`, { selected: false });
    onRefresh();
  };

  const handleRemoveImage = async (imageId: string) => {
    try {
      await axios.delete(`/api/images/${imageId}`);
      onRefresh();
    } catch (err: any) {
      console.error('Failed to remove image:', err);
    }
  };

  const selectedImages = images.filter(img => img.selected);
  const completedCount = selectedImages.filter(img => img.processedPath).length;
  const processingCount = selectedImages.filter(img => img.status === 'processing').length;
  const isAllDone = completedCount === selectedImages.length && selectedImages.length > 0;
  const labeledCount = selectedImages.filter(img => img.type).length;
  const allTypesAssigned = labeledCount === selectedImages.length && selectedImages.length > 0;
  const isPartiallyLabeled = labeledCount > 0 && labeledCount < selectedImages.length;
  const takenTypes = new Set(selectedImages.map(img => img.type).filter(Boolean) as string[]);

  const clearAllTypes = async () => {
    const toClear = selectedImages.filter(img => img.type);
    if (toClear.length === 0) return;
    await Promise.all(toClear.map(img => axios.patch(`/api/images/${img.id}`, { type: null })));
    onRefresh();
  };
  
  const progress = selectedImages.length > 0 ? (completedCount / selectedImages.length) * 100 : 0;
  const isActuallyProcessing = isProcessing || processingCount > 0;

  const downloadZip = () => {
    window.open(`/api/workflows/${workflowId}/export/zip`, '_blank');
  };

  const downloadXlsx = async () => {
    try {
      const response = await axios.get(`/api/workflows/${workflowId}/export/xlsx`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'export.xlsx');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError('All images must have a type assigned for XLSX export');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-6">
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-900">Final Output</h3>
            <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">
              {completedCount} of {selectedImages.length} images processed
            </p>
          </div>
          <div className="h-10 w-px bg-slate-100" />
          <div className="flex items-center gap-4">
             <div className="text-center">
               <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-1">Status</p>
               <Badge variant="secondary" className={`${isAllDone ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'} font-bold uppercase tracking-wider`}>
                 {isAllDone ? 'Completed' : 'Awaiting Process'}
               </Badge>
             </div>
          </div>
        </div>
        <div className="flex gap-3">
          {labeledCount > 0 && (
            <Button
              variant="ghost"
              onClick={clearAllTypes}
              className="text-red-400 hover:text-red-500 hover:bg-red-50 font-bold uppercase tracking-wider text-[10px] h-11 px-4"
            >
              <X className="w-3 h-3 mr-2" />
              Clear Labels
            </Button>
          )}
          {!isAllDone && (
            <Button
              onClick={startFullProcess}
              disabled={isActuallyProcessing || selectedImages.length === 0}
              className="bg-primary hover:bg-primary/90 text-white font-bold uppercase tracking-wider text-xs px-8 h-11 shadow-lg shadow-blue-900/10 relative overflow-hidden"
            >
              {isActuallyProcessing ? (
                <div className="flex items-center">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </div>
              ) : (
                <div className="flex items-center">
                  <Play className="w-4 h-4 mr-2 fill-current" />
                  Process Batch
                </div>
              )}
            </Button>
          )}
          {isAllDone && (
            <>
              <Button 
                onClick={downloadZip}
                className="bg-slate-900 hover:bg-black text-white font-bold uppercase tracking-wider text-xs px-6 h-11 shadow-lg shadow-slate-900/10"
              >
                <Download className="w-4 h-4 mr-2" />
                Download ZIP
              </Button>
              <div className="relative group">
                <Button 
                  onClick={downloadXlsx}
                  disabled={!allTypesAssigned}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold uppercase tracking-wider text-xs px-6 h-11 shadow-lg shadow-emerald-900/10 transition-all"
                >
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Export XLSX
                </Button>
                {!allTypesAssigned && (
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-48 p-2 bg-slate-900 text-white text-[10px] font-bold uppercase tracking-widest rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none text-center shadow-xl z-30">
                    Assign all image type labels to enable XLSX export
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-900" />
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {isPartiallyLabeled && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex items-center gap-3 text-red-600">
          <AlertCircle className="w-5 h-5" />
          <p className="text-xs font-bold uppercase tracking-wider">
            Assign a label to every image, or clear all labels.
          </p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex items-center gap-3 text-red-600">
          <AlertCircle className="w-5 h-5" />
          <p className="text-xs font-bold uppercase tracking-wider">{error}</p>
        </div>
      )}

      <AnimatePresence>
        {isActuallyProcessing && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="bg-white border border-primary/20 rounded-2xl p-6 shadow-xl shadow-blue-900/5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Processing Batch...</h4>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                    Applying pipeline steps to {selectedImages.length} images
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold text-primary">{Math.round(progress)}%</span>
              </div>
            </div>
            <Progress value={progress} className="h-2 bg-slate-100" />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 gap-4">
        {selectedImages.map((img) => {
          const targetFormat = workflow.pipeline?.steps.find(s => s.type === 'convert')?.format || 'jpg';
          const displayFormat = targetFormat.toUpperCase();
          const targetScale = workflow.pipeline?.steps.find(s => s.type === 'scale_image');
          const targetCanvas = workflow.pipeline?.steps.find(s => s.type === 'resize_canvas');
          const hasRename = workflow.pipeline?.steps.some(s => s.type === 'rename');
          const sanitizedWorkflowName = workflow.name.replace(/\s+/g, '_');
          const indexInBatch = selectedImages.findIndex(i => i.id === img.id);
          const intendedFilename = hasRename 
            ? `${sanitizedWorkflowName}-${indexInBatch + 1}.${targetFormat === 'jpeg' ? 'jpg' : targetFormat}` 
            : (img.originalUrl ? new URL(img.originalUrl).pathname.split('/').pop() : `Asset-${img.id.slice(0, 8)}`);
          
          let intendedDimensions = '---';
          if (targetScale) {
            intendedDimensions = '500 × 500';
          } else if (targetCanvas) {
            intendedDimensions = 'Square (Longest Edge)';
          }

          return (
            <Card key={img.id} className="p-6 bg-white border-slate-200 shadow-sm">
              <div className="flex flex-col md:flex-row gap-8">
                <div className="group w-full md:w-80 h-80 bg-slate-50 rounded-xl border border-slate-100 overflow-hidden relative flex items-center justify-center shrink-0">
                  {(img.processedPath || img.previewPath || img.localPath) ? (
                    <img
                      src={img.processedPath ? `/api/assets/${img.id}` : img.previewPath ? `/api/previews/${img.id}` : `/api/assets/${img.id}`}
                      className="w-full h-full object-contain p-4"
                      alt="Asset"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-2 text-slate-300">
                      {img.status === 'processing' ? <Loader2 className="w-6 h-6 animate-spin" /> : <Play className="w-6 h-6 opacity-20" />}
                      <p className="text-[8px] font-bold uppercase tracking-widest">Pending</p>
                    </div>
                  )}
                  {img.processedPath && (
                    <div className="absolute top-2 right-2 bg-emerald-500 text-white rounded-full p-1 shadow-sm">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  )}
                  {workflow.status !== 'completed' && (
                    <div className="absolute top-2 left-2 flex gap-1.5">
                      <Button
                        variant="secondary"
                        size="icon"
                        className="h-8 w-8 bg-white/90 backdrop-blur-sm border border-slate-200 text-slate-400 hover:text-amber-500 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => deselectImage(img.id)}
                        aria-label="Remove from batch"
                        title="Remove from batch"
                      >
                        <MinusCircle className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="secondary"
                        size="icon"
                        className="h-8 w-8 bg-white/90 backdrop-blur-sm border border-slate-200 text-slate-400 hover:text-red-500 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleRemoveImage(img.id)}
                        aria-label="Delete image"
                        title="Delete image"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
                
                <div className="flex-1 flex flex-col justify-between py-2">
                  <div className="space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Asset Identification</p>
                        <h4 className="font-bold text-slate-900 truncate max-w-md">
                          {img.processedPath ? img.processedPath.split('/').pop() : intendedFilename}
                        </h4>
                      </div>
                      <div className="w-full md:w-64 space-y-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Image Type Label</p>
                        <div className="flex items-center gap-2">
                          <Select
                            value={img.type || ""}
                            onValueChange={(val) => { if (val) handleTypeChange(img.id, val); }}
                          >
                            <SelectTrigger className="h-10 bg-slate-50 border-slate-200 text-xs font-bold text-slate-700 flex-1 min-w-0">
                              <SelectValue placeholder="Assign Type..." />
                            </SelectTrigger>
                            <SelectContent alignItemWithTrigger={false} className="max-h-60 w-auto min-w-[18rem]">
                              {IMAGE_TYPES.map((type) => (
                                <SelectItem
                                  key={type}
                                  value={type}
                                  disabled={takenTypes.has(type) && img.type !== type}
                                  className="text-xs font-bold uppercase tracking-wider pl-3 pr-10"
                                >
                                  {type}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {img.type && (
                            <button
                              type="button"
                              onClick={() => clearType(img.id)}
                              aria-label="Clear label"
                              title="Clear label"
                              className="h-10 w-8 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors shrink-0"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                      <div className="space-y-1">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Dimensions</p>
                        <p className="text-xs font-bold text-slate-700">
                          {img.processedPath ? `${img.width} × ${img.height}` : (
                            <span className="text-primary italic">Intended: {intendedDimensions}</span>
                          )}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Format</p>
                        <Badge variant="outline" className="bg-white text-[9px] font-bold uppercase border-slate-200">
                          {img.processedPath ? img.processedPath.split('.').pop()?.toUpperCase() : (
                            <span className="text-primary">Target: {displayFormat}</span>
                          )}
                        </Badge>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">File Size</p>
                        <p className="text-xs font-bold text-slate-700">
                          {img.processedPath ? `${(img.size! / 1024).toFixed(1)} KB` : (
                            <span className="text-slate-400 italic">Pending...</span>
                          )}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Status</p>
                        <div className="flex items-center gap-1.5">
                          <div className={`w-1.5 h-1.5 rounded-full ${img.processedPath ? 'bg-emerald-500' : img.status === 'processing' ? 'bg-amber-500 animate-pulse' : 'bg-slate-300'}`} />
                          <span className="text-[10px] font-bold uppercase text-slate-600">
                            {img.processedPath ? 'Completed' : img.status === 'processing' ? 'Processing' : 'Awaiting Final Pass'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-4">
                     <Button 
                       variant="outline" 
                       size="sm" 
                       className="h-9 text-[10px] font-bold uppercase tracking-widest border-slate-200 text-slate-600 hover:bg-slate-50 px-4"
                       onClick={() => {
                         const filename = img.processedPath?.split('/').pop();
                         window.open(filename ? `/images/${img.workflowId}/${filename}` : `/api/assets/${img.id}`, '_blank');
                       }}
                     >
                       <ExternalLink className="w-3.5 h-3.5 mr-2" />
                       View Full Image
                     </Button>
                     {img.processedPath ? (
                       <Button
                         variant="outline"
                         size="sm"
                         className="h-9 text-[10px] font-bold uppercase tracking-widest border-slate-200 text-slate-600 hover:bg-slate-50 px-4"
                         onClick={() => {
                           const filename = img.processedPath?.split('/').pop();
                           navigator.clipboard.writeText(`${window.location.origin}/images/${img.workflowId}/${filename}`);
                         }}
                       >
                         <Share2 className="w-3.5 h-3.5 mr-2" />
                         Copy Asset URL
                       </Button>
                     ) : (
                       <Tooltip>
                         <TooltipTrigger render={<span className="inline-block" />}>
                           <Button
                             variant="outline"
                             size="sm"
                             disabled
                             className="h-9 text-[10px] font-bold uppercase tracking-widest border-slate-200 text-slate-600 hover:bg-slate-50 px-4"
                           >
                             <Share2 className="w-3.5 h-3.5 mr-2" />
                             Copy Asset URL
                           </Button>
                         </TooltipTrigger>
                         <TooltipContent>Available after processing completes</TooltipContent>
                       </Tooltip>
                     )}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
