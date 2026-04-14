import * as React from "react";
import { Plus, Trash2, GripVertical, Settings2, Scissors, Maximize, RefreshCw, Palette, Type, Square, ArrowDownLeft, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PipelineStep, PipelineStepType } from "../types";
import { motion, Reorder } from "motion/react";

interface PipelineBuilderProps {
  steps: PipelineStep[];
  setSteps: (steps: PipelineStep[]) => void;
}

const STEP_ICONS: Record<PipelineStepType, React.ReactNode> = {
  resize_canvas: <Square className="w-4 h-4" />,
  crop_content: <Scissors className="w-4 h-4" />,
  convert: <RefreshCw className="w-4 h-4" />,
  scale_image: <ArrowDownLeft className="w-4 h-4" />,
  rename: <Tag className="w-4 h-4" />,
};

export function PipelineBuilder({ steps, setSteps }: PipelineBuilderProps) {
  const addStep = (type: PipelineStepType) => {
    const newStep: PipelineStep = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      ...(type === 'convert' && { format: 'jpeg', quality: 90 }),
      ...(type === 'crop_content' && { cropMode: 'content', threshold: 10, padding: 0 }),
    };
    setSteps([...steps, newStep]);
  };

  const removeStep = (id: string) => {
    setSteps(steps.filter(s => s.id !== id));
  };

  const updateStep = (id: string, updates: Partial<PipelineStep>) => {
    setSteps(steps.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  return (
    <div className="h-full flex flex-col bg-white text-slate-900 shadow-sm overflow-hidden">
      <div className="border-b border-slate-100 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold uppercase tracking-wider text-slate-900">Pipeline</span>
        </div>
        <Badge variant="outline" className="font-bold text-[10px] border-slate-200 text-slate-500 bg-slate-50">
          {steps.length} STEPS
        </Badge>
      </div>
      
      <ScrollArea className="flex-1 min-h-0 px-4">
        <div className="py-4 space-y-4">
          <Reorder.Group axis="y" values={steps} onReorder={setSteps} className="space-y-3">
            {steps.map((step) => (
              <Reorder.Item
                key={step.id}
                value={step}
                className="group bg-slate-50 border border-slate-200 rounded-lg p-3 hover:border-slate-300 transition-colors shadow-sm"
              >
                <div className="flex items-center gap-3 mb-3">
                  <GripVertical className="w-4 h-4 text-slate-400 cursor-grab active:cursor-grabbing" />
                  <div className="p-1.5 bg-white border border-slate-200 rounded text-primary shadow-sm">
                    {STEP_ICONS[step.type]}
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider flex-1 text-slate-700">
                    {step.type.replace('_', ' ')}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-slate-400 hover:text-red-500 hover:bg-red-50"
                    onClick={() => removeStep(step.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>

                <div className="space-y-3 pl-7">
                  {step.type === 'resize_canvas' && (
                    <p className="text-[10px] text-slate-500 font-semibold leading-relaxed">Squares the image by expanding the canvas to the longest edge. Centers content on a solid white background.</p>
                  )}

                  {step.type === 'crop_content' && (
                    <div className="space-y-4">
                      <div className="flex flex-wrap gap-2">
                        {(['content', 'aspect_ratio', 'manual'] as const).map((mode) => (
                          <Button
                            key={mode}
                            variant={step.cropMode === mode ? 'default' : 'outline'}
                            size="sm"
                            className="h-7 text-[9px] font-bold uppercase tracking-wider px-3"
                            onClick={() => updateStep(step.id, { cropMode: mode })}
                          >
                            {mode.replace('_', ' ')}
                          </Button>
                        ))}
                      </div>

                      {step.cropMode === 'content' && (
                        <div className="space-y-3">
                          <p className="text-[10px] text-slate-500 font-semibold leading-relaxed">Crops image to content (removes surrounding background).</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <div className="flex justify-between items-center">
                                <label className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Threshold</label>
                                <span className="text-[10px] font-bold text-primary">{step.threshold || 10}%</span>
                              </div>
                              <Slider
                                value={[step.threshold || 10]}
                                onValueChange={(vals) => updateStep(step.id, { threshold: Array.isArray(vals) ? vals[0] : vals })}
                                max={100}
                                step={1}
                                className="py-2"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Padding (px)</label>
                              <Input
                                type="number"
                                value={step.padding || ''}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value);
                                  updateStep(step.id, { padding: isNaN(val) ? 0 : val });
                                }}
                                className="h-8 bg-white border-slate-200 text-slate-900 text-xs focus-visible:ring-primary/50"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {step.cropMode === 'aspect_ratio' && (
                        <div className="space-y-3">
                          <p className="text-[10px] text-slate-500 font-semibold leading-relaxed">Crops to a specific aspect ratio (centered).</p>
                          <div className="space-y-1.5">
                            <label className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Ratio (e.g. 1:1, 16:9)</label>
                            <Input
                              placeholder="1:1"
                              value={step.aspectRatio || ''}
                              onChange={(e) => updateStep(step.id, { aspectRatio: e.target.value })}
                              className="h-8 bg-white border-slate-200 text-slate-900 text-xs focus-visible:ring-primary/50"
                            />
                          </div>
                        </div>
                      )}

                      {step.cropMode === 'manual' && (
                        <div className="space-y-3">
                          <p className="text-[10px] text-slate-500 font-semibold leading-relaxed">Manually specify crop boundaries (pixels).</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <label className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Left</label>
                              <Input
                                type="number"
                                value={step.manualRect?.left || ''}
                                onChange={(e) => updateStep(step.id, { manualRect: { ...step.manualRect, left: parseInt(e.target.value) || 0, top: step.manualRect?.top || 0, width: step.manualRect?.width || 0, height: step.manualRect?.height || 0 } })}
                                className="h-8 bg-white border-slate-200 text-slate-900 text-xs"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Top</label>
                              <Input
                                type="number"
                                value={step.manualRect?.top || ''}
                                onChange={(e) => updateStep(step.id, { manualRect: { ...step.manualRect, top: parseInt(e.target.value) || 0, left: step.manualRect?.left || 0, width: step.manualRect?.width || 0, height: step.manualRect?.height || 0 } })}
                                className="h-8 bg-white border-slate-200 text-slate-900 text-xs"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Width</label>
                              <Input
                                type="number"
                                value={step.manualRect?.width || ''}
                                onChange={(e) => updateStep(step.id, { manualRect: { ...step.manualRect, width: parseInt(e.target.value) || 0, left: step.manualRect?.left || 0, top: step.manualRect?.top || 0, height: step.manualRect?.height || 0 } })}
                                className="h-8 bg-white border-slate-200 text-slate-900 text-xs"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Height</label>
                              <Input
                                type="number"
                                value={step.manualRect?.height || ''}
                                onChange={(e) => updateStep(step.id, { manualRect: { ...step.manualRect, height: parseInt(e.target.value) || 0, left: step.manualRect?.left || 0, top: step.manualRect?.top || 0, width: step.manualRect?.width || 0 } })}
                                className="h-8 bg-white border-slate-200 text-slate-900 text-xs"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {step.type === 'scale_image' && (
                    <p className="text-[10px] text-slate-500 font-semibold leading-relaxed">Scales square image to 500x500px. No upscaling.</p>
                  )}

                  {step.type === 'convert' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Format</label>
                        <select
                          value={step.format}
                          onChange={(e) => updateStep(step.id, { format: e.target.value as any })}
                          className="w-full h-8 bg-white border border-slate-200 text-xs rounded px-2 outline-none focus:border-primary shadow-sm"
                        >
                          <option value="jpeg">JPEG</option>
                          <option value="webp">WEBP</option>
                          <option value="png">PNG</option>
                          <option value="avif">AVIF</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Quality</label>
                        <Input
                          type="number"
                          value={step.quality || ''}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            updateStep(step.id, { quality: isNaN(val) ? 0 : val });
                          }}
                          className="h-8 bg-white border-slate-200 text-slate-900 text-xs focus-visible:ring-primary/50"
                        />
                      </div>
                    </div>
                  )}

                  {step.type === 'rename' && (
                    <div className="space-y-2">
                      <p className="text-[10px] text-slate-500 font-semibold leading-relaxed">
                        Bulk renames files using the workflow name as a prefix.
                      </p>
                      <div className="p-2 bg-blue-50 rounded border border-blue-100">
                        <p className="text-[9px] text-blue-700 font-bold uppercase tracking-wider">
                          Format: [Workflow_Name]-[Index]
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </Reorder.Item>
            ))}
          </Reorder.Group>
        </div>
      </ScrollArea>

      <div className="p-4 border-t border-slate-100 bg-slate-50/50">
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9 border-slate-200 bg-white hover:border-primary hover:text-primary text-[10px] font-bold uppercase tracking-wider shadow-sm transition-all"
            onClick={() => addStep('crop_content')}
          >
            <Scissors className="w-3 h-3 mr-2" />
            Crop
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 border-slate-200 bg-white hover:border-primary hover:text-primary text-[10px] font-bold uppercase tracking-wider shadow-sm transition-all"
            onClick={() => addStep('resize_canvas')}
          >
            <Square className="w-3 h-3 mr-2" />
            Canvas
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 border-slate-200 bg-white hover:border-primary hover:text-primary text-[10px] font-bold uppercase tracking-wider shadow-sm transition-all"
            onClick={() => addStep('scale_image')}
          >
            <ArrowDownLeft className="w-3 h-3 mr-2" />
            Scale
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 border-slate-200 bg-white hover:border-primary hover:text-primary text-[10px] font-bold uppercase tracking-wider shadow-sm transition-all"
            onClick={() => addStep('convert')}
          >
            <RefreshCw className="w-3 h-3 mr-2" />
            Convert
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 border-slate-200 bg-white hover:border-primary hover:text-primary text-[10px] font-bold uppercase tracking-wider shadow-sm transition-all"
            onClick={() => addStep('rename')}
          >
            <Tag className="w-3 h-3 mr-2" />
            Rename
          </Button>
        </div>
      </div>
    </div>
  );
}
