import { useEffect, useRef, useState } from 'react';
import { type Mark } from '../lib/db';
import { getDistrictInfoByLngLat, fetchDistrictBoundary } from '../lib/amap';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Minus, X } from 'lucide-react';

interface MapViewProps {
  marks: Mark[];
  onUpdateMark: (mark: Mark) => void;
}

interface PopupInfo {
  adcode: string;
  name: string;
  province: string;
  city: string;
  lnglat: [number, number];
  count: number;
}

export default function MapView({ marks, onUpdateMark }: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const amapInstance = useRef<any>(null);
  const polygonsRef = useRef<Map<string, any>>(new Map());
  const marksRef = useRef<Mark[]>(marks);
  const [popupInfo, setPopupInfo] = useState<PopupInfo | null>(null);

  // Keep marksRef in sync
  useEffect(() => {
    marksRef.current = marks;
  }, [marks]);

  // Initialize Map
  useEffect(() => {
    if (!mapRef.current || amapInstance.current) return;

    const map = new (window as any).AMap.Map(mapRef.current, {
      zoom: 4,
      center: [108.948024, 34.263161], // Center of China
      viewMode: '2D',
    });

    amapInstance.current = map;

    map.on('click', async (e: any) => {
      try {
        const info = await getDistrictInfoByLngLat(e.lnglat);
        // Use marksRef to avoid stale closure
        const existingMark = marksRef.current.find(m => m.adcode === info.adcode);
        setPopupInfo({
          ...info,
          lnglat: [e.lnglat.lng, e.lnglat.lat],
          count: existingMark ? existingMark.count : 0,
        });
      } catch (err) {
        console.error('Click info fetch failed:', err);
      }
    });

    return () => {
      if (amapInstance.current) {
        amapInstance.current.destroy();
        amapInstance.current = null;
      }
    };
  }, []);

  // Update Polygons when marks change
  useEffect(() => {
    if (!amapInstance.current) return;

    const updatePolygons = async () => {
      const currentAdcodes = new Set(marks.map(m => m.adcode));

      // Remove polygons that are no longer marked
      polygonsRef.current.forEach((polygon, adcode) => {
        if (!currentAdcodes.has(adcode)) {
          if (amapInstance.current) {
            amapInstance.current.remove(polygon);
          }
          polygonsRef.current.delete(adcode);
        }
      });

      if (marks.length === 0) return;
      for (const mark of marks) {
        const color = getFillColor(mark.count);
        const existingPolygon = polygonsRef.current.get(mark.adcode);

        if (existingPolygon) {
          existingPolygon.setOptions({
            fillColor: color,
          });
        } else {
          try {
            const boundaries = await fetchDistrictBoundary(mark.adcode);
            if (boundaries && boundaries.length > 0) {
              const polygon = new (window as any).AMap.Polygon({
                path: boundaries,
                fillColor: color,
                fillOpacity: 0.4, // Reduced from 0.7 to not cover map labels
                strokeColor: '#fff',
                strokeWeight: 1,
                bubble: true,
              });
              amapInstance.current.add(polygon);
              polygonsRef.current.set(mark.adcode, polygon);
            }
          } catch (err) {
            console.error(`Failed to draw boundary for ${mark.adcode}:`, err);
          }
        }
      }
    };

    updatePolygons();
  }, [marks]);

  const getFillColor = (count: number) => {
    if (count >= 3) return '#059669'; // Dark Green (emerald-600)
    if (count === 2) return '#10b981'; // Medium Green (emerald-500)
    if (count === 1) return '#6ee7b7'; // Light Green (emerald-300)
    return 'transparent';
  };

  const handleAdjustCount = (delta: number) => {
    if (!popupInfo) return;
    const newCount = Math.max(0, popupInfo.count + delta);
    onUpdateMark({
      adcode: popupInfo.adcode,
      name: popupInfo.name,
      province: popupInfo.province,
      city: popupInfo.city,
      count: newCount,
    });
    setPopupInfo(null);
  };

  return (
    <div className="relative h-full w-full">
      <div ref={mapRef} className="h-full w-full" />

      {/* Custom Popup */}
      <AnimatePresence>
        {popupInfo && (
          <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-black/5 backdrop-blur-[1px]">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="pointer-events-auto w-72 overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-zinc-200"
            >
              <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/50 px-4 py-3">
                <h3 className="text-sm font-semibold text-zinc-900">区域标注</h3>
                <button
                  onClick={() => setPopupInfo(null)}
                  className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-5">
                <div className="mb-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">行政区名称</p>
                  <p className="mt-1 text-lg font-bold text-zinc-900">{popupInfo.name}</p>
                  <p className="text-xs text-zinc-500">
                    {popupInfo.province} · {popupInfo.city}
                  </p>
                </div>

                <div className="mb-6">
                  <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">当前标注次数</p>
                  <p className="mt-1 text-2xl font-black text-emerald-600">{popupInfo.count} 次</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleAdjustCount(-1)}
                    disabled={popupInfo.count === 0}
                    className="flex items-center justify-center gap-2 rounded-xl bg-zinc-100 py-2.5 text-sm font-semibold text-zinc-700 transition-all hover:bg-zinc-200 disabled:opacity-50"
                  >
                    <Minus size={16} />
                    取消标注
                  </button>
                  <button
                    onClick={() => handleAdjustCount(1)}
                    className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-200 transition-all hover:bg-emerald-700 active:scale-95"
                  >
                    <Plus size={16} />
                    增加标注
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
