import { useURLData } from '../hooks/useURLData';
import { useThemeMode } from '../hooks/useThemeMode';

export function URLsUnmodified() {
  const { isLight } = useThemeMode();
  const { urls } = useURLData("", "", "", 0, 0, {}, "url-asc");

  // Function to download URLs as a .txt file
  const downloadURLsAsTxt = () => {
    const urlStrings = urls.map((endpoint) => endpoint.url).join('\n'); // Extract only the URLs
    const blob = new Blob([urlStrings], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'urls-unmodified.txt';
    link.click();
  };

  const actionClass = isLight
    ? 'border-[#8bc7d9] bg-[linear-gradient(135deg,#edf8fc,#dff1f8)] text-[#1f5f74] hover:border-[#6bb5c8]'
    : 'border-[#3b6b79] bg-[linear-gradient(135deg,#14313c,#1b4552)] text-[#c7edf7] hover:border-[#6bb5c8]';
  const panelClass = isLight ? 'border-[#d6e5ed] bg-[#f8fbfd]' : 'border-[#28424c] bg-[#0b1418]/80';
  const codeClass = isLight ? 'border-[#d6e5ed] bg-white text-slate-900' : 'border-[#304f5a] bg-[#081116] text-[#dff7ff]';
  const mutedTextClass = isLight ? 'text-slate-600' : 'text-slate-400';

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-lg font-semibold">Raw text export</div>
          <div className={`mt-1 text-sm ${mutedTextClass}`}>
            Preserves relative paths and absolute URLs exactly as captured.
          </div>
        </div>
        <button onClick={downloadURLsAsTxt} className={`rounded-lg border px-5 py-3 text-sm font-semibold transition-all duration-200 ${actionClass}`}>
          Download RAW TXT
        </button>
      </div>

      <div className={`rounded-lg border p-4 ${panelClass}`}>
        <div className={`rounded-lg border px-4 py-3 text-sm leading-6 ${codeClass}`}>
          <div className="font-semibold">Format</div>
          <div className={mutedTextClass}>one captured endpoint per line, without URL resolution</div>
        </div>

        <div className={`mt-4 max-h-[620px] overflow-auto rounded-lg border font-mono text-sm leading-6 ${codeClass}`}>
          {urls.length === 0 ? (
            <div className={`px-4 py-8 text-center font-sans ${mutedTextClass}`}>No endpoints available to export.</div>
          ) : (
            urls.map((endpoint, index) => (
              <div key={`${endpoint.url}-${index}`} className={`border-b px-4 py-2 last:border-b-0 ${isLight ? 'border-[#edf3f7]' : 'border-[#172b33]'}`}>
                {endpoint.url}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
