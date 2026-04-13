import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, AlertTriangle } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  type?: 'danger' | 'info';
}

export default function Modal({ isOpen, onClose, title, children, footer, type = 'info' }: ModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-zinc-200"
          >
            <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/50 px-6 py-4">
              <div className="flex items-center gap-2">
                {type === 'danger' && <AlertTriangle size={18} className="text-red-500" />}
                <h3 className="text-base font-bold text-zinc-900">{title}</h3>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="px-6 py-6 text-sm text-zinc-600">
              {children}
            </div>

            {footer && (
              <div className="flex justify-end gap-3 border-t border-zinc-100 bg-zinc-50/50 px-6 py-4">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
