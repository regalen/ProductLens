import * as React from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, Image as ImageIcon } from "lucide-react";

export interface ScrapedImage {
  url: string;
  width: number;
  height: number;
  size?: string;
}

interface ScraperResultsProps {
  images: ScrapedImage[];
  onSelect: (url: string) => void;
  addedUrls?: string[];
}

export function ScraperResults({ images, onSelect, addedUrls = [] }: ScraperResultsProps) {
  const [minWidth, setMinWidth] = React.useState(200);
  const filtered = images.filter((img) => img.width >= minWidth);
  const countLabel = filtered.length === images.length
    ? `${images.length}`
    : `${filtered.length} of ${images.length}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Scanned Images ({countLabel})</h3>
        <div className="flex items-center gap-2">
          <label htmlFor="scraper-min-width" className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Min width</label>
          <div className="relative">
            <Input
              id="scraper-min-width"
              type="number"
              min={0}
              step={50}
              value={minWidth}
              onChange={(e) => setMinWidth(Math.max(0, Number(e.target.value) || 0))}
              className="h-8 w-24 pr-8 text-xs"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold uppercase tracking-wider pointer-events-none">px</span>
          </div>
        </div>
      </div>
      <ScrollArea className="h-[400px] border border-slate-200 rounded-xl bg-white p-4 shadow-sm">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((img, idx) => {
            const isAdded = addedUrls.includes(img.url);
            return (
              <div
                key={img.url + idx}
                onClick={() => !isAdded && onSelect(img.url)}
                className={`group relative aspect-square bg-slate-50 rounded-lg overflow-hidden border transition-all ${isAdded ? 'border-emerald-200 opacity-75 cursor-default' : 'border-slate-200 hover:border-primary/50 cursor-pointer'}`}
              >
                <img
                  src={img.url}
                  alt={`Scraped ${idx}`}
                  className="w-full h-full object-contain p-2"
                  referrerPolicy="no-referrer"
                />

                <div className="absolute bottom-1.5 left-1.5 bg-black/60 text-white text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded pointer-events-none">
                  {img.width} × {img.height}
                </div>

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
          {filtered.length === 0 && (
            <div className="col-span-full h-40 flex flex-col items-center justify-center text-slate-300 gap-2">
              <ImageIcon className="w-8 h-8 opacity-20" />
              <p className="text-xs font-bold uppercase tracking-wider">
                {images.length === 0 ? 'No images found' : 'No images match the filter'}
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
