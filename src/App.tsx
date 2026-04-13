/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState, useCallback } from 'react';
import { getMarks, saveMark, clearMarks, saveMarksBatch, type Mark } from './lib/db';
import { loadAMap, subscribeToDiagnostics, type DiagnosticInfo } from './lib/amap';
import MapView from './components/MapView';
import Sidebar from './components/Sidebar';
import Modal from './components/Modal';
import { Menu, X, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [marks, setMarks] = useState<Mark[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);
  const [diagnostics, setDiagnostics] = useState<DiagnosticInfo[]>([]);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        await loadAMap();
        const initialMarks = await getMarks();
        setMarks(initialMarks);
        setIsLoaded(true);
      } catch (error) {
        console.error('Initialization failed:', error);
      }
    };
    init();

    const unsubscribe = subscribeToDiagnostics(setDiagnostics);
    return () => unsubscribe();
  }, []);

  const handleUpdateMark = useCallback(async (mark: Mark) => {
    // Optimistic update
    setMarks(prev => {
      const index = prev.findIndex(m => m.adcode === mark.adcode);
      if (mark.count <= 0) {
        return prev.filter(m => m.adcode !== mark.adcode);
      }
      if (index > -1) {
        const next = [...prev];
        next[index] = mark;
        return next;
      }
      return [...prev, mark];
    });

    // Save to DB in background
    try {
      await saveMark(mark);
    } catch (error) {
      console.error('Failed to save mark:', error);
      // Revert if needed, but usually IndexedDB is reliable
    }
  }, []);

  const handleClearAll = async () => {
    try {
      await clearMarks();
      setMarks([]);
      setIsClearModalOpen(false);
      console.log('Marks cleared successfully');
    } catch (error) {
      console.error('Failed to clear marks:', error);
    }
  };

  const handleImport = useCallback(async (newMarks: Mark[]) => {
    setImportProgress({ current: 0, total: newMarks.length });
    
    // Batch save to DB first
    await saveMarksBatch(newMarks);
    setMarks(newMarks);

    // Simulate/Track progress if needed, but saveMarksBatch is fast.
    // The real "progress" is the map rendering which happens via fetchDistrictBoundary.
    setImportProgress(null);
  }, []);

  if (!isLoaded) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-50 font-sans">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-zinc-200 border-t-emerald-500" />
          <p className="text-sm font-medium text-zinc-500">正在加载地图资源...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-zinc-50 font-sans text-zinc-900">
      {/* Sidebar Toggle Button (Mobile/Small Screens) */}
      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="absolute top-4 left-4 z-50 flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-lg ring-1 ring-zinc-200 transition-all hover:bg-zinc-50 active:scale-95 md:hidden"
      >
        {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Diagnostics Toggle Button */}
      <button
        onClick={() => setShowDiagnostics(!showDiagnostics)}
        className="absolute top-4 right-4 z-50 flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-lg ring-1 ring-zinc-200 transition-all hover:bg-zinc-50 active:scale-95"
        title="渲染诊断"
      >
        <Activity size={20} className={diagnostics.some(d => d.status === 'pending') ? 'animate-pulse text-emerald-500' : 'text-zinc-600'} />
      </button>

      {/* Sidebar */}
      <AnimatePresence mode="wait">
        {isSidebarOpen && (
          <motion.div
            initial={{ x: -320 }}
            animate={{ x: 0 }}
            exit={{ x: -320 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="absolute inset-y-0 left-0 z-40 w-80 md:relative"
          >
            <Sidebar
              marks={marks}
              onUpdateMark={handleUpdateMark}
              onClearAll={() => setIsClearModalOpen(true)}
              onImport={handleImport}
              onClose={() => setIsSidebarOpen(false)}
              importProgress={importProgress}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <Modal
        isOpen={isClearModalOpen}
        onClose={() => setIsClearModalOpen(false)}
        title="清空所有标注"
        type="danger"
        footer={
          <>
            <button
              onClick={() => setIsClearModalOpen(false)}
              className="rounded-xl bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-200"
            >
              取消
            </button>
            <button
              onClick={handleClearAll}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-red-200 hover:bg-red-700"
            >
              确认清空
            </button>
          </>
        }
      >
        确定要清空所有标注数据吗？此操作不可恢复。
      </Modal>

      {/* Main Map Area */}
      <main className="relative flex-1 overflow-hidden">
        {!isSidebarOpen && (
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="absolute top-4 left-4 z-30 hidden h-10 w-10 items-center justify-center rounded-xl bg-white shadow-lg ring-1 ring-zinc-200 transition-all hover:bg-zinc-50 active:scale-95 md:flex"
          >
            <Menu size={20} />
          </button>
        )}
        <MapView marks={marks} onUpdateMark={handleUpdateMark} />

        {/* Diagnostics Panel */}
        <AnimatePresence>
          {showDiagnostics && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="absolute right-4 bottom-4 z-50 w-80 max-h-[60vh] overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-zinc-200"
            >
              <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/50 px-4 py-3">
                <h3 className="text-sm font-bold text-zinc-900">渲染诊断 (最近100条)</h3>
                <button onClick={() => setShowDiagnostics(false)} className="text-zinc-400 hover:text-zinc-600">
                  <X size={16} />
                </button>
              </div>
              <div className="overflow-y-auto p-2 space-y-1 max-h-[calc(60vh-45px)]">
                {diagnostics.length === 0 ? (
                  <p className="py-8 text-center text-xs text-zinc-400">暂无请求记录</p>
                ) : (
                  [...diagnostics]
                    .sort((a, b) => {
                      // Priority: error (0) > pending (1) > success (2)
                      const priority = { error: 0, pending: 1, success: 2 };
                      if (priority[a.status] !== priority[b.status]) {
                        return priority[a.status] - priority[b.status];
                      }
                      // Within same status, show most recent first
                      return b.timestamp - a.timestamp;
                    })
                    .map((d) => (
                      <div key={`${d.adcode}-${d.timestamp}`} className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 text-[11px]">
                        <div className="flex flex-col">
                          <span className="font-bold text-zinc-700">{d.adcode}</span>
                          {d.message && <span className="text-[10px] text-zinc-400">{d.message}</span>}
                        </div>
                        <span className={cn(
                          "rounded-full px-2 py-0.5 font-bold uppercase tracking-tighter",
                          d.status === 'success' ? "bg-emerald-100 text-emerald-700" :
                          d.status === 'error' ? "bg-red-100 text-red-700" :
                          "bg-amber-100 text-amber-700 animate-pulse"
                        )}>
                          {d.status}
                        </span>
                      </div>
                    ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
