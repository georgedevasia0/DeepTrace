import { useState } from 'react';
import { URLsPlain } from './urls-plain'
import { URLsCSV } from './urls-csv'
import { URLsUnmodified } from './urls-unmodified'
import { useThemeMode } from '../hooks/useThemeMode';
import { useURLData } from '../hooks/useURLData';

type OutputSelection = 'txt' | 'csv' | 'unmodified';

const outputTabs: Array<{
    id: OutputSelection;
    label: string;
    title: string;
    description: string;
}> = [
    {
        id: 'txt',
        label: 'TXT',
        title: 'Resolved URL List',
        description: 'Relative endpoints are resolved against their root webpage before download.'
    },
    {
        id: 'csv',
        label: 'CSV',
        title: 'Endpoint Inventory',
        description: 'Exports the exact endpoint, source, and webpage columns for spreadsheet review.'
    },
    {
        id: 'unmodified',
        label: 'RAW',
        title: 'Original Capture',
        description: 'Keeps every endpoint exactly as it was captured from the page or script.'
    }
];

export function URLsOutput() {
    const { isLight } = useThemeMode();
    const { urls, jsFiles, webpages } = useURLData("", "", "", 0, 0, {}, "url-asc");
    const [selection, setSelection] = useState<OutputSelection>("txt");
    const activeTab = outputTabs.find((tab) => tab.id === selection) ?? outputTabs[0];

    const shellClass = isLight
        ? 'min-h-screen bg-[linear-gradient(180deg,#f7fbfe,#edf5f9)] px-4 py-6 text-slate-900 md:px-8'
        : 'min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(39,84,99,0.25),transparent_34%),linear-gradient(180deg,#091217,#0d171c)] px-4 py-6 text-white md:px-8';

    const panelClass = isLight
        ? 'border-[#d6e5ed] bg-white shadow-[0_24px_90px_rgba(18,52,67,0.12)]'
        : 'border-[#29424d] bg-[linear-gradient(135deg,rgba(16,30,36,0.96),rgba(10,19,24,0.96))] shadow-[0_24px_90px_rgba(0,0,0,0.32)]';

    const mutedTextClass = isLight ? 'text-slate-600' : 'text-slate-300';
    const statClass = isLight ? 'border-[#d6e5ed] bg-[#f8fbfd]' : 'border-[#29424d] bg-[#0b161b]/80';

    return (
        <div className={shellClass}>
            <div className={`mx-auto max-w-7xl overflow-hidden rounded-lg border ${panelClass}`}>
                <div className={`border-b px-5 py-6 md:px-8 ${isLight ? 'border-[#d6e5ed]' : 'border-[#29424d]'}`}>
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                            <div className={`text-xs font-semibold uppercase tracking-[0.28em] ${isLight ? 'text-[#2d7b96]' : 'text-[#8fd2e2]'}`}>
                                Output
                            </div>
                            <h1 className="mt-3 text-3xl font-bold leading-tight md:text-4xl">
                                Export endpoints
                            </h1>
                            <p className={`mt-3 max-w-2xl text-sm leading-6 md:text-base ${mutedTextClass}`}>
                                Choose the file shape you need, preview the exact rows, then download the current endpoint corpus.
                            </p>
                        </div>
                    </div>
                </div>

                <div className={`border-b px-5 py-5 md:px-8 ${isLight ? 'border-[#d6e5ed]' : 'border-[#29424d]'}`}>
                    <div className={`inline-grid w-full grid-cols-3 gap-1 rounded-lg border p-1 md:w-auto ${isLight ? 'border-[#d3e3ec] bg-[#eef6fb]' : 'border-[#325260] bg-[#0b151a]'}`}>
                        {outputTabs.map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setSelection(tab.id)}
                                className={`rounded-md px-4 py-3 text-sm font-semibold transition-all duration-200 md:min-w-36 ${
                                    selection === tab.id
                                        ? isLight
                                            ? 'bg-white text-[#1f5f74] shadow-[0_8px_22px_rgba(31,95,116,0.12)]'
                                            : 'bg-[#183540] text-[#dff8ff] shadow-[0_10px_30px_rgba(0,0,0,0.25)]'
                                        : isLight
                                            ? 'text-slate-600 hover:bg-white/70 hover:text-slate-900'
                                            : 'text-slate-300 hover:bg-[#13262e] hover:text-white'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                    <div className="mt-5">
                        <div className="text-xl font-semibold">{activeTab.title}</div>
                        <div className={`mt-1 text-sm leading-6 ${mutedTextClass}`}>{activeTab.description}</div>
                    </div>
                </div>

                <div className="px-5 py-6 md:px-8">
                    {selection === "txt" && <URLsPlain />}
                    {selection === "csv" && <URLsCSV />}
                    {selection === "unmodified" && <URLsUnmodified />}
                </div>
            </div>
        </div>
    );
}
