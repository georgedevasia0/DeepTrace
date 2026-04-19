import React, { useState, useEffect } from 'react';
import { Endpoint, HttpMethod, ResponseDetails } from '../../constants/message_types';
import { sanitizeURL } from '../../utils/defaultview_utils';
import { HTTP_METHODS } from '../../constants/defaultview_contants';
import browser from 'webextension-polyfill';
import { sendRequest } from '../../utils/request_Util';

interface SeeResponseModalProps {
  endpoint: Endpoint;
  onClose: () => void;
}

export const SeeResponseModal: React.FC<SeeResponseModalProps> = ({ endpoint, onClose }) => {
  const [responses, setResponses] = useState<Record<HttpMethod, ResponseDetails>>({} as Record<HttpMethod, ResponseDetails>);
  const [currentMethod, setCurrentMethod] = useState<HttpMethod>("GET");
  const [activeTab, setActiveTab] = useState<'request' | 'response'>('response');
  const [isEditing, setIsEditing] = useState(false);
  const [editableRequest, setEditableRequest] = useState({
    url: sanitizeURL(endpoint),
    method: 'GET' as HttpMethod,
    headers: {} as Record<string, string>,
    body: '',
  });
  const [currentRequest, setCurrentRequest] = useState<{
    url: string;
    method: HttpMethod;
    headers: Record<string, string>;
    body: string;
  }>({
    url: sanitizeURL(endpoint),
    method: 'GET',
    headers: {},
    body: '',
  });

  useEffect(() => {
    HTTP_METHODS.forEach(method => sendHttpRequest(method));
  }, []);

  const sectionLabelClass = "text-xs font-semibold uppercase tracking-[0.18em] text-[#7fb8cb]";
  const sectionValueClass = "mt-2 whitespace-pre-wrap break-words rounded-2xl border border-[#223740] bg-[#101c21] px-4 py-3 text-sm leading-6 text-[#e7f7fb]";
  const inputClass = "w-full rounded-2xl border border-[#335561] bg-[#13252d] px-4 py-3 text-sm text-white outline-none transition-all duration-200 placeholder:text-slate-500 focus:border-[#6cb7ca]";
  const primaryButtonClass = "rounded-2xl border border-[#3b6b79] bg-[linear-gradient(135deg,#14313c,#1b4552)] px-4 py-3 text-sm font-semibold text-[#daf8ff] transition-all duration-200 hover:border-[#6bb5c8]";
  const secondaryButtonClass = "rounded-2xl border border-[#355a67] bg-[#13252d] px-4 py-3 text-sm font-semibold text-[#daf8ff] transition-all duration-200 hover:border-[#7ad4e7]";
  const dangerButtonClass = "rounded-2xl border border-[#7f423a] bg-[linear-gradient(135deg,#3a1715,#612925)] px-4 py-3 text-sm font-semibold text-[#ffd9d4] transition-all duration-200 hover:border-[#e28173]";

  const sendHttpRequest = async (method: HttpMethod, customRequest?: typeof editableRequest) => {
    try {
      const requestToSend = customRequest || {
        url: sanitizeURL(endpoint),
        method,
        headers: {},
        body: method === 'GET' ? undefined : ''
      };

      const response = await browser.runtime.sendMessage({
        action: 'sendRequest',
        endpoint,
        method,
        customRequest: requestToSend
      });

      setResponses(prev => ({ ...prev, [method]: response }));
    } catch (error) {
      console.error(`Error sending ${method} request:`, error);
      setResponses(prev => ({
        ...prev,
        [method]: {
          success: false,
          url: customRequest?.url || sanitizeURL(endpoint),
          status: 0,
          statusText: 'Error',
          headers: { 'Error': (error as Error).toString() },
          body: 'Failed to fetch'
        }
      }));
    }
  };

  const handleEditRequest = () => {
    setIsEditing(true);
    const currentResponse = responses[currentMethod];
    setEditableRequest({
      url: currentResponse?.url || sanitizeURL(endpoint),
      method: currentMethod,
      headers: currentResponse?.headers ? { ...currentResponse.headers } : {},
      body: currentMethod === 'GET' ? '' : (currentResponse?.body || ''),
    });
  };

  const handleHeaderChange = (index: number, key: string, value: string) => {
    setEditableRequest(prev => {
      const newHeaders = { ...prev.headers };
      const oldKey = Object.keys(newHeaders)[index];
      if (oldKey !== key) {
        delete newHeaders[oldKey];
      }
      newHeaders[key] = value;
      return { ...prev, headers: newHeaders };
    });
  };

  const handleRemoveHeader = (key: string) => {
    setEditableRequest(prev => {
      const newHeaders = { ...prev.headers };
      delete newHeaders[key];
      return { ...prev, headers: newHeaders };
    });
  };

  const handleAddHeader = () => {
    setEditableRequest(prev => {
      const newHeaders = { ...prev.headers, '': '' };
      return { ...prev, headers: newHeaders };
    });
  };

  const handleSaveRequest = async () => {
    setIsEditing(false);

    const filteredHeaders = Object.fromEntries(
      Object.entries(editableRequest.headers).filter(([key, value]) => key.trim() !== '' && value.trim() !== '')
    );

    const updatedRequest = {
      ...editableRequest,
      headers: filteredHeaders,
    };

    setCurrentRequest(updatedRequest);

    await sendHttpRequest(updatedRequest.method as HttpMethod, updatedRequest);
    setCurrentMethod(updatedRequest.method as HttpMethod);
  };

  const handleMethodChange = (newMethod: HttpMethod) => {
    setCurrentMethod(newMethod);
    if (newMethod === 'GET') {
      setEditableRequest(prev => ({ ...prev, body: '' }));
    }
    if (!responses[newMethod]) {
      sendHttpRequest(newMethod);
    }
  };

  const currentResponse = responses[currentMethod];

  return (
    <div className="flex max-h-[calc(90vh-40px)] flex-col">
      <div className="flex items-start justify-between gap-4 border-b border-[#29424d] pb-4">
        <div className="min-w-0">
          <h3 className="text-xl font-bold text-white">Request / Response Details</h3>
          <p className="mt-2 break-all text-sm text-[#9fc1cc]">{sanitizeURL(endpoint)}</p>
        </div>
        <button className={secondaryButtonClass} onClick={onClose}>
          Close
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          className={activeTab === 'request' ? primaryButtonClass : secondaryButtonClass}
          onClick={() => setActiveTab('request')}
        >
          Request
        </button>
        <button
          className={activeTab === 'response' ? primaryButtonClass : secondaryButtonClass}
          onClick={() => setActiveTab('response')}
        >
          Response
        </button>
      </div>

      <div className="mt-4 flex-1 overflow-auto rounded-[22px] border border-[#29424d] bg-[#0b1418] p-4">
        {activeTab === 'request' ? (
          isEditing ? (
            <div className="space-y-4">
              <div>
                <div className={sectionLabelClass}>Method</div>
                <select
                  className={`${inputClass} mt-2`}
                  value={editableRequest.method}
                  onChange={(e) => setEditableRequest(prev => ({ ...prev, method: e.target.value as HttpMethod, body: e.target.value === 'GET' ? '' : prev.body }))}
                >
                  {HTTP_METHODS.map(method => (
                    <option key={method} value={method}>{method}</option>
                  ))}
                </select>
              </div>

              <div>
                <div className={sectionLabelClass}>URL</div>
                <input
                  className={`${inputClass} mt-2`}
                  value={editableRequest.url}
                  onChange={(e) => setEditableRequest(prev => ({ ...prev, url: e.target.value }))}
                />
              </div>

              <div>
                <div className={sectionLabelClass}>Headers</div>
                <div className="mt-2 space-y-2">
                  {Object.entries(editableRequest.headers).map(([key, value], index) => (
                    <div key={index} className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                      <input
                        className={inputClass}
                        value={key}
                        onChange={(e) => handleHeaderChange(index, e.target.value, value)}
                        placeholder="Header name"
                      />
                      <input
                        className={inputClass}
                        value={value}
                        onChange={(e) => handleHeaderChange(index, key, e.target.value)}
                        placeholder="Header value"
                      />
                      <button className={dangerButtonClass} onClick={() => handleRemoveHeader(key)}>
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className={primaryButtonClass} onClick={handleAddHeader}>Add Header</button>
                  <button className={dangerButtonClass} onClick={() => setEditableRequest(prev => ({ ...prev, headers: {} }))}>Clear Headers</button>
                </div>
              </div>

              <div>
                <div className={sectionLabelClass}>Body</div>
                <textarea
                  className={`${inputClass} mt-2 min-h-40`}
                  value={editableRequest.body}
                  onChange={(e) => setEditableRequest(prev => ({ ...prev, body: e.target.value }))}
                  disabled={editableRequest.method === 'GET'}
                  placeholder={editableRequest.method === 'GET' ? 'Body not allowed for GET requests' : ''}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button className={primaryButtonClass} onClick={handleSaveRequest}>Save and Send</button>
                <button className={secondaryButtonClass} onClick={() => setIsEditing(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <div className={sectionLabelClass}>Request URL</div>
                <div className={sectionValueClass}>{currentRequest.url}</div>
              </div>
              <div>
                <div className={sectionLabelClass}>Request Method</div>
                <div className={sectionValueClass}>{currentRequest.method}</div>
              </div>
              <div>
                <div className={sectionLabelClass}>Request Headers</div>
                <div className={sectionValueClass}>
                  {Object.entries(currentRequest.headers).length > 0
                    ? Object.entries(currentRequest.headers).map(([key, value]) => `${key}: ${value}`).join('\n')
                    : 'No headers'}
                </div>
              </div>
              {currentRequest.method !== 'GET' && (
                <div>
                  <div className={sectionLabelClass}>Request Body</div>
                  <div className={sectionValueClass}>{currentRequest.body || 'No body'}</div>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <button className={primaryButtonClass} onClick={handleEditRequest}>Edit Request</button>
                <button className={dangerButtonClass} onClick={() => sendRequest(currentRequest)}>Send</button>
              </div>
            </div>
          )
        ) : (
          <div className="space-y-4">
            <div>
              <div className={sectionLabelClass}>Method</div>
              <select
                className={`${inputClass} mt-2`}
                value={currentMethod}
                onChange={(e) => handleMethodChange(e.target.value as HttpMethod)}
              >
                {HTTP_METHODS.map(method => (
                  <option key={method} value={method}>
                    [{responses[method]?.status || 'N/A'}] {responses[method]?.statusText || 'N/A'} {method}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className={sectionLabelClass}>Response URL</div>
              <div className={sectionValueClass}>{currentResponse?.url || 'N/A'}</div>
            </div>
            <div>
              <div className={sectionLabelClass}>Response Headers</div>
              <div className={sectionValueClass}>
                {Object.entries(currentResponse?.headers || {}).length > 0
                  ? Object.entries(currentResponse?.headers || {}).map(([key, value]) => `${key}: ${value}`).join('\n')
                  : 'No headers'}
              </div>
            </div>
            <div>
              <div className={sectionLabelClass}>Response Body</div>
              <div className={`${sectionValueClass} max-h-[340px] overflow-auto`}>{currentResponse?.body || 'N/A'}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
