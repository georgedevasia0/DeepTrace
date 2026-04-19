import React, { useState, useRef } from 'react';
import { URLProps } from '../components/URLProps';
import { LocationItem, WebpageItem } from '../components/Locationitem';
import { useURLData } from '../hooks/useURLData';
import { clearURLs, deleteSelectedURLs, getEndpointSelectionKey } from '../utils/defaultview_utils';
import { VISIBLE_URL_SIZE, FILTER_CATEGORIES, ClassificationType, ClassificationMapping } from '../constants/defaultview_contants';
import { NavBar } from '../components/navbar';
import browser from 'webextension-polyfill';
import { useThemeMode } from '../hooks/useThemeMode';

interface URLsDefaultViewProps {
  selection?: string;
  setSelection?: (value: string) => void;
}

export function URLsDefaultView({ selection = "default", setSelection }: URLsDefaultViewProps) {
  const { isLight } = useThemeMode();
  const [selectedLocation, setSelectedLocation] = useState<string>('All');
  const [selectedWebpage, setSelectedWebpage] = useState<string>('All');
  const [isOpenLocation, setIsOpenLocation] = useState<boolean>(false);
  const [isOpenWebpage, setIsOpenWebpage] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [startIndex, setStartIndex] = useState(0);
  const [filterToggle, setFilterToggle] = useState(false);
  const [sortOption, setSortOption] = useState<string>('url-asc');
  const [selectedEndpointKeys, setSelectedEndpointKeys] = useState<Set<string>>(new Set());
  const [selectedCategories, setSelectedCategories] = useState<Record<string, boolean>>(
    Object.keys(FILTER_CATEGORIES).reduce((acc, category) => {
      acc[category] = true;
      return acc;
    }, {} as Record<string, boolean>)
  );
  const tableRef = useRef<HTMLDivElement>(null);

  const {
    urls,
    jsFiles,
    filteredURLs,
    visibleUrls,
    webpages
  } = useURLData(selectedLocation, selectedWebpage, searchQuery, startIndex, VISIBLE_URL_SIZE, selectedCategories, sortOption);

  const getCategoryCounts = (): Record<ClassificationType, number> => {
    const counts: Record<ClassificationType, number> = {} as Record<ClassificationType, number>;

    urls.forEach(urlData => {
      if (urlData?.classifications) {
        Object.entries(urlData.classifications).forEach(([key, value]) => {
          if (value === true && ClassificationMapping[key]) {
            const classificationType = ClassificationMapping[key];
            counts[classificationType] = (counts[classificationType] || 0) + 1;
          }
        });
      }
    });

    return counts;
  };

  const categoryCounts = getCategoryCounts();
  const selectedFilteredCount = filteredURLs.filter(endpoint => selectedEndpointKeys.has(getEndpointSelectionKey(endpoint))).length;
  const areAllFilteredSelected = filteredURLs.length > 0 && selectedFilteredCount === filteredURLs.length;
  const activeCategoryCount = Object.values(selectedCategories).filter(Boolean).length;
  const actualSourceCount = Math.max(jsFiles.length - 1, 0);
  const actualWebpageCount = Math.max(webpages.length - 1, 0);
  const selectedLocationLabel = selectedLocation === 'All' ? 'All Sources' : selectedLocation;
  const selectedWebpageLabel = selectedWebpage === 'All' ? 'All Webpages' : selectedWebpage;

  const handleSelectLocation = (url: string) => {
    setSelectedLocation(url);
    setIsOpenLocation(false);
    setStartIndex(0);
  };

  const handleSelectWebpage = (url: string) => {
    setSelectedWebpage(url);
    setIsOpenWebpage(false);
    setStartIndex(0);
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
    setStartIndex(0);
  };

  const handleSortChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSortOption(event.target.value);
    setStartIndex(0);
  };

  const handleScroll = () => {
    if (tableRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = tableRef.current;
      const bottomThreshold = 200;
      const topThreshold = 200;

      if (scrollHeight - scrollTop - clientHeight < bottomThreshold) {
        setStartIndex(prev => Math.min(prev + 20, Math.max(0, filteredURLs.length - VISIBLE_URL_SIZE)));
      } else if (scrollTop < topThreshold && startIndex > 0) {
        setStartIndex(prev => Math.max(prev - 20, 0));
      }
    }
  };

  const allSelected = Object.keys(FILTER_CATEGORIES).length > 0 &&
    Object.values(selectedCategories).every(value => value);

  const handleSelectAllChange = () => {
    const newSelectedCategories = Object.keys(FILTER_CATEGORIES).reduce((acc, category) => {
      acc[category] = !allSelected;
      return acc;
    }, {} as Record<string, boolean>);

    setSelectedCategories(newSelectedCategories);
  };

  const handleCheckboxChange = (category: string) => {
    setSelectedCategories(prev => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  const handleToggleSelectEndpoint = (endpoint: typeof filteredURLs[number]) => {
    const endpointKey = getEndpointSelectionKey(endpoint);

    setSelectedEndpointKeys(prev => {
      const next = new Set(prev);
      if (next.has(endpointKey)) {
        next.delete(endpointKey);
      } else {
        next.add(endpointKey);
      }
      return next;
    });
  };

  const handleToggleSelectAllFiltered = () => {
    setSelectedEndpointKeys(prev => {
      const next = new Set(prev);

      if (areAllFilteredSelected) {
        filteredURLs.forEach(endpoint => next.delete(getEndpointSelectionKey(endpoint)));
      } else {
        filteredURLs.forEach(endpoint => next.add(getEndpointSelectionKey(endpoint)));
      }

      return next;
    });
  };

  const handleDeleteSelected = async () => {
    const endpointsToDelete = filteredURLs.filter(endpoint => selectedEndpointKeys.has(getEndpointSelectionKey(endpoint)));

    if (endpointsToDelete.length === 0) {
      return;
    }

    await deleteSelectedURLs(endpointsToDelete);

    setSelectedEndpointKeys(prev => {
      const next = new Set(prev);
      endpointsToDelete.forEach(endpoint => next.delete(getEndpointSelectionKey(endpoint)));
      return next;
    });
    setStartIndex(0);
  };

  const downloadURLsAsTxt = () => {
    const urlStrings = filteredURLs.map(urlObj => urlObj.url).join('\n');
    const blob = new Blob([urlStrings], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'urls.txt';
    link.click();
  };

  const shellClass = isLight
    ? 'min-h-screen w-full bg-[radial-gradient(circle_at_top_left,_rgba(93,177,201,0.12),_transparent_26%),radial-gradient(circle_at_top_right,_rgba(255,176,145,0.16),_transparent_22%),linear-gradient(180deg,_#f7fbff_0%,_#eef5fb_50%,_#e7eff7_100%)] px-4 pb-12 pt-6 md:px-8'
    : 'min-h-screen w-full bg-[radial-gradient(circle_at_top_left,_rgba(49,110,125,0.18),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(233,108,76,0.10),_transparent_24%),linear-gradient(180deg,_#101920_0%,_#141e24_40%,_#0d151a_100%)] px-4 pb-12 pt-6 md:px-8';
  const panelClass = isLight
    ? 'overflow-hidden rounded-[32px] border border-[#d4e3ec] bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(245,249,253,0.96))] shadow-[0_30px_120px_rgba(0,0,0,0.12)]'
    : 'overflow-hidden rounded-[32px] border border-[#2d4954] bg-[linear-gradient(135deg,rgba(18,30,36,0.96),rgba(15,24,29,0.92))] shadow-[0_30px_120px_rgba(0,0,0,0.35)]';
  const heroClass = isLight
    ? 'border-b border-[#d6e5ed] bg-[radial-gradient(circle_at_top_left,_rgba(93,177,201,0.14),_transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.98),rgba(245,249,253,0.96))] px-6 py-8 md:px-8'
    : 'border-b border-[#29424d] bg-[radial-gradient(circle_at_top_left,_rgba(49,110,125,0.28),_transparent_34%),linear-gradient(135deg,rgba(20,30,36,0.98),rgba(15,25,31,0.88))] px-6 py-8 md:px-8';
  const cardClass = isLight
    ? 'rounded-2xl border border-[#d6e5ed] bg-[#ffffff] px-4 py-3'
    : 'rounded-2xl border border-[#2a4650] bg-[#102028]/85 px-4 py-3';
  const sectionClass = isLight
    ? 'rounded-[28px] border border-[#d6e5ed] bg-[#ffffff] p-4'
    : 'rounded-[28px] border border-[#29424d] bg-[#0e1a20]/85 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]';
  const inputClass = isLight
    ? 'w-full rounded-2xl border border-[#d3e3ec] bg-[#ffffff] px-4 py-4 text-base text-slate-900 outline-none transition-all duration-200 placeholder:text-slate-500 hover:border-[#4c7d8d] focus:border-[#6cb7ca] focus:shadow-[0_0_0_4px_rgba(49,110,125,0.2)]'
    : 'w-full rounded-2xl border border-[#335561] bg-[#13252d] px-4 py-4 text-base text-white outline-none transition-all duration-200 placeholder:text-slate-500 hover:border-[#4c7d8d] focus:border-[#6cb7ca] focus:shadow-[0_0_0_4px_rgba(49,110,125,0.2)]';
  const selectClass = isLight
    ? 'min-w-[180px] flex-1 rounded-2xl border border-[#d3e3ec] bg-[#ffffff] px-4 py-4 text-sm font-medium text-slate-900 outline-none transition-all duration-200 hover:border-[#4c7d8d] focus:border-[#6cb7ca]'
    : 'min-w-[180px] flex-1 rounded-2xl border border-[#335561] bg-[#13252d] px-4 py-4 text-sm font-medium text-white outline-none transition-all duration-200 hover:border-[#4c7d8d] focus:border-[#6cb7ca]';

  return (
    <div className={shellClass}>
      {(document.location.pathname.toLowerCase().includes("devtool") && <NavBar />)}

      <div className="mt-5 w-full">
        <div className="flex flex-col gap-6">
          <div className={panelClass}>
            <div className={heroClass}>
              <div className="flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
                <div className="max-w-3xl">
                  <div className="inline-flex items-center gap-2 rounded-full border border-[#315865] bg-[#10262f]/80 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#8cc9db]">
                    Endpoint Intelligence Panel
                  </div>
                  <h1 className={`mt-5 max-w-3xl text-3xl font-bold leading-tight md:text-5xl ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    Review, triage, and curate discovered endpoints with a cleaner security-focused workspace.
                  </h1>
                  <p className={`mt-4 max-w-2xl text-sm leading-7 md:text-base ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                    Search through the current corpus, focus by source or webpage, then bulk-select noisy matches for cleanup without losing the rest of the scan.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:w-[460px]">
                  {setSelection && (
                    <div className="sm:col-span-2 flex justify-end">
                      <div className={`inline-flex items-center gap-2 rounded-full border p-2 shadow-[0_18px_50px_rgba(0,0,0,0.12)] ${isLight ? 'border-[#d3e3ec] bg-[linear-gradient(180deg,#ffffff,#f4f9fc)]' : 'border-[#325260] bg-[linear-gradient(180deg,rgba(12,24,30,0.92),rgba(10,18,23,0.96))]'}`}>
                        <button
                          type="button"
                          className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] transition-all duration-200 ${
                            selection === "default"
                              ? isLight
                                ? "border border-[#8bc7d9] bg-[linear-gradient(135deg,#edf8fc,#dff1f8)] text-[#1f5f74] shadow-[0_10px_30px_rgba(18,67,81,0.12)]"
                                : "border border-[#7ad4e7] bg-[linear-gradient(135deg,#153643,#215869)] text-[#daf8ff] shadow-[0_10px_30px_rgba(18,67,81,0.35)]"
                              : isLight
                                ? "border border-transparent bg-transparent text-[#527383] hover:border-[#c9dde8] hover:text-[#183746]"
                                : "border border-transparent bg-transparent text-[#7eaabc] hover:border-[#355a67] hover:text-white"
                          }`}
                          onClick={() => setSelection("default")}
                        >
                          Default
                        </button>
                        <button
                          type="button"
                          className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] transition-all duration-200 ${
                            selection === "tree"
                              ? isLight
                                ? "border border-[#8bc7d9] bg-[linear-gradient(135deg,#edf8fc,#dff1f8)] text-[#1f5f74] shadow-[0_10px_30px_rgba(18,67,81,0.12)]"
                                : "border border-[#7ad4e7] bg-[linear-gradient(135deg,#153643,#215869)] text-[#daf8ff] shadow-[0_10px_30px_rgba(18,67,81,0.35)]"
                              : isLight
                                ? "border border-transparent bg-transparent text-[#527383] hover:border-[#c9dde8] hover:text-[#183746]"
                                : "border border-transparent bg-transparent text-[#7eaabc] hover:border-[#355a67] hover:text-white"
                          }`}
                          onClick={() => setSelection("tree")}
                        >
                          Tree
                        </button>
                      </div>
                    </div>
                  )}
                  <div className={isLight ? 'rounded-[24px] border border-[#d5e4ed] bg-[#ffffff] p-4' : 'rounded-[24px] border border-[#2c4b57] bg-[#102129]/90 p-4'}>
                    <div className="text-[11px] uppercase tracking-[0.2em] text-[#79b6c9]">Visible Endpoints</div>
                    <div className={`mt-3 text-3xl font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>{filteredURLs.length}</div>
                    <div className={`mt-2 text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Current result set after search, sort, and filters.</div>
                  </div>
                  <div className={isLight ? 'rounded-[24px] border border-[#eadfd2] bg-[#fff9f3] p-4' : 'rounded-[24px] border border-[#3d3a31] bg-[#1a1711]/90 p-4'}>
                    <div className="text-[11px] uppercase tracking-[0.2em] text-[#f1b57c]">Selected For Action</div>
                    <div className={`mt-3 text-3xl font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>{selectedFilteredCount}</div>
                    <div className={`mt-2 text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Bulk-delete only touches the selected filtered endpoints.</div>
                  </div>
                </div>
              </div>
              <div className="mt-8 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className={cardClass}>
                  <div className="text-[11px] uppercase tracking-[0.22em] text-[#7eaabc]">Sources</div>
                  <div className={`mt-2 text-xl font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>{actualSourceCount}</div>
                </div>
                <div className={cardClass}>
                  <div className="text-[11px] uppercase tracking-[0.22em] text-[#7eaabc]">Webpages</div>
                  <div className={`mt-2 text-xl font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>{actualWebpageCount}</div>
                </div>
                <div className={cardClass}>
                  <div className="text-[11px] uppercase tracking-[0.22em] text-[#7eaabc]">Active Categories</div>
                  <div className={`mt-2 text-xl font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>{activeCategoryCount}</div>
                </div>
                <div className={cardClass}>
                  <div className="text-[11px] uppercase tracking-[0.22em] text-[#7eaabc]">Sort</div>
                  <div className={`mt-2 text-base font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>{sortOption.replace('-', ' ').toUpperCase()}</div>
                </div>
              </div>
            </div>

            <div className={`border-b px-6 py-5 md:px-8 ${isLight ? 'border-[#d6e5ed]' : 'border-[#29424d]'}`}>
              <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(220px,0.7fr)_minmax(220px,0.7fr)]">
                <div className={`${sectionClass} self-start`}>
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.24em] text-[#7fb8cb]">Endpoint Controls</div>
                      <div className={`mt-1 text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Search, sort, select, and delete the current result set.</div>
                    </div>
                    <div className={`rounded-full border px-3 py-1 text-xs ${isLight ? 'border-[#cfe0ea] bg-[#f4fbff] text-[#2d7b96]' : 'border-[#345766] bg-[#12262f] text-[#8dc4d5]'}`}>
                      {filteredURLs.length} visible
                    </div>
                  </div>
                  <div className="flex flex-col gap-3">
                    <input type="text" value={searchQuery} onChange={handleSearchChange} className={inputClass} placeholder="Search endpoints, path fragments, or parameters..." />
                    <div className="flex flex-wrap gap-3">
                      <select value={sortOption} onChange={handleSortChange} className={selectClass} aria-label="Sort endpoints">
                        <option value="captured-asc">Captured First</option>
                        <option value="captured-desc">Captured Last</option>
                        <option value="url-asc">URL A-Z</option>
                        <option value="url-desc">URL Z-A</option>
                        <option value="source-asc">Source A-Z</option>
                        <option value="source-desc">Source Z-A</option>
                        <option value="webpage-asc">Webpage A-Z</option>
                        <option value="webpage-desc">Webpage Z-A</option>
                      </select>
                      <button type="button" onClick={handleToggleSelectAllFiltered} className="rounded-2xl border border-[#3b6b79] bg-[linear-gradient(135deg,#14313c,#1b4552)] px-4 py-4 text-sm font-semibold text-[#c7edf7] transition-all duration-200 hover:border-[#6bb5c8] hover:shadow-[0_14px_38px_rgba(17,49,60,0.35)]">
                        {areAllFilteredSelected ? 'Clear Selection' : `Select Filtered (${filteredURLs.length})`}
                      </button>
                      <button
                        type="button"
                        onClick={handleDeleteSelected}
                        disabled={selectedFilteredCount === 0}
                        className={`rounded-2xl border px-4 py-4 text-sm font-semibold transition-all duration-200 ${
                          selectedFilteredCount === 0
                            ? isLight
                              ? 'cursor-not-allowed border-[#d8e3ea] bg-[#eef4f8] text-[#93a7b3]'
                              : 'cursor-not-allowed border-[#314b55] bg-[#17262d] text-[#6f8893]'
                            : isLight
                              ? 'border-[#d88a7f] bg-[linear-gradient(135deg,#fff1ef,#ffe2de)] text-[#8d3b31] hover:border-[#cf6e61]'
                              : 'border-[#7f423a] bg-[linear-gradient(135deg,#3a1715,#612925)] text-[#ffd9d4] hover:border-[#e28173] hover:shadow-[0_14px_38px_rgba(71,26,22,0.32)]'
                        }`}
                      >
                        Delete Selected ({selectedFilteredCount})
                      </button>
                    </div>
                  </div>
                </div>

                <div className={`${sectionClass} self-start`}>
                  <div className="text-[11px] uppercase tracking-[0.24em] text-[#7fb8cb]">Source Scope</div>
                  <div className={`mt-2 text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Focus on one JavaScript file or keep the full corpus.</div>
                  <div className="relative mt-4 w-full">
                    <button onClick={() => setIsOpenLocation(!isOpenLocation)} className={`w-full rounded-2xl border px-4 py-4 text-left text-sm transition-all duration-200 hover:border-[#5b93a5] ${isLight ? 'border-[#d3e3ec] bg-[#ffffff] text-slate-900' : 'border-[#335561] bg-[#13252d] text-white'}`}>
                      <div className="text-[11px] uppercase tracking-[0.18em] text-[#75b1c3]">Selected Source</div>
                      <div className="mt-2 truncate text-sm font-medium">{selectedLocationLabel}</div>
                    </button>
                    {isOpenLocation && (
                      <div className="absolute z-20 mt-2 max-h-72 w-full overflow-auto rounded-2xl border border-[#355a67] bg-[#102028] p-2 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
                        {jsFiles.map((url, index) => (
                          <LocationItem key={index} url={url} onClick={() => handleSelectLocation(url)} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className={sectionClass}>
                  <div className="text-[11px] uppercase tracking-[0.24em] text-[#7fb8cb]">Webpage Scope</div>
                  <div className={`mt-2 text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Limit the panel to a single root webpage when triaging.</div>
                  <div className="relative mt-4 w-full">
                    <button onClick={() => setIsOpenWebpage(!isOpenWebpage)} className={`w-full rounded-2xl border px-4 py-4 text-left text-sm transition-all duration-200 hover:border-[#5b93a5] ${isLight ? 'border-[#d3e3ec] bg-[#ffffff] text-slate-900' : 'border-[#335561] bg-[#13252d] text-white'}`}>
                      <div className="text-[11px] uppercase tracking-[0.18em] text-[#75b1c3]">Selected Webpage</div>
                      <div className="mt-2 truncate text-sm font-medium">{selectedWebpageLabel}</div>
                    </button>
                    {isOpenWebpage && (
                      <div className="absolute z-20 mt-2 max-h-72 w-full overflow-auto rounded-2xl border border-[#355a67] bg-[#102028] p-2 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
                        {webpages.map((url, index) => (
                          <WebpageItem key={index} url={url} onClick={() => handleSelectWebpage(url)} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className={`mt-4 ${sectionClass}`}>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.24em] text-[#7fb8cb]">Classification Filters</div>
                      <div className={`mt-1 text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Expand this panel to refine the full result set by endpoint signal type.</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={`${filterToggle ? (isLight ? 'border-[#8cc8da] bg-[#dff1f8] text-[#1f5f74]' : 'border-[#7ad4e7] bg-[linear-gradient(135deg,#215160,#2b697c)] text-[#daf8ff]') : (isLight ? 'border-[#d3e3ec] bg-[#ffffff] text-[#527383]' : 'border-[#335561] bg-[#13252d] text-[#89c0d1]')} rounded-2xl border px-4 py-3 text-sm font-semibold transition-all duration-200 hover:border-[#7ad4e7]`}
                        onClick={() => { setFilterToggle(!filterToggle); }}
                      >
                        {filterToggle ? 'Hide Categories' : 'Show Categories'}
                      </button>
                      <button type="button" onClick={handleSelectAllChange} className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition-all duration-200 ${isLight ? 'border-[#d3e3ec] bg-[#ffffff] text-slate-700 hover:border-[#8bc7d9]' : 'border-[#325260] bg-[#10262f]/90 text-[#8bc5d7] hover:border-[#6bb5c8]'}`}>
                        {allSelected ? 'Clear All' : 'Toggle All'}
                      </button>
                    </div>
                  </div>
                  {filterToggle && (
                    <div className={`rounded-[24px] border p-5 ${isLight ? 'border-[#d6e5ed] bg-[#f8fbfd]' : 'border-[#29424d] bg-[#0c161b]/80'}`}>
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        {Object.entries(FILTER_CATEGORIES).map(([category, colorClass]) => (
                          <button
                            key={category}
                            type="button"
                            onClick={() => handleCheckboxChange(category)}
                            className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition-all duration-200 ${
                              selectedCategories[category]
                                ? 'border-[#477988] bg-[#12262f] shadow-[0_10px_30px_rgba(12,27,34,0.35)]'
                                : isLight ? 'border-[#d6e5ed] bg-[#ffffff] opacity-90' : 'border-[#273941] bg-[#101a1f] opacity-75'
                            }`}
                          >
                            <span className="flex items-center gap-3">
                              <span className={`h-3 w-3 rounded-full ${selectedCategories[category] ? 'bg-[#6cc5d8]' : 'bg-slate-600'}`}></span>
                              <span className={`text-xs font-semibold uppercase tracking-[0.18em] ${colorClass}`}>
                                {category.replace(/_/g, ' ')}
                              </span>
                            </span>
                            <span className={`rounded-full border px-2 py-1 text-xs text-customFont ${isLight ? 'border-[#d6e5ed]' : 'border-white/10'}`}>
                              {categoryCounts[category as ClassificationType] || 0}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="px-2 py-5 md:px-3">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 px-1">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.24em] text-[#7fb8cb]">Results</div>
                  <div className={`mt-1 text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Each row highlights an endpoint with its source, webpage, and actions.</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-[#335764] bg-[#12232b] px-3 py-2 text-xs text-[#8ec9db]">
                    Source: {selectedLocationLabel}
                  </span>
                  <span className="rounded-full border border-[#335764] bg-[#12232b] px-3 py-2 text-xs text-[#8ec9db]">
                    Webpage: {selectedWebpageLabel}
                  </span>
                </div>
              </div>
              <div className={`w-full max-h-[760px] overflow-y-auto overflow-x-hidden rounded-[24px] border ${isLight ? 'border-[#d6e5ed] bg-[#f8fbfd]' : 'border-[#28424c] bg-[#0b1418]/80'}`} ref={tableRef} onScroll={handleScroll}>
                <div className="w-full align-middle">
                  <div className="overflow-hidden">
                    <table className="min-w-full table-fixed">
                      <colgroup>
                        <col className="w-[31%]" />
                        <col className="w-[34.5%]" />
                        <col className="w-[34.5%]" />
                      </colgroup>
                      <thead>
                        <tr className={`${isLight ? 'bg-[#eef6fb]' : 'bg-[#0f1b20]'} text-left align-top`}>
                          <th className="!px-4 !py-3 text-xs font-semibold uppercase tracking-[0.22em] text-[#7fb8cb] md:!px-5 w-[34%]">
                            Endpoint
                          </th>
                          <th className="!px-4 !py-3 text-xs font-semibold uppercase tracking-[0.22em] text-[#7fb8cb] md:!px-5 w-[33%]">
                            Source
                          </th>
                          <th className="!px-4 !py-3 text-xs font-semibold uppercase tracking-[0.22em] text-[#7fb8cb] md:!px-5 w-[33%]">
                            Webpage
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleUrls.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="!px-4 !py-12">
                              <div className={`rounded-[24px] border border-dashed px-6 py-12 text-center ${isLight ? 'border-[#d6e5ed] bg-[#ffffff]' : 'border-[#365562] bg-[#101c21]/90'}`}>
                                <div className="text-[11px] uppercase tracking-[0.24em] text-[#7fb8cb]">No Results</div>
                                <div className={`mt-3 text-2xl font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>No endpoints match the current panel filters.</div>
                                <div className={`mt-2 text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Try broadening the search text, source scope, webpage scope, or category selection.</div>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          visibleUrls.map((endpoint, index) => (
                            <URLProps
                              key={startIndex + index}
                              endpoint={endpoint}
                              searchQuery={searchQuery}
                              selectedCategories={selectedCategories}
                              isSelected={selectedEndpointKeys.has(getEndpointSelectionKey(endpoint))}
                              onToggleSelect={handleToggleSelectEndpoint}
                              isLight={isLight}
                            />
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 px-1">
            <a href={document.location.origin + "/PopUp/popup.html#urls"} target="_blank" className={`rounded-2xl border px-5 py-3 text-sm font-semibold tracking-[0.16em] transition-all duration-200 ${isLight ? 'border-[#8bc7d9] bg-[linear-gradient(135deg,#edf8fc,#dff1f8)] text-[#1f5f74] hover:border-[#6bb5c8]' : 'border-[#3b6b79] bg-[linear-gradient(135deg,#14313c,#1b4552)] text-[#c7edf7] hover:border-[#6bb5c8] hover:shadow-[0_14px_38px_rgba(17,49,60,0.35)]'}`}>WEBPAGE PANEL</a>
            <button className={`rounded-2xl border px-5 py-3 text-sm font-semibold transition-all duration-200 ${isLight ? 'border-[#d3e3ec] bg-[#ffffff] text-slate-900 hover:border-[#8bc7d9]' : 'border-[#355c6a] bg-[#12232b] text-white hover:border-[#7fb8cb]'}`} onClick={clearURLs}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                <path fill="none" stroke="red" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7h16m-10 4v6m4-6v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"/>
              </svg>
            </button>
            <button className={`rounded-2xl border px-5 py-3 text-sm font-semibold transition-all duration-200 ${isLight ? 'border-[#d3e3ec] bg-[#ffffff] text-slate-900 hover:border-[#8bc7d9]' : 'border-[#355c6a] bg-[#12232b] text-white hover:border-[#7fb8cb]'}`} onClick={downloadURLsAsTxt}>
              Download
            </button>
            <a href={document.location.origin + "/PopUp/popup.html#urls/output"} target="_blank" className={`rounded-2xl border px-5 py-3 text-sm font-semibold transition-all duration-200 ${isLight ? 'border-[#d3e3ec] bg-[#ffffff] text-slate-900 hover:border-[#8bc7d9]' : 'border-[#355c6a] bg-[#12232b] text-white hover:border-[#7fb8cb]'}`}>OUTPUT</a>
            <button className={`rounded-2xl border px-5 py-3 text-sm font-semibold transition-all duration-200 ${isLight ? 'border-[#d3e3ec] bg-[#ffffff] text-slate-900 hover:border-[#8bc7d9]' : 'border-[#355c6a] bg-[#12232b] text-white hover:border-[#7fb8cb]'}`} onClick={() => browser.runtime.reload()}>
              Load All Classifications
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
