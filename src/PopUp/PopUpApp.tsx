import React, { useEffect, useState, useRef } from "react";
import browser from "webextension-polyfill";
import "./App.css";
import { MessageResponse, URLParserStorage, URLParserStorageItem } from "../constants/message_types";
import { useThemeMode } from "../hooks/useThemeMode";
import { SecretParserStorage, SecretParserStorageItem, SecretScanProgress } from "../constants/secret_types";

const Logo = "/icons/EndPointer.png";

interface AppState {
  urlParser: boolean;
  urlCount: number;
  jsFileCount: number;
  secretCount: number;
  secretScanProgress: SecretScanProgress;
  scopes: string[];
  reqAmt: number;
}

interface ActionButtonProps {
  label: string;
  onClick?: () => void;
  href?: string;
  variant?: "primary" | "secondary" | "danger";
  icon: React.ReactNode;
}

function ActionButton({ label, onClick, href, variant = "secondary", icon }: ActionButtonProps) {
  const baseClassName =
    "group flex min-h-[88px] items-center justify-between rounded-[26px] border px-5 py-4 text-left transition-all duration-200 hover:-translate-y-[1px]";
  const variantClassName =
    variant === "primary"
      ? "border-[#79d5ea] bg-[linear-gradient(135deg,#17404d,#236376)] text-white shadow-[0_18px_45px_rgba(18,67,81,0.34)] hover:border-[#a8ebf8]"
      : variant === "danger"
        ? "border-[#6f3d3d] bg-[linear-gradient(135deg,rgba(52,23,27,0.95),rgba(84,35,40,0.9))] text-white hover:border-[#f19797]"
        : "border-[#314f5a] bg-[linear-gradient(135deg,rgba(18,31,38,0.96),rgba(13,23,28,0.94))] text-white hover:border-[#75bfd1]";

  const content = (
    <>
      <div>
        <div className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Quick Action</div>
        <div className="mt-2 text-base font-semibold tracking-[0.08em] text-white">{label}</div>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-[#8fd2e2] transition-colors duration-200 group-hover:text-white">
        {icon}
      </div>
    </>
  );

  if (href) {
    return (
      <a href={href} target="_blank" className={`${baseClassName} ${variantClassName}`}>
        {content}
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} className={`${baseClassName} ${variantClassName}`}>
      {content}
    </button>
  );
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function PopUpApp() {
  const { themeMode, isLight, toggleTheme } = useThemeMode();
  const [state, setState] = useState<AppState>({
    urlParser: false,
    urlCount: 0,
    jsFileCount: 0,
    secretCount: 0,
    secretScanProgress: {
      running: false,
      total: 0,
      completed: 0,
      failed: 0,
      current: "",
    },
    scopes: [],
    reqAmt: 1,
  });
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    updateAllState();

    const listener = (changes: {
      [key: string]: browser.Storage.StorageChange;
    }) => {
      if (changes.autoParserEnabled) {
        setState((prevState) => ({
          ...prevState,
          urlParser: changes.autoParserEnabled.newValue as boolean,
        }));
        updateExtensionBadge(changes.autoParserEnabled.newValue as boolean);
      }
    };

    browser.storage.onChanged.addListener(listener);

    return () => {
      browser.storage.onChanged.removeListener(listener);
    };
  }, []);

  const updateExtensionBadge = async (urlParserState: boolean) => {
    const badgeText = urlParserState ? "ON" : "";
    const badgeColor = urlParserState ? "#82e467" : "#e63946";
    await browser.action.setBadgeText({ text: badgeText });
    await browser.action.setBadgeBackgroundColor({ color: badgeColor });
  };

  const updateAllState = async () => {
    try {
      const [autoParserState, scopeResult, reqAmtResult] = await Promise.all([
        browser.runtime.sendMessage({
          action: "getAutoParserState",
        }) as Promise<MessageResponse>,
        browser.storage.local.get("scope"),
        browser.storage.local.get("requests"),
      ]);

      setState((prevState) => ({
        ...prevState,
        urlParser: autoParserState.state ?? false,
        scopes: (scopeResult.scope as string[]) || [],
        reqAmt: (reqAmtResult.requests as number) || 1,
      }));

      const parserResult = await browser.storage.local.get(["URL-PARSER", "SECRET-PARSER", "secretScanProgress"]);
      const urlParser = (parserResult["URL-PARSER"] || {}) as URLParserStorage;
      const secretParser = (parserResult["SECRET-PARSER"] || {}) as SecretParserStorage;
      const secretScanProgress = (parserResult.secretScanProgress || {
        running: false,
        total: 0,
        completed: 0,
        failed: 0,
        current: "",
      }) as SecretScanProgress;
      const currentStorageKey = urlParser.current;
      const currentSecretStorageKey = secretParser.current;

      setState((prevState) => ({
        ...prevState,
        secretScanProgress,
      }));

      if (currentSecretStorageKey && typeof currentSecretStorageKey === "string") {
        const currentSecretData = secretParser[currentSecretStorageKey] as SecretParserStorageItem | undefined;

        if (currentSecretData && typeof currentSecretData !== "string") {
          const pageSecretCount = currentSecretData.currPage.length;
          const externalSecretCount = Object.values(currentSecretData.externalJSFiles)
            .reduce((total, secrets) => total + secrets.length, 0);

          setState((prevState) => ({
            ...prevState,
            secretCount: pageSecretCount + externalSecretCount,
          }));
        }
      } else {
        const allSecretEntries = Object.entries(secretParser).filter(
          ([key, value]) => key !== "current" && typeof value !== "string" && value !== undefined
        ) as Array<[string, SecretParserStorageItem]>;

        const fallbackSecretCount = allSecretEntries.reduce((total, [, value]) => {
          const jsSecretCount = Object.values(value.externalJSFiles).reduce((sum, secrets) => sum + secrets.length, 0);
          return total + value.currPage.length + jsSecretCount;
        }, 0);

        setState((prevState) => ({
          ...prevState,
          secretCount: fallbackSecretCount,
        }));
      }

      if (currentStorageKey && typeof currentStorageKey === "string") {
        const currentPageData = urlParser[currentStorageKey] as URLParserStorageItem | undefined;

        if (currentPageData) {
          const pageUrlCount = currentPageData.currPage.length;
          const externalJsEntries = Object.entries(currentPageData.externalJSFiles);
          const externalUrlCount = externalJsEntries.reduce((total, [, urls]) => total + urls.length, 0);

          setState((prevState) => ({
            ...prevState,
            urlCount: pageUrlCount + externalUrlCount,
            jsFileCount: externalJsEntries.length,
          }));
          return;
        }
      }

      const allPageEntries = Object.entries(urlParser).filter(
        ([key, value]) => key !== "current" && typeof value !== "string" && value !== undefined
      ) as Array<[string, URLParserStorageItem]>;

      const fallbackUrlCount = allPageEntries.reduce((total, [, value]) => {
        const jsUrlCount = Object.values(value.externalJSFiles).reduce((sum, urls) => sum + urls.length, 0);
        return total + value.currPage.length + jsUrlCount;
      }, 0);

      const fallbackJsFileCount = allPageEntries.reduce((total, [, value]) => {
        return total + Object.keys(value.externalJSFiles).length;
      }, 0);

      setState((prevState) => ({
        ...prevState,
        urlCount: fallbackUrlCount,
        jsFileCount: fallbackJsFileCount,
      }));
    } catch (error) {
      console.error("Failed to update state:", error);
    }
  };

  const getMessageTargetTab = async (): Promise<browser.Tabs.Tab | undefined> => {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0];
    const extensionOrigin = document.location.origin;

    if (activeTab?.id && activeTab.url && !activeTab.url.startsWith(extensionOrigin)) {
      return activeTab;
    }

    const parserResult = await browser.storage.local.get("URL-PARSER");
    const urlParser = (parserResult["URL-PARSER"] || {}) as URLParserStorage;
    const currentURL = typeof urlParser.current === "string" ? safeDecodeURIComponent(urlParser.current) : "";

    if (currentURL) {
      const currentWindowTabs = await browser.tabs.query({ currentWindow: true });
      const matchingTab = currentWindowTabs.find((tab) => tab.id && tab.url === currentURL);

      if (matchingTab) {
        return matchingTab;
      }
    }

    const currentWindowTabs = await browser.tabs.query({ currentWindow: true });
    return currentWindowTabs.find((tab) => (
      tab.id &&
      tab.url &&
      !tab.url.startsWith(extensionOrigin) &&
      !tab.url.startsWith("about:") &&
      !tab.url.startsWith("chrome:") &&
      !tab.url.startsWith("chrome-extension:") &&
      !tab.url.startsWith("moz-extension:")
    ));
  };

  const handleAction = async (action: string, payload?: Record<string, unknown>) => {
    try {
      const tab = await getMessageTargetTab();
      if (tab?.id) {
        const message = payload ? { action, ...payload } : { action };
        const response = await browser.tabs.sendMessage(tab.id, message) as MessageResponse;
        if (!response.success) {
          throw new Error(response.error);
        }
        await updateAllState();
      }
    } catch (error) {
      console.error(`Error in ${action}:`, error);
    }
  };

  const parseURLs = () => handleAction("reparse");
  const scanSecrets = () => handleAction("scanSecrets");
  const stopSecretScan = () => handleAction("stopSecretScan");
  const clearURLs = () => handleAction("clearURLs");

  useEffect(() => {
    const handleChange = () => {
      updateAllState();
    };
    browser.storage.onChanged.addListener(handleChange);
    return () => {
      browser.storage.onChanged.removeListener(handleChange);
    };
  }, []);

  const toggleUrlParserState = async () => {
    const newState = !state.urlParser;
    const response = await browser.runtime.sendMessage({ action: "setAutoParserState", state: newState }) as MessageResponse;
    if (response.success) {
      setState((prevState) => ({ ...prevState, urlParser: newState }));
      updateExtensionBadge(newState);
    }
  };

  const handleAddScope = () => {
    const newScope = inputRef.current?.value?.trim();
    if (newScope) {
      setState((prevState) => {
        const updatedScopes = [...prevState.scopes, newScope];
        browser.storage.local.set({ scope: updatedScopes });
        return { ...prevState, scopes: updatedScopes };
      });
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  const handleRemoveScope = (scopeToRemove: string) => {
    setState((prevState) => {
      const updatedScopes = prevState.scopes.filter((scope) => scope !== scopeToRemove);
      browser.storage.local.set({ scope: updatedScopes });
      return { ...prevState, scopes: updatedScopes };
    });
  };

  const handleReqAmt = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newReqAmtValue = Number(e.target.value);
    setState((prevState) => ({ ...prevState, reqAmt: newReqAmtValue }));
    browser.storage.local.set({ requests: newReqAmtValue });
  };

  const clearCache = async () => {
    await browser.storage.local.clear();
    alert("Cache cleared");
    updateAllState();
  };

  const clearAllScopes = () => {
    browser.storage.local.set({ scope: [] });
    setState((prevState) => ({ ...prevState, scopes: [] }));
  };

  const statusTone = state.urlParser
    ? "border-[#4d7e4f] bg-[#13271a] text-[#9ff2b6]"
    : "border-[#664449] bg-[#291519] text-[#ff9ca8]";

  const shellClassName = isLight
    ? "popup-shell min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(93,177,201,0.14),_transparent_26%),radial-gradient(circle_at_top_right,_rgba(255,176,145,0.18),_transparent_22%),linear-gradient(180deg,_#f6fbff_0%,_#edf5fb_48%,_#e7eff7_100%)]"
    : "popup-shell min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(124,212,232,0.18),_transparent_28%),radial-gradient(circle_at_82%_16%,_rgba(255,128,93,0.18),_transparent_24%),radial-gradient(circle_at_bottom_right,_rgba(57,95,168,0.16),_transparent_26%),linear-gradient(180deg,_#071218_0%,_#0b1620_48%,_#060d13_100%)]";
  const panelClassName = isLight
    ? "popup-card overflow-hidden rounded-[34px] border border-[#c8d9e6] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(244,249,253,0.96))] shadow-[0_28px_120px_rgba(70,101,128,0.18)]"
    : "popup-card overflow-hidden rounded-[34px] border border-[#28424c] bg-[linear-gradient(180deg,rgba(11,23,30,0.94),rgba(8,16,22,0.94))] shadow-[0_28px_120px_rgba(0,0,0,0.45)]";
  const heroClassName = isLight
    ? "border-b border-[#d4e2ec] bg-[radial-gradient(circle_at_top_left,_rgba(124,212,232,0.16),_transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.98),rgba(244,249,253,0.94))] px-5 py-6"
    : "border-b border-[#213842] bg-[radial-gradient(circle_at_top_left,_rgba(124,212,232,0.17),_transparent_34%),linear-gradient(135deg,rgba(12,24,31,0.95),rgba(10,18,24,0.92))] px-5 py-6";
  const cardClassName = isLight
    ? "rounded-[26px] border border-[#d5e3ec] bg-[#ffffff]/95 p-4"
    : "rounded-[26px] border border-[#2d4d58] bg-[#102028]/92 p-4";
  const sectionClassName = isLight
    ? "rounded-[30px] border border-[#d7e5ee] bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(246,250,253,0.96))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]"
    : "rounded-[30px] border border-[#27414b] bg-[linear-gradient(180deg,rgba(13,24,30,0.96),rgba(10,18,23,0.94))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]";
  const bodyTextClass = isLight ? "text-slate-700" : "text-slate-300";
  const headingTextClass = isLight ? "text-slate-950" : "text-white";
  const mutedTextClass = isLight ? "text-slate-600" : "text-slate-400";
  const secretScanPercent = state.secretScanProgress.total > 0
    ? Math.round((state.secretScanProgress.completed / state.secretScanProgress.total) * 100)
    : 0;

  return (
    <div className={shellClassName}>
      <div className="mx-auto flex min-h-screen w-full max-w-[820px] flex-col px-4 py-4">
        <div className={panelClassName}>
          <div className={heroClassName}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-4">
                <div className={`rounded-[26px] border p-3 shadow-[0_16px_50px_rgba(0,0,0,0.12)] ${isLight ? 'border-[#d4e2ec] bg-[#f7fbff]' : 'border-[#35535e] bg-[linear-gradient(180deg,rgba(19,35,43,0.98),rgba(10,19,25,0.98))]'}`}>
                  <img src={Logo} alt="EndPointer logo" className="h-16 w-16 rounded-2xl object-contain" />
                </div>
                <div className="min-w-0">
                  <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.26em] ${isLight ? 'border-[#b7d2e0] bg-[#f3fbff] text-[#14526a]' : 'border-[#345a67] bg-[#10252d]/90 text-[#93d8e9]'}`}>
                    Firefox Endpoint Intelligence
                  </div>
                  <h1 className={`mt-3 bg-clip-text text-5xl font-black tracking-[-0.04em] text-transparent ${isLight ? 'bg-[linear-gradient(135deg,#c84f33_0%,#ef7b57_48%,#b83b2f_100%)]' : 'bg-[linear-gradient(135deg,#fff5f1_10%,#ff8d6c_55%,#ff6c4a_100%)]'}`}>
                    EndPointer
                  </h1>
                  <p className={`mt-3 max-w-[420px] text-sm leading-7 ${bodyTextClass}`}>
                    Parse live pages, inspect discovered endpoints, and move from reconnaissance to triage inside a cleaner, more professional operator console.
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-3">
                <button
                  type="button"
                  onClick={toggleTheme}
                  className={`rounded-full border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] transition-all duration-200 ${
                    isLight
                      ? 'border-[#c8dce7] bg-[#ffffff] text-[#275d72] hover:border-[#7dc8dd]'
                      : 'border-[#355966] bg-[#102129] text-[#9bd9ea] hover:border-[#7ad4e7]'
                  }`}
                >
                  {themeMode === 'dark' ? 'White Mode' : 'Dark Mode'}
                </button>
                <button
                  type="button"
                  onClick={toggleUrlParserState}
                  className={`rounded-full border px-4 py-3 text-xs font-semibold uppercase tracking-[0.22em] transition-all duration-200 ${
                    state.urlParser
                      ? "border-[#79e49a] bg-[linear-gradient(135deg,#133120,#1f4d30)] text-[#d5ffe0] shadow-[0_14px_35px_rgba(22,67,38,0.28)] hover:border-[#b5ffca]"
                      : "border-[#f0a2af] bg-[linear-gradient(135deg,#2a181c,#4b222b)] text-[#ffd6dd] shadow-[0_14px_35px_rgba(70,28,36,0.24)] hover:border-[#ffd3dc]"
                  }`}
                >
                  {state.urlParser ? "Disable Auto Parser" : "Enable Auto Parser"}
                </button>
                <div className={`rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em] ${statusTone}`}>
                  {state.urlParser ? "Auto Parser On" : "Auto Parser Off"}
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-4">
              <div className={cardClassName}>
                <div className={`text-[11px] uppercase tracking-[0.24em] ${isLight ? 'text-[#1d617a]' : 'text-[#83bfd0]'}`}>Discovered URLs</div>
                <div className={`mt-3 text-3xl font-bold ${headingTextClass}`}>{state.urlCount}</div>
                <div className={`mt-2 text-xs ${mutedTextClass}`}>Current endpoint count on the active page.</div>
              </div>
              <div className={cardClassName}>
                <div className={`text-[11px] uppercase tracking-[0.24em] ${isLight ? 'text-[#1d617a]' : 'text-[#83bfd0]'}`}>JavaScript Files</div>
                <div className={`mt-3 text-3xl font-bold ${headingTextClass}`}>{state.jsFileCount}</div>
                <div className={`mt-2 text-xs ${mutedTextClass}`}>Tracked JS assets contributing to extraction.</div>
              </div>
              <div className={cardClassName}>
                <div className={`text-[11px] uppercase tracking-[0.24em] ${isLight ? 'text-[#1d617a]' : 'text-[#83bfd0]'}`}>Scope Rules</div>
                <div className={`mt-3 text-3xl font-bold ${headingTextClass}`}>{state.scopes.length}</div>
                <div className={`mt-2 text-xs ${mutedTextClass}`}>Host boundaries currently applied to parsing.</div>
              </div>
              <div className={cardClassName}>
                <div className={`text-[11px] uppercase tracking-[0.24em] ${isLight ? 'text-[#1d617a]' : 'text-[#83bfd0]'}`}>Secrets</div>
                <div className={`mt-3 text-3xl font-bold ${headingTextClass}`}>{state.secretCount}</div>
                <div className={`mt-2 text-xs ${mutedTextClass}`}>Credential-like findings captured locally.</div>
              </div>
            </div>
          </div>

          <div className="grid gap-5 px-5 py-5">
            <div className="grid gap-3 md:grid-cols-2">
              <ActionButton
                label="Open Analysis Panel"
                href={document.location.origin + "/PopUp/popup.html#urls"}
                variant="primary"
                icon={
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path d="M4 5h16v10H4z" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M8 19h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                }
              />
              <ActionButton
                label="View Secrets"
                href={document.location.origin + "/PopUp/popup.html#secrets"}
                icon={
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path d="M12 3l7 3v5c0 4.5-2.9 8.4-7 10c-4.1-1.6-7-5.5-7-10V6z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                    <path d="M9.5 12.2l1.6 1.6l3.7-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                }
              />
              <ActionButton
                label={state.secretScanProgress.running ? `Scanning Secrets ${secretScanPercent}%` : "Run Secret Scanner"}
                onClick={scanSecrets}
                variant="primary"
                icon={
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path d="M4 11V6a2 2 0 0 1 2-2h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M13 20h5a2 2 0 0 0 2-2v-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M20 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M15 4h5v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M4 20l6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                }
              />
              <ActionButton
                label="Run Reparse"
                onClick={parseURLs}
                icon={
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path d="M20 12a8 8 0 1 1-2.34-5.66" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M20 4v6h-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                }
              />
              <ActionButton
                label="Clear Endpoints"
                onClick={clearURLs}
                variant="danger"
                icon={
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path d="M4 7h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M6 7l1 12h10l1-12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M9 7V4h6v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                }
              />
              <ActionButton
                label="Clear Cache"
                onClick={clearCache}
                icon={
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <ellipse cx="12" cy="5" rx="6.5" ry="2.8" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M5.5 5v6c0 1.55 2.91 2.8 6.5 2.8" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M18.5 7.8V11" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M16.2 19.5h4.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M18.5 17.2v4.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                }
              />
            </div>

            {(state.secretScanProgress.running || state.secretScanProgress.total > 0) && (
              <section className={sectionClassName}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className={`text-[11px] uppercase tracking-[0.24em] ${isLight ? 'text-[#1d617a]' : 'text-[#87c7d8]'}`}>Secret Scanner</div>
                    <h2 className={`mt-2 text-2xl font-bold ${headingTextClass}`}>
                      {state.secretScanProgress.running ? "Scanning captured pages and assets" : "Last scan"}
                    </h2>
                    <p className={`mt-2 max-w-2xl break-all text-sm leading-6 ${mutedTextClass}`}>
                      {state.secretScanProgress.current || "No secret scan has run yet."}
                    </p>
                  </div>
                  <div className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] ${isLight ? 'border-[#cfe0ea] bg-[#f5fbff] text-[#2d7b96]' : 'border-[#355b68] bg-[#12303b] text-[#a4e5f4]'}`}>
                    {state.secretScanProgress.completed}/{state.secretScanProgress.total}
                  </div>
                </div>
                {state.secretScanProgress.running && (
                  <button
                    type="button"
                    onClick={stopSecretScan}
                    className={`mt-5 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition-all duration-200 ${
                      isLight
                        ? 'border-[#f2b0b0] bg-[#fff5f5] text-[#9d2e2e] hover:border-[#d95c5c]'
                        : 'border-[#704047] bg-[#2a161b] text-[#ffc3c9] hover:border-[#f28a96]'
                    }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <rect x="6" y="6" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
                    </svg>
                    Stop Scan
                  </button>
                )}
                <div className={`mt-5 h-3 overflow-hidden rounded-full ${isLight ? 'bg-[#dde8ef]' : 'bg-[#091117]'}`}>
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,#2fd4c8,#8cf6a6)] transition-all duration-300"
                    style={{ width: `${secretScanPercent}%` }}
                  ></div>
                </div>
                <div className={`mt-3 flex flex-wrap justify-between gap-3 text-xs ${mutedTextClass}`}>
                  <span>{secretScanPercent}% complete</span>
                  <span>{state.secretScanProgress.failed} failed</span>
                </div>
              </section>
            )}

            <div className="grid gap-5 md:grid-cols-[1.1fr_0.9fr]">
              <section className={sectionClassName}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className={`text-[11px] uppercase tracking-[0.24em] ${isLight ? 'text-[#1d617a]' : 'text-[#87c7d8]'}`}>Parsing Mode</div>
                    <h2 className={`mt-2 text-2xl font-bold ${headingTextClass}`}>Auto Parser</h2>
                    <p className={`mt-2 text-sm leading-6 ${mutedTextClass}`}>
                      The quick toggle now lives in the top-right header so you can switch modes instantly without scrolling.
                    </p>
                  </div>
                  <div className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] ${statusTone}`}>
                    {state.urlParser ? "Active" : "Inactive"}
                  </div>
                </div>

                <div className={`mt-6 rounded-[26px] border p-4 ${isLight ? 'border-[#d7e5ee] bg-[#ffffff]' : 'border-[#2c4853] bg-[#0f1d23]/92'}`}>
                  <div className="flex items-center justify-between gap-3">
                    <span className={`text-sm font-semibold uppercase tracking-[0.18em] ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>Current State</span>
                    <div className="flex items-center gap-2">
                      <span className={`h-3 w-3 rounded-full ${state.urlParser ? "bg-[#7ef0a0]" : "bg-[#ff7e90]"}`}></span>
                    <span className={`text-sm font-bold ${headingTextClass}`}>{state.urlParser ? "ON" : "OFF"}</span>
                    </div>
                  </div>
                  <div className={`mt-4 h-3 overflow-hidden rounded-full ${isLight ? 'bg-[#dde8ef]' : 'bg-[#091117]'}`}>
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${state.urlParser ? "w-full bg-[linear-gradient(90deg,#2fd4c8,#8cf6a6)]" : "w-[22%] bg-[linear-gradient(90deg,#b94d63,#ff8c7e)]"}`}
                    ></div>
                  </div>
                </div>
              </section>

              <section className={sectionClassName}>
                <div className={`text-[11px] uppercase tracking-[0.24em] ${isLight ? 'text-[#1d617a]' : 'text-[#87c7d8]'}`}>Performance Profile</div>
                <h2 className={`mt-2 text-2xl font-bold ${headingTextClass}`}>Concurrent Requests</h2>
                <p className={`mt-2 text-sm leading-6 ${mutedTextClass}`}>
                  Tune request pressure for big apps. Lower values are safer for accuracy when the target loads many dynamic assets.
                </p>

                <div className={`mt-6 rounded-[26px] border p-4 ${isLight ? 'border-[#d7e5ee] bg-[#ffffff]' : 'border-[#2c4853] bg-[#0f1d23]/92'}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs uppercase tracking-[0.2em] ${mutedTextClass}`}>Request Budget</span>
                    <span className={`rounded-full border px-3 py-1 text-sm font-bold ${isLight ? 'border-[#cfe0ea] bg-[#f5fbff] text-[#2d7b96]' : 'border-[#355b68] bg-[#12303b] text-[#a4e5f4]'}`}>
                      {state.reqAmt}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={state.reqAmt}
                    onChange={handleReqAmt}
                    className="mt-5 h-2 w-full cursor-pointer appearance-none rounded-lg bg-[linear-gradient(90deg,#194252,#2f7082)]"
                  />
                  <div className={`mt-3 flex justify-between text-[11px] uppercase tracking-[0.18em] ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                    <span>Stable</span>
                    <span>Aggressive</span>
                  </div>
                </div>
              </section>
            </div>

            <section className={sectionClassName}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                <div className={`text-[11px] uppercase tracking-[0.24em] ${isLight ? 'text-[#1d617a]' : 'text-[#87c7d8]'}`}>Target Scope</div>
                  <h2 className={`mt-2 text-2xl font-bold ${headingTextClass}`}>Host Boundaries</h2>
                  <p className={`mt-2 max-w-2xl text-sm leading-6 ${mutedTextClass}`}>
                    Keep scope empty to parse across everything you visit, or define domains to focus extraction on a tighter target surface.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={clearAllScopes}
                  className="rounded-full border border-[#6e4b50] bg-[#2a181c] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#ffc0c9] transition-all duration-200 hover:border-[#f59cae]"
                >
                  Clear All
                </button>
              </div>

              <div className="mt-5 flex gap-3">
                <input
                  type="text"
                  ref={inputRef}
                  className={`min-w-0 flex-1 rounded-[22px] border px-4 py-4 text-sm outline-none transition-all duration-200 placeholder:text-slate-500 hover:border-[#5ea9bb] focus:border-[#81d9eb] focus:shadow-[0_0_0_4px_rgba(77,171,197,0.18)] ${isLight ? 'border-[#d3e3ec] bg-[#ffffff] text-slate-900' : 'border-[#355966] bg-[#102129] text-white'}`}
                  placeholder="example.com or www.example.com"
                />
                <button
                  type="button"
                  className="rounded-[22px] border border-[#79d5ea] bg-[linear-gradient(135deg,#17404d,#236376)] px-5 py-4 text-sm font-bold uppercase tracking-[0.14em] text-white transition-all duration-200 hover:border-[#a8ebf8]"
                  onClick={handleAddScope}
                >
                  Add
                </button>
              </div>

              <div className={`mt-5 rounded-[26px] border p-4 ${isLight ? 'border-[#d7e5ee] bg-[#ffffff]' : 'border-[#2d4d58] bg-[#0c161b]/92'}`}>
                {state.scopes.length === 0 ? (
                  <div className={`rounded-[22px] border border-dashed px-4 py-8 text-center ${isLight ? 'border-[#d8e5ed]' : 'border-[#365461]'}`}>
                    <div className={`text-[11px] uppercase tracking-[0.22em] ${isLight ? 'text-[#1d617a]' : 'text-[#87c7d8]'}`}>No Scope Rules</div>
                    <div className={`mt-2 text-sm ${mutedTextClass}`}>EndPointer is currently free to parse all eligible hosts.</div>
                  </div>
                ) : (
                  <div className="flex max-h-44 flex-col gap-3 overflow-auto pr-1">
                    {state.scopes.map((scope, index) => (
                      <div key={index} className={`flex items-center justify-between gap-3 rounded-[20px] border px-4 py-3 ${isLight ? 'border-[#d7e5ee] bg-[#f7fbff]' : 'border-[#31515c] bg-[#112028]'}`}>
                        <span className={`break-all text-sm font-medium ${headingTextClass}`}>{scope}</span>
                        <button
                          type="button"
                          className="rounded-full border border-[#5f454a] bg-[#24161a] p-2 text-rose-300 transition-all duration-200 hover:border-[#ef9aa6]"
                          onClick={() => handleRemoveScope(scope)}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24">
                            <path fill="currentColor" d="M19 12.998H5v-2h14z" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <div className={`flex items-center justify-between gap-4 border-t px-1 pt-1 ${isLight ? 'border-[#d7e5ee]' : 'border-[#1f333b]'}`}>
              <p className={`max-w-xl text-xs leading-6 ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>
                Built for security research and endpoint discovery by the EndPointer contributors. Designed to feel closer to a premium analysis cockpit than a browser utility.
              </p>
              <a
                href="https://github.com/AtlasWiki/endPointer/"
                target="_blank"
                className="rounded-full border border-[#314f5a] bg-[#101d24] p-3 text-slate-300 transition-all duration-200 hover:border-[#79d5ea] hover:text-white"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5c.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34c-.46-1.16-1.11-1.47-1.11-1.47c-.91-.62.07-.6.07-.6c1 .07 1.53 1.03 1.53 1.03c.87 1.52 2.34 1.07 2.91.83c.09-.65.35-1.09.63-1.34c-2.22-.25-4.55-1.11-4.55-4.92c0-1.11.38-2 1.03-2.71c-.1-.25-.45-1.29.1-2.64c0 0 .84-.27 2.75 1.02c.79-.22 1.65-.33 2.5-.33s1.71.11 2.5.33c1.91-1.29 2.75-1.02 2.75-1.02c.55 1.35.2 2.39.1 2.64c.65.71 1.03 1.6 1.03 2.71c0 3.82-2.34 4.66-4.57 4.91c.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2"
                  />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PopUpApp;
