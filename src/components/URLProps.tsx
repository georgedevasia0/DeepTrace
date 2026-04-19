import React, { useState } from 'react';
import { Endpoint } from '../constants/message_types';
import { highlightSearchQuery } from '../utils/defaultview_utils';
import { MODAL_NAMES, CSS_CLASSES, ClassificationType, ClassificationMapping} from '../constants/defaultview_contants';
import { Modal } from './modals/modal';
import { ViewCodeModal } from './modals/viewcode';
import { SeeResponseModal } from './modals/seeResponse';


interface URLPropsProps {
  endpoint: Endpoint;
  searchQuery: string;
  selectedCategories: Record<string, boolean>;
  isSelected: boolean;
  onToggleSelect: (endpoint: Endpoint) => void;
  isLight?: boolean;
}

export function URLProps({ endpoint, searchQuery, selectedCategories, isSelected, onToggleSelect, isLight = false }: URLPropsProps) {
  const [openModal, setOpenModal] = useState<keyof typeof MODAL_NAMES | null>(null);

  const closeModal = () => setOpenModal(null);

  const renderModalContent = () => {
    switch (openModal) {
      case MODAL_NAMES.viewCode:
        return <ViewCodeModal endpoint={endpoint} onClose={closeModal} />;
      case MODAL_NAMES.seeResponse:
        return <SeeResponseModal endpoint={endpoint} onClose={closeModal} />;
      default:
        return null;
    }
  };

  const getVisibleClassifications = (): ClassificationType[] => {
    if (!endpoint.classifications) return [];

    return Object.entries(endpoint.classifications)
      .filter(([_, value]) => value === true)
      .map(([key]) => ClassificationMapping[key])
      .filter((category): category is ClassificationType => 
        category !== undefined && selectedCategories[category]
      );
  };

  const sanitizedSourceLabel = endpoint.foundAt === endpoint.webpage ? 'Main document' : 'JavaScript asset';

  return (
    <tr className={`transition-all duration-200 ${isSelected ? (isLight ? 'bg-[#eaf6fb]/80' : 'bg-[#193847]/70') : 'bg-transparent'}`}>
      <td className="px-4 py-3 md:px-6 md:py-4">
        <div className={`rounded-[24px] border p-4 shadow-[0_16px_60px_rgba(0,0,0,0.12)] transition-all duration-200 ${isLight ? 'border-[#d6e4ed] bg-[linear-gradient(180deg,#ffffff,#f6fbff)] hover:border-[#8fc9da]' : 'border-[#29424d] bg-[linear-gradient(180deg,rgba(24,37,44,0.96),rgba(17,26,31,0.96))] hover:border-[#4a7e8d] hover:shadow-[0_18px_70px_rgba(10,19,24,0.38)]'}`}>
          <div className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(endpoint)}
            className="mt-1 h-4 w-4 cursor-pointer accent-[#316E7D]"
            aria-label={`Select endpoint ${endpoint.url}`}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${isLight ? 'border-[#cfe0ea] bg-[#f0f8fc] text-[#2d7b96]' : 'border-[#325260] bg-[#11242d] text-[#7fb8cb]'}`}>
                Endpoint
              </span>
              <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${isLight ? 'border-[#ead9c8] bg-[#fff6ed] text-[#b97836]' : 'border-[#4d3d2c] bg-[#2a2017] text-[#e7a46f]'}`}>
                {sanitizedSourceLabel}
              </span>
            </div>
            <div className={`mt-3 break-words font-mono text-sm leading-7 md:text-[15px] ${isLight ? 'text-slate-900' : 'text-white'}`}>
              {highlightSearchQuery(endpoint.url, searchQuery)}
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {getVisibleClassifications().map(category => (
                <span key={category} className={`${CSS_CLASSES[category]} border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]`}>
                  {category.replace(/_/g, ' ')}
                </span>
              ))}
            </div>

            <div className={`mt-4 grid gap-3 text-sm md:grid-cols-2 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
              <div className={`rounded-2xl border px-3 py-3 ${isLight ? 'border-[#d9e6ee] bg-[#f8fbfd]' : 'border-[#2b4049] bg-[#0f1d23]/90'}`}>
                <div className="text-[11px] uppercase tracking-[0.22em] text-[#7eaabc]">Source</div>
                <div className={`mt-2 break-words text-[13px] leading-6 ${isLight ? 'text-slate-900' : 'text-white'}`}>{endpoint.foundAt}</div>
              </div>
              <div className={`rounded-2xl border px-3 py-3 ${isLight ? 'border-[#d9e6ee] bg-[#f8fbfd]' : 'border-[#2b4049] bg-[#0f1d23]/90'}`}>
                <div className="text-[11px] uppercase tracking-[0.22em] text-[#7eaabc]">Webpage</div>
                <div className={`mt-2 break-words text-[13px] leading-6 ${isLight ? 'text-slate-900' : 'text-white'}`}>{endpoint.webpage}</div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button className={`i-button border px-3 py-2 ${isLight ? 'border-[#cfe0ea] bg-[#f1f8fc]' : 'border-[#285767] bg-[#132630]'}`} onClick={() => setOpenModal(MODAL_NAMES.viewCode)}>
                <svg className="cursor-pointer hover:opacity-80" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                  <path fill="#3da28f" d="m8 18l-6-6l6-6l1.425 1.425l-4.6 4.6L9.4 16.6zm8 0l-1.425-1.425l4.6-4.6L14.6 7.4L16 6l6 6z"/>
                  <title>View Code Snippet</title>
                </svg>
              </button>
              <button className={`i-button border px-3 py-2 ${isLight ? 'border-[#cfe0ea] bg-[#f1f8fc]' : 'border-[#285767] bg-[#132630]'}`} onClick={() => setOpenModal(MODAL_NAMES.seeResponse)}>
                <svg className="cursor-pointer hover:opacity-80" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                  <path fill="#3da28f" d="M20 4H6c-1.103 0-2 .897-2 2v5h2V8l6.4 4.8a1 1 0 0 0 1.2 0L20 8v9h-8v2h8c1.103 0 2-.897 2-2V6c0-1.103-.897-2-2-2m-7 6.75L6.666 6h12.668z"/>
                  <path fill="#3da28f" d="M2 12h7v2H2zm2 3h6v2H4zm3 3h4v2H7z"/>
                  <title>See Request/Response</title>
                </svg>
              </button>
            </div>
            <Modal isOpen={openModal !== null} onClose={closeModal}>
              {renderModalContent()}
            </Modal>
          </div>
        </div>
        </div>
      </td>
      <td className="hidden"></td>
      <td className="hidden"></td>
    </tr>
  );
}
