import React, { useMemo, useState } from 'react';
import browser from 'webextension-polyfill';
import { NavBar } from '../components/navbar';
import { SecretFinding } from '../constants/secret_types';
import { useSecretData } from '../hooks/useSecretData';
import { useThemeMode } from '../hooks/useThemeMode';

function severityClass(severity: SecretFinding['severity'], isLight: boolean): string {
  if (severity === 'critical') {
    return isLight ? 'border-[#e08f84] bg-[#fff0ee] text-[#9d372c]' : 'border-[#7d403a] bg-[#351817] text-[#ffc1ba]';
  }

  if (severity === 'high') {
    return isLight ? 'border-[#e6b773] bg-[#fff7e8] text-[#965f14]' : 'border-[#73582a] bg-[#2c2415] text-[#ffd89a]';
  }

  if (severity === 'medium') {
    return isLight ? 'border-[#9fc5e8] bg-[#eef7ff] text-[#246191]' : 'border-[#365a78] bg-[#142637] text-[#b8dbff]';
  }

  return isLight ? 'border-[#cbd5e1] bg-[#f8fafc] text-[#475569]' : 'border-[#3d4b58] bg-[#172029] text-[#cbd5e1]';
}

export function Secrets() {
  const { isLight } = useThemeMode();
  const [selectedLocation, setSelectedLocation] = useState('All');
  const [selectedWebpage, setSelectedWebpage] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState('All');
  const [sortOption, setSortOption] = useState('captured-asc');

  const { secrets, filteredSecrets, locations, webpages } = useSecretData(
    selectedLocation,
    selectedWebpage,
    searchQuery,
    severityFilter,
    sortOption
  );

  const severityCounts = useMemo(() => {
    return secrets.reduce<Record<string, number>>((counts, secret) => {
      counts[secret.severity] = (counts[secret.severity] || 0) + 1;
      return counts;
    }, {});
  }, [secrets]);

  const copySecret = async (secret: string) => {
    await navigator.clipboard.writeText(secret);
  };

  const clearSecrets = async () => {
    await browser.storage.local.set({ 'SECRET-PARSER': {}, secretCount: 0 });
  };

  const downloadSecrets = () => {
    const data = filteredSecrets.map((secret) => ({
      detector: secret.detectorName,
      severity: secret.severity,
      confidence: secret.confidence,
      secret: secret.secret,
      source: secret.foundAt,
      webpage: secret.webpage,
      lineNumber: secret.lineNumber,
      firstSeenAt: secret.firstSeenAt,
      context: secret.context,
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'deeptrace-secrets.json';
    link.click();
  };

  const shellClass = isLight
    ? 'min-h-screen w-full bg-[radial-gradient(circle_at_top_left,_rgba(93,177,201,0.12),_transparent_26%),radial-gradient(circle_at_top_right,_rgba(255,176,145,0.16),_transparent_22%),linear-gradient(180deg,_#f7fbff_0%,_#eef5fb_50%,_#e7eff7_100%)] px-4 pb-12 pt-6 md:px-8'
    : 'min-h-screen w-full bg-[radial-gradient(circle_at_top_left,_rgba(49,110,125,0.18),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(233,108,76,0.10),_transparent_24%),linear-gradient(180deg,_#101920_0%,_#141e24_40%,_#0d151a_100%)] px-4 pb-12 pt-6 md:px-8';
  const panelClass = isLight
    ? 'overflow-hidden rounded-[32px] border border-[#d4e3ec] bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(245,249,253,0.96))] shadow-[0_30px_120px_rgba(0,0,0,0.12)]'
    : 'overflow-hidden rounded-[32px] border border-[#2d4954] bg-[linear-gradient(135deg,rgba(18,30,36,0.96),rgba(15,24,29,0.92))] shadow-[0_30px_120px_rgba(0,0,0,0.35)]';
  const sectionClass = isLight
    ? 'rounded-[28px] border border-[#d6e5ed] bg-[#ffffff] p-4'
    : 'rounded-[28px] border border-[#29424d] bg-[#0e1a20]/85 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]';
  const inputClass = isLight
    ? 'rounded-2xl border border-[#d3e3ec] bg-[#ffffff] px-4 py-4 text-sm text-slate-900 outline-none transition-all duration-200 hover:border-[#4c7d8d] focus:border-[#6cb7ca]'
    : 'rounded-2xl border border-[#335561] bg-[#13252d] px-4 py-4 text-sm text-white outline-none transition-all duration-200 hover:border-[#4c7d8d] focus:border-[#6cb7ca]';

  return (
    <div className={shellClass}>
      {(document.location.pathname.toLowerCase().includes('devtool') && <NavBar />)}

      <div className="mt-5 w-full">
        <div className={panelClass}>
          <div className={`border-b px-6 py-8 md:px-8 ${isLight ? 'border-[#d6e5ed]' : 'border-[#29424d]'}`}>
            <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#315865] bg-[#10262f]/80 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#8cc9db]">
                  Secret Intelligence Panel
                </div>
                <h1 className={`mt-5 max-w-3xl text-3xl font-bold leading-tight md:text-5xl ${isLight ? 'text-slate-900' : 'text-white'}`}>
                  Review leaked credentials discovered while the parser scans pages and JavaScript assets.
                </h1>
                <p className={`mt-4 max-w-2xl text-sm leading-7 md:text-base ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                  Findings are stored locally, masked by default, and grouped with source, webpage, detector, confidence, and surrounding context.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:w-[460px]">
                <div className={sectionClass}>
                  <div className="text-[11px] uppercase tracking-[0.2em] text-[#79b6c9]">Visible Secrets</div>
                  <div className={`mt-3 text-3xl font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>{filteredSecrets.length}</div>
                </div>
                <div className={sectionClass}>
                  <div className="text-[11px] uppercase tracking-[0.2em] text-[#f1b57c]">Critical</div>
                  <div className={`mt-3 text-3xl font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>{severityCounts.critical || 0}</div>
                </div>
              </div>
            </div>
          </div>

          <div className={`border-b px-6 py-5 md:px-8 ${isLight ? 'border-[#d6e5ed]' : 'border-[#29424d]'}`}>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(160px,0.45fr))]">
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className={inputClass}
                placeholder="Search secrets, detector names, context, or source..."
              />
              <select value={selectedLocation} onChange={(event) => setSelectedLocation(event.target.value)} className={inputClass} aria-label="Source filter">
                {locations.map((location) => <option key={location} value={location}>{location}</option>)}
              </select>
              <select value={selectedWebpage} onChange={(event) => setSelectedWebpage(event.target.value)} className={inputClass} aria-label="Webpage filter">
                {webpages.map((webpage) => <option key={webpage} value={webpage}>{webpage}</option>)}
              </select>
              <select value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value)} className={inputClass} aria-label="Severity filter">
                <option value="All">All Severities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <select value={sortOption} onChange={(event) => setSortOption(event.target.value)} className={inputClass} aria-label="Sort secrets">
                <option value="captured-asc">Captured First</option>
                <option value="captured-desc">Captured Last</option>
                <option value="severity-desc">Severity</option>
                <option value="confidence-desc">Confidence</option>
                <option value="source-asc">Source A-Z</option>
              </select>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button type="button" onClick={downloadSecrets} className="rounded-2xl border border-[#3b6b79] bg-[linear-gradient(135deg,#14313c,#1b4552)] px-5 py-3 text-sm font-semibold text-[#c7edf7] transition-all duration-200 hover:border-[#6bb5c8]">
                Export JSON
              </button>
              <button type="button" onClick={clearSecrets} className="rounded-2xl border border-[#7f423a] bg-[linear-gradient(135deg,#3a1715,#612925)] px-5 py-3 text-sm font-semibold text-[#ffd9d4] transition-all duration-200 hover:border-[#e28173]">
                Clear Secrets
              </button>
              <a href={document.location.origin + '/PopUp/popup.html#urls'} target="_blank" className={`rounded-2xl border px-5 py-3 text-sm font-semibold transition-all duration-200 ${isLight ? 'border-[#d3e3ec] bg-[#ffffff] text-slate-900 hover:border-[#8bc7d9]' : 'border-[#355c6a] bg-[#12232b] text-white hover:border-[#7fb8cb]'}`}>
                Endpoints
              </a>
            </div>
          </div>

          <div className="px-2 py-5 md:px-3">
            <div className={`max-h-[760px] overflow-y-auto rounded-[24px] border ${isLight ? 'border-[#d6e5ed] bg-[#f8fbfd]' : 'border-[#28424c] bg-[#0b1418]/80'}`}>
              {filteredSecrets.length === 0 ? (
                <div className={`m-4 rounded-[24px] border border-dashed px-6 py-12 text-center ${isLight ? 'border-[#d6e5ed] bg-[#ffffff]' : 'border-[#365562] bg-[#101c21]/90'}`}>
                  <div className="text-[11px] uppercase tracking-[0.24em] text-[#7fb8cb]">No Secrets</div>
                  <div className={`mt-3 text-2xl font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>No credential findings match the current filters.</div>
                </div>
              ) : (
                <div className="grid gap-3 p-3">
                  {filteredSecrets.map((secret) => {
                    const key = `${secret.captureIndex}-${secret.detectorId}-${secret.secret}`;

                    return (
                      <div key={key} className={`rounded-[24px] border p-4 ${isLight ? 'border-[#d6e5ed] bg-[#ffffff]' : 'border-[#29424d] bg-[#0f1c22]/88'}`}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${severityClass(secret.severity, isLight)}`}>
                                {secret.severity}
                              </span>
                              <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${isLight ? 'border-[#cfe0ea] bg-[#f4fbff] text-[#2d7b96]' : 'border-[#345766] bg-[#12262f] text-[#8dc4d5]'}`}>
                                {secret.confidence}% confidence
                              </span>
                            </div>
                            <div className={`mt-3 text-lg font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>{secret.detectorName}</div>
                          </div>
                          <div className="flex gap-2">
                            <button type="button" onClick={() => copySecret(secret.secret)} className="rounded-xl border border-[#3b6b79] bg-[linear-gradient(135deg,#14313c,#1b4552)] px-3 py-2 text-xs font-semibold text-[#c7edf7]">
                              Copy
                            </button>
                          </div>
                        </div>
                        <div className={`mt-4 max-w-full overflow-hidden break-all rounded-2xl border px-4 py-3 font-mono text-sm leading-6 ${isLight ? 'border-[#d6e5ed] bg-[#f8fbfd] text-slate-900' : 'border-[#304f5a] bg-[#0b161b] text-[#dff7ff]'}`}>
                          {secret.secret}
                        </div>
                        <div className={`mt-4 grid gap-3 text-xs md:grid-cols-3 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                          <div className="min-w-0 break-all"><span className="font-semibold uppercase tracking-[0.16em] text-[#7fb8cb]">Source</span><br />{secret.foundAt}</div>
                          <div className="min-w-0 break-all"><span className="font-semibold uppercase tracking-[0.16em] text-[#7fb8cb]">Webpage</span><br />{secret.webpage}</div>
                          <div><span className="font-semibold uppercase tracking-[0.16em] text-[#7fb8cb]">Line</span><br />{secret.lineNumber}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
