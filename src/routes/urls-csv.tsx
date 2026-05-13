import { useURLData } from '../hooks/useURLData';
import { useThemeMode } from '../hooks/useThemeMode';

export function URLsCSV() {
  const { isLight } = useThemeMode();
  const { urls } = useURLData("", "", "", 0, 0, {}, "url-asc");

  const csvHeader = ['Endpoint', 'Source', 'Webpage'];

  const escapeCsvField = (value: string) => {
    return `"${value.replace(/"/g, '""')}"`;
  };
  
  // Function to download URLs as a .csv file
  const downloadURLsAsCsv = () => {
    const csvRows = [
      csvHeader.map(escapeCsvField).join(','),
      ...urls.map((endpoint) => [
        endpoint.url,
        endpoint.foundAt,
        endpoint.webpage
      ].map(escapeCsvField).join(','))
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'urls.csv';
    link.click();
  };

  const csvPreview = [
    csvHeader.map(escapeCsvField).join(','),
    ...urls.map((endpoint) => [
      endpoint.url,
      endpoint.foundAt,
      endpoint.webpage
    ].map(escapeCsvField).join(','))
  ].join('\n');

  const actionClass = isLight
    ? 'border-[#8bc7d9] bg-[linear-gradient(135deg,#edf8fc,#dff1f8)] text-[#1f5f74] hover:border-[#6bb5c8]'
    : 'border-[#3b6b79] bg-[linear-gradient(135deg,#14313c,#1b4552)] text-[#c7edf7] hover:border-[#6bb5c8]';
  const panelClass = isLight ? 'border-[#d6e5ed] bg-[#f8fbfd]' : 'border-[#28424c] bg-[#0b1418]/80';
  const codeClass = isLight ? 'border-[#d6e5ed] bg-white text-slate-900' : 'border-[#304f5a] bg-[#081116] text-[#dff7ff]';
  const mutedTextClass = isLight ? 'text-slate-600' : 'text-slate-400';
  const tableHeaderClass = isLight ? 'bg-[#eef6fb] text-[#1f5f74]' : 'bg-[#0f1b20] text-[#8fd2e2]';

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-lg font-semibold">CSV export</div>
          <div className={`mt-1 text-sm ${mutedTextClass}`}>
            Saves three columns: Endpoint, Source, and Webpage.
          </div>
        </div>
        <button onClick={downloadURLsAsCsv} className={`rounded-lg border px-5 py-3 text-sm font-semibold transition-all duration-200 ${actionClass}`}>
          Download CSV
        </button>
      </div>

      <div className={`rounded-lg border p-4 ${panelClass}`}>
        <div className={`rounded-lg border px-4 py-3 font-mono text-sm ${codeClass}`}>
          "Endpoint","Source","Webpage"
        </div>

        <div className={`mt-4 max-h-[620px] overflow-auto rounded-lg border ${codeClass}`}>
          {urls.length === 0 ? (
            <div className={`px-4 py-8 text-center ${mutedTextClass}`}>No endpoints available to export.</div>
          ) : (
            <table className="w-full min-w-[920px] table-fixed text-left text-sm">
              <thead className={`sticky top-0 z-10 ${tableHeaderClass}`}>
                <tr>
                  {csvHeader.map((header) => (
                    <th key={header} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.22em]">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="font-mono">
                {urls.map((endpoint, index) => (
                  <tr key={`${endpoint.webpage}-${endpoint.foundAt}-${endpoint.url}-${index}`} className={`border-t align-top ${isLight ? 'border-[#edf3f7]' : 'border-[#172b33]'}`}>
                    <td className="break-all px-4 py-3">{endpoint.url}</td>
                    <td className="break-all px-4 py-3">{endpoint.foundAt}</td>
                    <td className="break-all px-4 py-3">{endpoint.webpage}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <details className="mt-4">
          <summary className={`cursor-pointer text-sm font-semibold ${isLight ? 'text-[#1f5f74]' : 'text-[#8fd2e2]'}`}>
            View raw CSV
          </summary>
          <pre className={`mt-3 max-h-80 overflow-auto rounded-lg border p-4 font-mono text-sm leading-6 ${codeClass}`}>
            {csvPreview}
          </pre>
        </details>
      </div>
    </div>
  );
}
