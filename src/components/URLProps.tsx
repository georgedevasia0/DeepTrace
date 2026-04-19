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
  const rowClass = isSelected
    ? (isLight ? 'bg-[#eaf6fb]/90' : 'bg-[#193847]/55')
    : (isLight ? 'bg-white/80' : 'bg-transparent');
  const cellClass = `!px-4 !py-4 align-top md:!px-5 ${isLight ? 'border-[#dce9f0]' : 'border-[#223740]'}`;
  const subtleTextClass = isLight ? 'text-slate-500' : 'text-slate-400';
  const mainTextClass = isLight ? 'text-slate-900' : 'text-white';

  return (
    <tr className={`border-b transition-all duration-200 ${rowClass} ${isLight ? 'hover:bg-[#f5fbff]' : 'hover:bg-[#13252d]/65'}`}>
      <td className={cellClass}>
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
              <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${isLight ? 'border-[#d7e4ec] bg-[#ffffff] text-slate-700' : 'border-[#314d57] bg-[#0f1d23] text-[#b8d6df]'}`}>
                #{endpoint.captureIndex}
              </span>
              <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${isLight ? 'border-[#cfe0ea] bg-[#f0f8fc] text-[#2d7b96]' : 'border-[#325260] bg-[#11242d] text-[#7fb8cb]'}`}>
                Endpoint
              </span>
              <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${isLight ? 'border-[#ead9c8] bg-[#fff6ed] text-[#b97836]' : 'border-[#4d3d2c] bg-[#2a2017] text-[#e7a46f]'}`}>
                {sanitizedSourceLabel}
              </span>
            </div>
            <div className={`mt-3 whitespace-normal break-all font-mono text-sm leading-6 md:text-[15px] ${mainTextClass}`}>
              {highlightSearchQuery(endpoint.url, searchQuery)}
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {getVisibleClassifications().map(category => (
                <span key={category} className={`${CSS_CLASSES[category]} border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]`}>
                  {category.replace(/_/g, ' ')}
                </span>
              ))}
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
      </td>
      <td className={cellClass}>
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.2em] text-[#7eaabc]">{sanitizedSourceLabel}</div>
          <div className={`mt-2 whitespace-normal break-all text-sm leading-6 ${mainTextClass}`}>{endpoint.foundAt}</div>
        </div>
      </td>
      <td className={cellClass}>
        <div className="min-w-0">
          <div className={`whitespace-normal break-all text-sm leading-6 ${mainTextClass}`}>{endpoint.webpage}</div>
          {endpoint.webpage === endpoint.foundAt && (
            <div className={`mt-2 text-xs ${subtleTextClass}`}>Same as source document</div>
          )}
        </div>
      </td>
    </tr>
  );
}
