import * as React from "react";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Check, Image as ImageIcon } from "lucide-react";

interface ScraperResultsProps {
  images: string[];
  onSelect: (url: string) => void;
  addedUrls?: string[];
}

export function ScraperResults({ images, onSelect, addedUrls = [] }: ScraperResultsProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Scanned Images ({images.length})</h3>
      </div>
      <ScrollArea className="h-[400px] border border-slate-200 rounded-xl bg-white p-4 shadow-sm">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.map((img, idx) => {
            const isAdded = addedUrls.includes(img);
            return (
              <div 
                key={idx}
                onClick={() => !isAdded && onSelect(img)}
                className={`group relative aspect-square bg-slate-50 rounded-lg overflow-hidden border transition-all ${isAdded ? 'border-emerald-200 opacity-75 cursor-default' : 'border-slate-200 hover:border-primary/50 cursor-pointer'}`}
              >
                <img 
                  src={img} 
                  alt={`Scraped ${idx}`} 
                  className="w-full h-full object-contain p-2"
                  referrerPolicy="no-referrer"
                />
                
                {isAdded ? (
                  <div className="absolute inset-0 bg-emerald-50/20 flex items-center justify-center">
                    <div className="bg-emerald-500 text-white p-1.5 rounded-full shadow-lg">
                      <Check className="w-4 h-4" />
                    </div>
                  </div>
                ) : (
                  <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/10 transition-all flex items-center justify-center">
                    <div className="opacity-0 group-hover:opacity-100 transform scale-90 group-hover:scale-100 transition-all">
                      <Button size="sm" className="bg-primary hover:bg-primary/90 text-white font-bold text-[10px] uppercase tracking-wider shadow-md shadow-blue-900/10">
                        Select
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {images.length === 0 && (
            <div className="col-span-full h-40 flex flex-col items-center justify-center text-slate-300 gap-2">
              <ImageIcon className="w-8 h-8 opacity-20" />
              <p className="text-xs font-bold uppercase tracking-wider">No images found</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
