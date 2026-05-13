import { Endpoint } from "../constants/message_types";
import { useURLData } from '../hooks/useURLData';
import { useThemeMode } from '../hooks/useThemeMode';


export function URLsPlain() {
  const { isLight } = useThemeMode();
  const { urls } = useURLData("", "", "", 0, 0, {}, "url-asc");

  // Function to sanitize URLs
  const sanitizedURL = (endpoint: Endpoint) => {
    let verifiedURL: string;
    const cleanedWebpage = endpoint.webpage.replace(/\/$/, '').split('#')[0];

    if (endpoint.url && (endpoint.url.startsWith("http://") || endpoint.url.startsWith("https://"))) {
      verifiedURL = endpoint.url;
    } else if (endpoint.url.startsWith('/')) {
      verifiedURL = cleanedWebpage + endpoint.url;
    } else {
      verifiedURL = cleanedWebpage + '/' + endpoint.url;
    }
    verifiedURL = verifiedURL.replace(/([^:]\/)\/+/g, "$1");

    return verifiedURL;
  };

  // Function to download URLs as a .txt file
  const downloadURLsAsTxt = () => {
    const urlStrings = urls.map(sanitizedURL).join('\n'); // Join URLs as newline-separated strings
    const blob = new Blob([urlStrings], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'urls.txt';
    link.click();
  };

  const previewRows = urls.map(sanitizedURL);
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
          <div className="text-lg font-semibold">Resolved text export</div>
          <div className={`mt-1 text-sm ${mutedTextClass}`}>
            Relative paths are converted to full URLs using the root webpage.
          </div>
        </div>
        <button onClick={downloadURLsAsTxt} className={`rounded-lg border px-5 py-3 text-sm font-semibold transition-all duration-200 ${actionClass}`}>
          Download TXT
        </button>
      </div>

      <div className={`rounded-lg border p-4 ${panelClass}`}>
        <div className={`rounded-lg border px-4 py-3 text-sm leading-6 ${codeClass}`}>
          <div className="font-semibold">Format</div>
          <div className={mutedTextClass}>root webpage + relative path, plus absolute URLs as captured</div>
        </div>

        <div className={`mt-4 max-h-[620px] overflow-auto rounded-lg border font-mono text-sm leading-6 ${codeClass}`}>
          {previewRows.length === 0 ? (
            <div className={`px-4 py-8 text-center font-sans ${mutedTextClass}`}>No endpoints available to export.</div>
          ) : (
            previewRows.map((url, index) => (
              <div key={`${url}-${index}`} className={`border-b px-4 py-2 last:border-b-0 ${isLight ? 'border-[#edf3f7]' : 'border-[#172b33]'}`}>
                {url}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
