import React, { useState, useEffect } from 'react';
import { Endpoint } from '../../constants/message_types';
import { sanitizeURL, fetchWithTimeout } from '../../utils/defaultview_utils';
import { FETCH_TIMEOUT } from '../../constants/defaultview_contants';
import { js as beautify } from 'js-beautify';

interface ViewCodeModalProps {
  endpoint: Endpoint;
  onClose: () => void;
}

export const ViewCodeModal: React.FC<ViewCodeModalProps> = ({ endpoint, onClose }) => {
  const [codeSnippet, setCodeSnippet] = useState<string[]>([]);
  const [keywordHits, setKeywordHits] = useState<string[]>([]);

  useEffect(() => {
    fetchCodeSnippet();
  }, [endpoint]);

  const fetchCodeSnippet = async () => {
    try {
      const response = await fetchWithTimeout(endpoint.foundAt, {}, FETCH_TIMEOUT);
      const code = await response.text();
      const beautifiedCode = beautify(code);
      const regex = new RegExp(`(?:^.*?(?:\\n.*?){0,1}(${endpoint.url}).*?(?:\\n.*?){0,1})`, 'gs');
      const keyRegex = new RegExp(`${endpoint.url}`, 'gs');
      
      const matches = beautifiedCode.match(regex);
      const keywordMatches = beautifiedCode.match(keyRegex); 

      setCodeSnippet(matches || []);
      setKeywordHits(keywordMatches || []); 
    } catch (error) {
      console.error("Failed to fetch code snippet:", error);
      setCodeSnippet(["Failed to fetch code snippet"]);
      setKeywordHits([]);
    }
  };

  return (
    <div className="flex max-h-[calc(90vh-40px)] flex-col">
      <div className="flex items-start justify-between gap-4 border-b border-[#29424d] pb-4">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-white">View Code Snippet</h2>
          <p className="mt-2 break-all text-sm text-[#9fc1cc]">{sanitizeURL(endpoint)}</p>
          <p className="mt-2 text-sm font-semibold text-[#8fd2e2]">{keywordHits.length} hits found in {endpoint.foundAt}</p>
        </div>
        <button className="rounded-2xl border border-[#355a67] bg-[#13252d] px-4 py-2 text-sm font-semibold text-[#daf8ff] transition-all duration-200 hover:border-[#7ad4e7]" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="mt-4 flex-1 overflow-auto rounded-[22px] border border-[#29424d] bg-[#0b1418] p-4">
        {codeSnippet.length === 0 ? (
          <div className="text-sm text-[#9fc1cc]">No matching snippet found.</div>
        ) : (
          <div className="space-y-4">
            {codeSnippet.map((snippet, index) => (
              <div key={index} className="overflow-auto rounded-2xl border border-[#223740] bg-[#101c21]">
                <div className="border-b border-[#223740] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#7fb8cb]">
                  Match {index + 1}
                </div>
                <pre className="m-0 overflow-auto whitespace-pre-wrap break-words px-4 py-4 text-[13px] leading-6 text-[#e7f7fb]">
                  <code>{snippet}</code>
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
