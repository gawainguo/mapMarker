import { useMemo, useState } from 'react';
import { type Mark } from '../lib/db';
import Modal from './Modal';
import { 
  ChevronRight, 
  ChevronDown, 
  Download, 
  Upload, 
  Trash2, 
  Edit3, 
  Search,
  MapPin,
  X,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SidebarProps {
  marks: Mark[];
  onUpdateMark: (mark: Mark) => void;
  onClearAll: () => void;
  onImport: (marks: Mark[]) => void;
  onClose: () => void;
  importProgress: { current: number; total: number } | null;
}

export default function Sidebar({ marks, onUpdateMark, onClearAll, onImport, onClose, importProgress }: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedProvinces, setExpandedProvinces] = useState<Set<string>>(new Set());
  const [expandedCities, setExpandedCities] = useState<Set<string>>(new Set());

  // Modal States
  const [editMark, setEditMark] = useState<Mark | null>(null);
  const [editCount, setEditCount] = useState('');
  const [deleteMark, setDeleteMark] = useState<Mark | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isFixModalOpen, setIsFixModalOpen] = useState(false);

  // Grouping logic
  const groupedMarks = useMemo(() => {
    const provinces: Record<string, { cities: Record<string, Mark[]>, totalCount: number }> = {};
    
    marks.forEach(mark => {
      const matchesSearch = mark.name.includes(searchQuery) || 
                           mark.province.includes(searchQuery) || 
                           mark.city.includes(searchQuery);
      
      if (!matchesSearch) return;

      if (!provinces[mark.province]) {
        provinces[mark.province] = { cities: {}, totalCount: 0 };
      }
      if (!provinces[mark.province].cities[mark.city]) {
        provinces[mark.province].cities[mark.city] = [];
      }
      provinces[mark.province].cities[mark.city].push(mark);
      provinces[mark.province].totalCount++;
    });

    return provinces;
  }, [marks, searchQuery]);

  const provinceEntries = useMemo(() => 
    Object.entries(groupedMarks) as [string, { cities: Record<string, Mark[]>, totalCount: number }][], 
    [groupedMarks]
  );

  const toggleProvince = (province: string) => {
    const next = new Set(expandedProvinces);
    if (next.has(province)) next.delete(province);
    else next.add(province);
    setExpandedProvinces(next);
  };

  const toggleCity = (cityKey: string) => {
    const next = new Set(expandedCities);
    if (next.has(cityKey)) next.delete(cityKey);
    else next.add(cityKey);
    setExpandedCities(next);
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(marks, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = `map_marks_${new Date().toISOString().split('T')[0]}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const handleImportClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event: any) => {
        try {
          const imported = JSON.parse(event.target.result);
          if (Array.isArray(imported)) {
            onImport(imported);
          } else {
            setErrorMsg('导入失败：JSON 格式不正确，应为数组。');
          }
        } catch (err) {
          setErrorMsg('导入失败：无效的 JSON 文件');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleEditConfirm = () => {
    if (editMark) {
      const newCount = parseInt(editCount, 10);
      if (!isNaN(newCount)) {
        onUpdateMark({ ...editMark, count: newCount });
      }
      setEditMark(null);
    }
  };

  const handleDeleteConfirm = () => {
    if (deleteMark) {
      onUpdateMark({ ...deleteMark, count: 0 });
      setDeleteMark(null);
    }
  };

  const handleFixConfirm = () => {
    import('../lib/db').then(db => db.initDB().then(d => d.clear('boundaries'))).then(() => window.location.reload());
  };

  return (
    <div className="flex h-full flex-col bg-white shadow-2xl ring-1 ring-zinc-200">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-5">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-900">标注列表</h2>
          <p className="text-xs font-medium text-zinc-500">共标注 {marks.length} 个行政区</p>
        </div>
        <button onClick={onClose} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-50 md:hidden">
          <X size={20} />
        </button>
      </div>

      {/* Global Actions */}
      <div className="grid grid-cols-3 gap-2 border-b border-zinc-100 p-4">
        <button
          onClick={handleImportClick}
          className="flex flex-col items-center justify-center gap-1.5 rounded-xl bg-zinc-50 py-3 text-zinc-600 transition-all hover:bg-zinc-100 active:scale-95"
        >
          <Upload size={18} />
          <span className="text-[10px] font-bold uppercase tracking-wider">导入</span>
        </button>
        <button
          onClick={handleExport}
          className="flex flex-col items-center justify-center gap-1.5 rounded-xl bg-zinc-50 py-3 text-zinc-600 transition-all hover:bg-zinc-100 active:scale-95"
        >
          <Download size={18} />
          <span className="text-[10px] font-bold uppercase tracking-wider">导出</span>
        </button>
        <button
          onClick={onClearAll}
          className="flex flex-col items-center justify-center gap-1.5 rounded-xl bg-red-50 py-3 text-red-600 transition-all hover:bg-red-100 active:scale-95"
        >
          <Trash2 size={18} />
          <span className="text-[10px] font-bold uppercase tracking-wider">清空</span>
        </button>
      </div>

      {/* Boundary Cache Clear */}
      <div className="px-4 pb-2">
        <button 
          onClick={() => setIsFixModalOpen(true)}
          className="text-[10px] text-zinc-400 hover:text-zinc-600 underline"
        >
          修复渲染错误 (清空边界缓存)
        </button>
      </div>

      {/* Import Progress Bar */}
      <AnimatePresence>
        {importProgress && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-zinc-100 bg-emerald-50/50 px-4 py-3"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">正在导入数据...</span>
              <span className="text-[10px] font-bold text-emerald-700">
                {Math.round((importProgress.current / importProgress.total) * 100)}%
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-emerald-100">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                className="h-full bg-emerald-500"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search */}
      <div className="px-4 py-3">
        <div className="relative">
          <Search className="absolute top-1/2 left-3 -translate-y-1/2 text-zinc-400" size={16} />
          <input
            type="text"
            placeholder="搜索已标注区域..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl bg-zinc-100 py-2.5 pr-4 pl-10 text-sm outline-none ring-emerald-500/20 transition-all focus:bg-white focus:ring-4"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-2 pb-6">
        {provinceEntries.map(([province, data]) => (
          <div key={province} className="mb-1">
            <button
              onClick={() => toggleProvince(province)}
              className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-zinc-50"
            >
              <div className="flex items-center gap-2">
                {expandedProvinces.has(province) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <span className="font-bold text-zinc-800">{province}</span>
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-500">
                  {data.totalCount}
                </span>
              </div>
            </button>

            <AnimatePresence>
              {expandedProvinces.has(province) && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="ml-4 overflow-hidden border-l border-zinc-100"
                >
                  {(Object.entries(data.cities) as [string, Mark[]][]).map(([city, cityMarks]) => {
                    const cityKey = `${province}-${city}`;
                    return (
                      <div key={city}>
                        <button
                          onClick={() => toggleCity(cityKey)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-zinc-600 hover:text-zinc-900"
                        >
                          {expandedCities.has(cityKey) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          {city}
                        </button>

                        <AnimatePresence>
                          {expandedCities.has(cityKey) && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="ml-4 overflow-hidden"
                            >
                              {cityMarks.map(mark => (
                                <div
                                  key={mark.adcode}
                                  className="group flex items-center justify-between rounded-lg px-3 py-2 transition-colors hover:bg-zinc-50"
                                >
                                  <div className="flex items-center gap-2">
                                    <MapPin size={12} className="text-zinc-400" />
                                    <span className="text-sm text-zinc-700">{mark.name}</span>
                                    <span className={cn(
                                      "rounded-md px-1.5 py-0.5 text-[10px] font-black uppercase",
                                      mark.count >= 3 ? "bg-emerald-100 text-emerald-700" :
                                      mark.count === 2 ? "bg-emerald-50 text-emerald-600" :
                                      "bg-zinc-100 text-zinc-500"
                                    )}>
                                      {mark.count}次
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                    <button
                                      onClick={() => {
                                        setEditMark(mark);
                                        setEditCount(mark.count.toString());
                                      }}
                                      className="rounded p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-600"
                                    >
                                      <Edit3 size={14} />
                                    </button>
                                    <button
                                      onClick={() => setDeleteMark(mark)}
                                      className="rounded p-1 text-zinc-400 hover:bg-red-100 hover:text-red-600"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}

        {marks.length === 0 && (
          <div className="mt-20 flex flex-col items-center justify-center px-6 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-50">
              <MapPin size={32} className="text-zinc-200" />
            </div>
            <p className="text-sm font-medium text-zinc-500">暂无标注区域</p>
            <p className="mt-1 text-xs text-zinc-400">点击地图区域开始标注</p>
          </div>
        )}
      </div>

      {/* Modals */}
      <Modal
        isOpen={!!editMark}
        onClose={() => setEditMark(null)}
        title="修改标注次数"
        footer={
          <>
            <button onClick={() => setEditMark(null)} className="rounded-xl bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-200">取消</button>
            <button onClick={handleEditConfirm} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-emerald-200 hover:bg-emerald-700">保存</button>
          </>
        }
      >
        <div className="space-y-4">
          <p>修改 <span className="font-bold text-zinc-900">{editMark?.name}</span> 的标注次数：</p>
          <input
            type="number"
            value={editCount}
            onChange={(e) => setEditCount(e.target.value)}
            className="w-full rounded-xl bg-zinc-100 px-4 py-3 text-lg font-bold outline-none ring-emerald-500/20 focus:bg-white focus:ring-4"
            autoFocus
          />
        </div>
      </Modal>

      <Modal
        isOpen={!!deleteMark}
        onClose={() => setDeleteMark(null)}
        title="删除标注"
        type="danger"
        footer={
          <>
            <button onClick={() => setDeleteMark(null)} className="rounded-xl bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-200">取消</button>
            <button onClick={handleDeleteConfirm} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-red-200 hover:bg-red-700">确认删除</button>
          </>
        }
      >
        确定要删除 <span className="font-bold text-zinc-900">{deleteMark?.name}</span> 的标注吗？
      </Modal>

      <Modal
        isOpen={isFixModalOpen}
        onClose={() => setIsFixModalOpen(false)}
        title="清空边界缓存"
        type="danger"
        footer={
          <>
            <button onClick={() => setIsFixModalOpen(false)} className="rounded-xl bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-200">取消</button>
            <button onClick={handleFixConfirm} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-red-200 hover:bg-red-700">确认清空并刷新</button>
          </>
        }
      >
        确定要清空地图边界缓存吗？这可能会解决渲染错误，但会重新请求 API。
      </Modal>

      <Modal
        isOpen={!!errorMsg}
        onClose={() => setErrorMsg(null)}
        title="提示"
        footer={
          <button onClick={() => setErrorMsg(null)} className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800">确定</button>
        }
      >
        <div className="flex items-center gap-3 text-red-600">
          <AlertCircle size={20} />
          <p>{errorMsg}</p>
        </div>
      </Modal>
    </div>
  );
}
