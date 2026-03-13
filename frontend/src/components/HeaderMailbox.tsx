import React, { useState, useRef, useEffect, useContext } from 'react';
import { createRandomMailbox, createCustomMailbox } from '../utils/api';
import MailboxSwitcher from './MailboxSwitcher';
import { MailboxContext } from '../contexts/MailboxContext';
import { getEmailDomains } from '../config';

interface HeaderMailboxProps {
  mailbox: Mailbox | null;
  onMailboxChange: (mailbox: Mailbox) => void;
  isLoading: boolean;
}

const HeaderMailbox: React.FC<HeaderMailboxProps> = ({ mailbox, onMailboxChange, isLoading }) => {
  const { showSuccessMessage, showErrorMessage } = useContext(MailboxContext);
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customAddress, setCustomAddress] = useState('');
  const [domains, setDomains] = useState<string[]>([]);
  const [selectedDomain, setSelectedDomain] = useState('');
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [customAddressError, setCustomAddressError] = useState<string | null>(null);

  useEffect(() => {
    getEmailDomains().then(d => { setDomains(d); if (d.length > 0) setSelectedDomain(d[0]); });
  }, []);
  
  if (!mailbox || isLoading) return null;
  
  const copyToClipboard = () => {
    const fullAddress = mailbox.address.includes('@') ? mailbox.address : `${mailbox.address}@${selectedDomain}`;
    navigator.clipboard.writeText(fullAddress)
      .then(() => showSuccessMessage('邮箱地址已复制'))
      .catch(() => showErrorMessage('复制失败'));
  };
  
  const handleRefreshMailbox = async () => {
    setIsActionLoading(true);
    const result = await createRandomMailbox();
    setIsActionLoading(false);
    if (result.success && result.mailbox) {
      onMailboxChange(result.mailbox);
      showSuccessMessage('邮箱更换成功');
    } else {
      showErrorMessage('邮箱更换失败');
    }
  };
  
  const handleCreateCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    setCustomAddressError(null);
    if (!customAddress.trim()) { setCustomAddressError('无效的邮箱地址'); return; }
    setIsActionLoading(true);
    const result = await createCustomMailbox(customAddress);
    setIsActionLoading(false);
    if (result.success && result.mailbox) {
      onMailboxChange(result.mailbox);
      showSuccessMessage('邮箱创建成功');
      setTimeout(() => { setIsCustomMode(false); setCustomAddress(''); }, 1500);
    } else {
      const isExists = result.error === 'Address already exists' || String(result.error).includes('已存在');
      if (isExists) setCustomAddressError('邮箱地址已存在');
      else showErrorMessage('邮箱创建失败');
    }
  };
  
  const handleCancelCustom = () => { setIsCustomMode(false); setCustomAddress(''); setCustomAddressError(null); };
  
  const buttonBase = "flex items-center justify-center rounded-md transition-all duration-200";
  
  return (
    <div className="flex items-center">
      {isCustomMode ? (
        <form onSubmit={handleCreateCustom} className="flex flex-col space-y-2">
          <div className="flex items-center space-x-2">
            <div className="flex items-center">
              <input
                type="text" value={customAddress}
                onChange={(e) => { setCustomAddress(e.target.value); if (customAddressError) setCustomAddressError(null); }}
                className={`w-32 md:w-40 px-2 py-1 text-sm border rounded-l-md focus:outline-none focus:ring-1 focus:ring-primary ${customAddressError ? 'border-red-500' : ''}`}
                placeholder="自定义地址" disabled={isActionLoading} autoFocus
              />
              <span className="flex items-center px-2 py-1 text-sm border-y border-r rounded-r-md bg-muted">
                @
                <div className="relative">
                  <select value={selectedDomain} onChange={(e) => setSelectedDomain(e.target.value)} className="appearance-none bg-transparent border-none focus:outline-none pl-1 pr-5">
                    {domains.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <i className="fas fa-chevron-down absolute right-0 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none"></i>
                </div>
              </span>
            </div>
            <button type="button" onClick={handleCancelCustom} className="px-2 py-1 text-sm rounded-md bg-muted text-muted-foreground hover:bg-muted/80" disabled={isActionLoading}>取消</button>
            <button type="submit" className="px-2 py-1 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/80" disabled={isActionLoading}>
              {isActionLoading ? '加载中...' : '创建'}
            </button>
          </div>
          {customAddressError && <div className="text-red-500 text-xs px-1">{customAddressError}</div>}
        </form>
      ) : (
        <div className="flex items-center">
          <div className="hidden sm:flex items-center">
            <code className="bg-muted px-2 py-1 rounded text-sm font-medium flex items-center">
              {mailbox.address}@
              <div className="relative">
                <select value={selectedDomain} onChange={(e) => setSelectedDomain(e.target.value)} className="appearance-none bg-transparent border-none focus:outline-none pl-1 pr-4 font-medium">
                  {domains.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <i className="fas fa-chevron-down absolute right-0 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none"></i>
              </div>
            </code>
            <MailboxSwitcher currentMailbox={mailbox} onSwitchMailbox={onMailboxChange} domain={selectedDomain} />
            <button onClick={copyToClipboard} className={`w-8 h-8 ${buttonBase} hover:bg-primary/20 hover:text-primary hover:scale-110 mx-1`} title="复制">
              <i className="fas fa-copy text-sm"></i>
            </button>
            <button onClick={handleRefreshMailbox} className={`w-8 h-8 ${buttonBase} bg-muted hover:bg-primary/20 hover:text-primary hover:scale-110 mr-1`} disabled={isActionLoading} title="更换邮箱">
              <i className="fas fa-sync-alt text-sm"></i>
            </button>
            <button onClick={() => setIsCustomMode(true)} className={`w-8 h-8 ${buttonBase} bg-primary text-primary-foreground hover:bg-primary/80 hover:scale-110`} disabled={isActionLoading} title="自定义邮箱">
              <i className="fas fa-edit text-sm"></i>
            </button>
          </div>
          
          {/* 移动端 */}
          <div className="flex sm:hidden items-center flex-col">
            <div className="flex items-center">
              <code className="bg-muted px-2 py-1 rounded text-xs font-medium truncate max-w-[120px]">{mailbox.address}@{selectedDomain}</code>
              <div className="transform scale-75 origin-right -mr-1"><MailboxSwitcher currentMailbox={mailbox} onSwitchMailbox={onMailboxChange} domain={selectedDomain} /></div>
              <button onClick={copyToClipboard} className={`w-6 h-6 ${buttonBase} hover:bg-primary/20 hover:text-primary hover:scale-110 mx-1`} title="复制"><i className="fas fa-copy text-xs"></i></button>
            </div>
            <div className="flex items-center">
              <button onClick={handleRefreshMailbox} className={`w-6 h-6 ${buttonBase} bg-muted hover:bg-primary/20 hover:text-primary hover:scale-110 mr-1`} disabled={isActionLoading} title="更换邮箱"><i className="fas fa-sync-alt text-xs"></i></button>
              <button onClick={() => setIsCustomMode(true)} className={`w-6 h-6 ${buttonBase} bg-primary text-primary-foreground hover:bg-primary/80 hover:scale-110`} disabled={isActionLoading} title="自定义邮箱"><i className="fas fa-edit text-xs"></i></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HeaderMailbox;