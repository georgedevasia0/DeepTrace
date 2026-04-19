import browser from 'webextension-polyfill';
import React, { useEffect, useState } from "react";
import { formatURLData } from '../utils/URLdataFormatter_utils';
import { Endpoint, Location } from '../constants/message_types';
import { NavBar } from '../components/navbar';
import { useThemeMode } from '../hooks/useThemeMode';

interface URLsTreeViewProps {
  selection?: string;
  setSelection?: (value: string) => void;
}

export function URLsTreeView({ selection = "tree", setSelection }: URLsTreeViewProps) {
  const { isLight } = useThemeMode();
  const [hierarchy, setHierarchy] = useState<{
    [webpage: string]: {
      mainPage: Endpoint[];
      jsFiles: {
        [jsFile: string]: Endpoint[];
      };
    };
  }>({});
  const [jsFiles, setJSFiles] = useState<Location[]>([]);
  const [selected, setSelected] = useState<string>('All');
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortOption, setSortOption] = useState<string>('url-asc');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchData = async () => {
      const { hierarchy: newHierarchy, locations } = await formatURLData();
      setHierarchy(newHierarchy);
      setJSFiles(locations);
    };

    fetchData();

    const handleStorageChange = (changes: { [key: string]: browser.Storage.StorageChange }) => {
      if (changes["URL-PARSER"]) {
        fetchData();
      }
    };

    browser.storage.onChanged.addListener(handleStorageChange);

    return () => {
      browser.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  const handleSelect = (url: string) => {
    setSelected(url);
    setIsOpen(false);
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  };

  const handleSortChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSortOption(event.target.value);
  };

  const toggleExpand = (item: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(item)) {
        newSet.delete(item);
      } else {
        newSet.add(item);
      }
      return newSet;
    });
  };

  const filterEndpoints = (endpoints: Endpoint[]): Endpoint[] => {
    const filtered = endpoints.filter(endpoint =>
      endpoint.url.toLowerCase().includes(searchQuery.toLowerCase()) &&
      (selected === 'All' || endpoint.foundAt === selected || endpoint.webpage === selected)
    );

    return [...filtered].sort((a, b) => {
      switch (sortOption) {
        case 'url-desc':
          return b.url.localeCompare(a.url);
        case 'source-asc':
          return a.foundAt.localeCompare(b.foundAt) || a.url.localeCompare(b.url);
        case 'source-desc':
          return b.foundAt.localeCompare(a.foundAt) || a.url.localeCompare(b.url);
        default:
          return a.url.localeCompare(b.url);
      }
    });
  };

  const highlightSearchQuery = (text: string) => {
    if (!searchQuery) return [<span key="full">{text}</span>];

    const escapedQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = text.split(new RegExp(`(${escapedQuery})`, 'gi'));

    return parts.map((part, index) =>
      part.toLowerCase() === searchQuery.toLowerCase() ? (
        <span key={index} className={`rounded px-1 py-0.5 ${isLight ? 'bg-[#ffe3da] text-[#a44c39]' : 'bg-[#3f2020] text-[#ffaea1]'}`}>{part}</span>
      ) : (
        <span key={index}>{part}</span>
      )
    );
  };

  const renderEndpoint = (endpoint: Endpoint) => {
    return (
      <div
        key={`${endpoint.webpage}-${endpoint.foundAt}-${endpoint.url}`}
        className={`rounded-2xl border px-4 py-3 ${isLight ? 'border-[#d9e6ee] bg-[#ffffff]' : 'border-[#2a434d] bg-[#0f1c22]/88 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]'}`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${isLight ? 'border-[#cfe0ea] bg-[#f0f8fc] text-[#2d7b96]' : 'border-[#385c69] bg-[#10262f] text-[#8ec9db]'}`}>
            Endpoint
          </span>
          <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${isLight ? 'border-[#ead9c8] bg-[#fff6ed] text-[#b97836]' : 'border-[#3e3a32] bg-[#1f1a14] text-[#f0b47e]'}`}>
            {endpoint.foundAt === endpoint.webpage ? 'Main Page' : 'JavaScript'}
          </span>
        </div>
        <div className={`mt-3 break-words font-mono text-sm leading-7 ${isLight ? 'text-slate-900' : 'text-white'}`}>
          {highlightSearchQuery(endpoint.url)}
        </div>
      </div>
    );
  };

  const renderHierarchicalView = () => {
    const renderedItems = Object.entries(hierarchy).map(([webpage, { mainPage, jsFiles }]) => {
      const filteredMainPage = filterEndpoints(mainPage);
      const filteredJsFiles = Object.entries(jsFiles).filter(([_, endpoints]) =>
        filterEndpoints(endpoints).length > 0
      );

      if (filteredMainPage.length === 0 && filteredJsFiles.length === 0) return null;

      const webpageExpanded = expandedItems.has(webpage);
      const mainPageExpanded = expandedItems.has(`${webpage}-main`);

      return (
        <div
          key={webpage}
          className={`rounded-[28px] border p-4 ${isLight ? 'border-[#d6e5ed] bg-[#ffffff]' : 'border-[#29424d] bg-[linear-gradient(180deg,rgba(16,28,34,0.95),rgba(11,20,25,0.95))] shadow-[0_20px_60px_rgba(0,0,0,0.22)]'}`}
        >
          <button
            type="button"
            className={`flex w-full items-center justify-between gap-4 rounded-[22px] border px-4 py-4 text-left transition-all duration-200 hover:border-[#76c5d8] ${isLight ? 'border-[#d3e3ec] bg-[#f8fbfd]' : 'border-[#345964] bg-[#0f2128]/90'}`}
            onClick={() => toggleExpand(webpage)}
          >
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-[0.24em] text-[#7fb8cb]">Webpage</div>
              <div className={`mt-2 break-words text-lg font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>{webpage}</div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`rounded-full border px-3 py-1 text-xs ${isLight ? 'border-[#d6e5ed] text-slate-600' : 'border-white/10 text-slate-300'}`}>
                {filteredMainPage.length + filteredJsFiles.reduce((sum, [, endpoints]) => sum + filterEndpoints(endpoints).length, 0)} matches
              </span>
              <span className="text-xl text-[#8fd2e2]">{webpageExpanded ? '−' : '+'}</span>
            </div>
          </button>

          {webpageExpanded && (
            <div className="mt-4 grid gap-4">
              {filteredMainPage.length > 0 && (
                <div className={`rounded-[24px] border p-4 ${isLight ? 'border-[#d6e5ed] bg-[#f8fbfd]' : 'border-[#29424d] bg-[#0c171c]/85'}`}>
                  <button
                    type="button"
                    className={`flex w-full items-center justify-between gap-4 rounded-[20px] border px-4 py-3 text-left transition-all duration-200 hover:border-[#6eb9cb] ${isLight ? 'border-[#d3e3ec] bg-[#ffffff]' : 'border-[#304f5a] bg-[#102028]'}`}
                    onClick={() => toggleExpand(`${webpage}-main`)}
                  >
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.22em] text-[#7fb8cb]">Main Document</div>
                      <div className={`mt-2 text-sm ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>Endpoints discovered directly in the root page.</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`rounded-full border px-3 py-1 text-xs ${isLight ? 'border-[#d6e5ed] text-slate-600' : 'border-white/10 text-slate-300'}`}>
                        {filteredMainPage.length}
                      </span>
                      <span className="text-lg text-[#8fd2e2]">{mainPageExpanded ? '−' : '+'}</span>
                    </div>
                  </button>
                  {mainPageExpanded && (
                    <div className="mt-4 grid gap-3">
                      {filteredMainPage.map(renderEndpoint)}
                    </div>
                  )}
                </div>
              )}

              {filteredJsFiles.map(([jsFile, endpoints]) => {
                const filteredEndpoints = filterEndpoints(endpoints);
                const jsFileExpanded = expandedItems.has(jsFile);

                return (
                  <div key={jsFile} className={`rounded-[24px] border p-4 ${isLight ? 'border-[#d6e5ed] bg-[#f8fbfd]' : 'border-[#29424d] bg-[#0c171c]/85'}`}>
                    <button
                      type="button"
                      className={`flex w-full items-center justify-between gap-4 rounded-[20px] border px-4 py-3 text-left transition-all duration-200 hover:border-[#6eb9cb] ${isLight ? 'border-[#d3e3ec] bg-[#ffffff]' : 'border-[#304f5a] bg-[#102028]'}`}
                      onClick={() => toggleExpand(jsFile)}
                    >
                      <div className="min-w-0">
                        <div className="text-[11px] uppercase tracking-[0.22em] text-[#7fb8cb]">JavaScript Asset</div>
                        <div className={`mt-2 break-words text-sm font-medium ${isLight ? 'text-slate-900' : 'text-white'}`}>{jsFile}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`rounded-full border px-3 py-1 text-xs ${isLight ? 'border-[#d6e5ed] text-slate-600' : 'border-white/10 text-slate-300'}`}>
                          {filteredEndpoints.length}
                        </span>
                        <span className="text-lg text-[#8fd2e2]">{jsFileExpanded ? '−' : '+'}</span>
                      </div>
                    </button>
                    {jsFileExpanded && (
                      <div className="mt-4 grid gap-3">
                        {filteredEndpoints.map(renderEndpoint)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    }).filter(Boolean);

    if (renderedItems.length === 0) {
      return (
        <div className={`rounded-[26px] border border-dashed px-6 py-14 text-center ${isLight ? 'border-[#d6e5ed] bg-[#ffffff]' : 'border-[#365562] bg-[#101c21]/90'}`}>
          <div className="text-[11px] uppercase tracking-[0.24em] text-[#7fb8cb]">No Tree Matches</div>
          <div className={`mt-3 text-2xl font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>No endpoints match the current tree filters.</div>
          <div className={`mt-2 text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Try broadening the search query or switching the source scope back to All.</div>
        </div>
      );
    }

    return renderedItems;
  };

  function clearURLs() {
    browser.storage.local.set({ 'URL-PARSER': {} }), () => {
      console.log("Clear endpoints");
    };
  }

  const shellClass = isLight
    ? 'min-h-screen w-full bg-[radial-gradient(circle_at_top_left,_rgba(93,177,201,0.12),_transparent_26%),radial-gradient(circle_at_top_right,_rgba(255,176,145,0.16),_transparent_22%),linear-gradient(180deg,_#f7fbff_0%,_#eef5fb_50%,_#e7eff7_100%)]'
    : 'min-h-screen w-full bg-[radial-gradient(circle_at_top_left,_rgba(49,110,125,0.18),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(233,108,76,0.10),_transparent_24%),linear-gradient(180deg,_#101920_0%,_#141e24_40%,_#0d151a_100%)]';

  return (
    <div className={shellClass}>
      {(document.location.pathname.toLowerCase().includes("devtool") && <NavBar />)}

      <div className="mx-auto mt-5 w-full max-w-7xl px-4 pb-12 md:px-8">
        <div className={`overflow-hidden rounded-[32px] border ${isLight ? 'border-[#d4e3ec] bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(245,249,253,0.96))] shadow-[0_30px_120px_rgba(0,0,0,0.12)]' : 'border-[#2d4954] bg-[linear-gradient(135deg,rgba(18,30,36,0.96),rgba(15,24,29,0.92))] shadow-[0_30px_120px_rgba(0,0,0,0.35)]'}`}>
          <div className={`border-b px-6 py-5 md:px-8 ${isLight ? 'border-[#d6e5ed]' : 'border-[#29424d]'}`}>
            {setSelection && (
              <div className="mb-4 flex justify-end">
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
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(220px,0.6fr)]">
              <div className={`rounded-[28px] border p-4 ${isLight ? 'border-[#d6e5ed] bg-[#ffffff]' : 'border-[#29424d] bg-[#0e1a20]/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]'}`}>
                <div className="mb-3">
                  <div className="text-[11px] uppercase tracking-[0.24em] text-[#7fb8cb]">Tree Controls</div>
                  <div className={`mt-1 text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Search tree nodes and reorder matching endpoints without leaving the hierarchy view.</div>
                </div>
                <div className="flex flex-col gap-3">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    className={`w-full rounded-2xl border px-4 py-4 text-base outline-none transition-all duration-200 placeholder:text-slate-500 hover:border-[#4c7d8d] focus:border-[#6cb7ca] focus:shadow-[0_0_0_4px_rgba(49,110,125,0.2)] ${isLight ? 'border-[#d3e3ec] bg-[#ffffff] text-slate-900' : 'border-[#335561] bg-[#13252d] text-white'}`}
                    placeholder="Search endpoints, domains, path fragments, or parameters..."
                  />
                  <select
                    value={sortOption}
                    onChange={handleSortChange}
                    className={`rounded-2xl border px-4 py-4 text-sm font-medium outline-none transition-all duration-200 hover:border-[#4c7d8d] focus:border-[#6cb7ca] ${isLight ? 'border-[#d3e3ec] bg-[#ffffff] text-slate-900' : 'border-[#335561] bg-[#13252d] text-white'}`}
                    aria-label="Sort endpoints"
                  >
                    <option value="url-asc">URL A-Z</option>
                    <option value="url-desc">URL Z-A</option>
                    <option value="source-asc">Source A-Z</option>
                    <option value="source-desc">Source Z-A</option>
                  </select>
                </div>
              </div>

              <div className={`rounded-[28px] border p-4 ${isLight ? 'border-[#d6e5ed] bg-[#ffffff]' : 'border-[#29424d] bg-[#0e1a20]/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]'}`}>
                <div className="text-[11px] uppercase tracking-[0.24em] text-[#7fb8cb]">Scope Filter</div>
                <div className={`mt-2 text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Focus the tree on one source or keep everything visible.</div>
                <div className="relative mt-4 w-full">
                  <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className={`w-full rounded-2xl border px-4 py-4 text-left text-sm transition-all duration-200 hover:border-[#5b93a5] ${isLight ? 'border-[#d3e3ec] bg-[#ffffff] text-slate-900' : 'border-[#335561] bg-[#13252d] text-white'}`}
                  >
                    <div className="text-[11px] uppercase tracking-[0.18em] text-[#75b1c3]">Selected Scope</div>
                    <div className="mt-2 truncate text-sm font-medium">{selected}</div>
                  </button>
                  {isOpen && (
                    <div className={`absolute z-20 mt-2 max-h-72 w-full overflow-auto rounded-2xl border p-2 shadow-[0_20px_60px_rgba(0,0,0,0.18)] ${isLight ? 'border-[#d6e5ed] bg-[#ffffff]' : 'border-[#355a67] bg-[#102028]'}`}>
                      <button type="button" onClick={() => handleSelect('All')} className={`block w-full rounded-xl px-3 py-3 text-left text-sm transition-all duration-200 ${isLight ? 'text-slate-900 hover:bg-[#eef7fb]' : 'text-white hover:bg-[#17303a]'}`}>All</button>
                      {jsFiles.filter((item) => item !== 'All').map((url, index) => (
                        <button type="button" key={index} onClick={() => handleSelect(url)} className={`block w-full rounded-xl px-3 py-3 text-left text-sm transition-all duration-200 ${isLight ? 'text-slate-900 hover:bg-[#eef7fb]' : 'text-white hover:bg-[#17303a]'}`}>
                          {url}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="px-4 py-5 md:px-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 px-2">
              <div>
                <div className="text-[11px] uppercase tracking-[0.24em] text-[#7fb8cb]">Tree Structure</div>
                <div className={`mt-1 text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Expand webpage nodes to inspect main-page endpoints and JavaScript asset branches.</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className={`rounded-full border px-3 py-2 text-xs ${isLight ? 'border-[#d6e5ed] bg-[#ffffff] text-[#2d7b96]' : 'border-[#335764] bg-[#12232b] text-[#8ec9db]'}`}>
                  Scope: {selected}
                </span>
              </div>
            </div>

            <div className={`rounded-[28px] border p-4 ${isLight ? 'border-[#d6e5ed] bg-[#f8fbfd]' : 'border-[#28424c] bg-[#0b1418]/80'}`}>
              <div className="grid gap-4">
                {renderHierarchicalView()}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3 px-1">
          <a href={document.location.origin + "/PopUp/popup.html#urls"} target="_blank" className={`rounded-2xl border px-5 py-3 text-sm font-semibold tracking-[0.16em] transition-all duration-200 ${isLight ? 'border-[#8bc7d9] bg-[linear-gradient(135deg,#edf8fc,#dff1f8)] text-[#1f5f74] hover:border-[#6bb5c8]' : 'border-[#3b6b79] bg-[linear-gradient(135deg,#14313c,#1b4552)] text-[#c7edf7] hover:border-[#6bb5c8] hover:shadow-[0_14px_38px_rgba(17,49,60,0.35)]'}`}>WEBPAGE PANEL</a>
          <button className={`rounded-2xl border px-5 py-3 text-sm font-semibold transition-all duration-200 ${isLight ? 'border-[#d3e3ec] bg-[#ffffff] text-slate-900 hover:border-[#8bc7d9]' : 'border-[#355c6a] bg-[#12232b] text-white hover:border-[#7fb8cb]'}`} onClick={clearURLs}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
              <path fill="none" stroke="red" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7h16m-10 4v6m4-6v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"/>
            </svg>
          </button>
          <a href={document.location.origin + "/PopUp/popup.html#urls/output"} target="_blank" className={`rounded-2xl border px-5 py-3 text-sm font-semibold transition-all duration-200 ${isLight ? 'border-[#d3e3ec] bg-[#ffffff] text-slate-900 hover:border-[#8bc7d9]' : 'border-[#355c6a] bg-[#12232b] text-white hover:border-[#7fb8cb]'}`}>OUTPUT</a>
        </div>
      </div>
    </div>
  );
}
