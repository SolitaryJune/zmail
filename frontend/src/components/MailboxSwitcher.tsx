import React, { useState, useRef, useEffect, useContext } from 'react';
import { deleteMailbox as apiDeleteMailbox } from '../utils/api';
import { MailboxContext } from '../contexts/MailboxContext';

interface MailboxSwitcherProps {
  currentMailbox: Mailbox;
  onSwitchMailbox: (mailbox: Mailbox) => void;
  domain: string;
}

const MailboxSwitcher: React.FC<MailboxSwitcherProps> = ({ currentMailbox, onSwitchMailbox, domain }) => {
  const { showSuccessMessage, showErrorMessage } = useContext(MailboxContext);
  const [savedMailboxes, setSavedMailboxes] = useState<Mailbox[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadSavedMailboxes(); }, []);
  useEffect(() => { if (currentMailbox) updateSavedMailboxes(currentMailbox); }, [currentMailbox]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setShowDropdown(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadSavedMailboxes = () => {
    try {
      const savedData = localStorage.getItem('savedMailboxes');
      if (savedData) {
        const mailboxes = JSON.parse(savedData) as Mailbox[];
        const now = Date.now() / 1000;
        setSavedMailboxes(mailboxes.filter(m => m.expiresAt > now));
      }
    } catch (error) { console.error('Error loading saved mailboxes:', error); }
  };

  const updateSavedMailboxes = (mailbox: Mailbox) => {
    try {
      const now = Date.now() / 1000;
      let mailboxes: Mailbox[] = [];
      try {
        const savedData = localStorage.getItem('savedMailboxes');
        if (savedData) mailboxes = JSON.parse(savedData) as Mailbox[];
      } catch (e) { /* ignore */ }
      mailboxes = mailboxes.filter(m => m.expiresAt > now);
      const idx = mailboxes.findIndex(m => m.address === mailbox.address);
      if (idx >= 0) mailboxes[idx] = mailbox; else mailboxes.push(mailbox);
      setSavedMailboxes(mailboxes);
      localStorage.setItem('savedMailboxes', JSON.stringify(mailboxes));
    } catch (error) { console.error('Error updating saved mailboxes:', error); }
  };

  const handleSwitchMailbox = (mailbox: Mailbox) => {
    onSwitchMailbox(mailbox);
    setShowDropdown(false);
    showSuccessMessage('邮箱切换成功');
  };

  const handleDeleteMailbox = async (address: string) => {
    if (window.confirm('确定要删除这个已保存的邮箱吗？')) {
      const result = await apiDeleteMailbox(address);
      if (result.success) {
        const updated = savedMailboxes.filter(m => m.address !== address);
        setSavedMailboxes(updated);
        localStorage.setItem('savedMailboxes', JSON.stringify(updated));
        showSuccessMessage('邮箱删除成功');
      } else {
        showErrorMessage('邮箱删除失败');
      }
    }
  };

  const handleClearAllMailboxes = async () => {
    if (window.confirm('确定要清空所有已保存的邮箱吗？（当前使用的邮箱不会被删除）')) {
      const toDelete = savedMailboxes.filter(m => m.address !== currentMailbox.address);
      if (toDelete.length === 0) { setShowDropdown(false); return; }
      const results = await Promise.allSettled(toDelete.map(m => apiDeleteMailbox(m.address)));
      const keep = savedMailboxes.find(m => m.address === currentMailbox.address);
      const keepList = keep ? [keep] : [];
      setSavedMailboxes(keepList);
      localStorage.setItem('savedMailboxes', JSON.stringify(keepList));
      setShowDropdown(false);
      const failedCount = results.filter(r => r.status === 'rejected').length;
      if (failedCount > 0) showErrorMessage(`部分邮箱清空失败 (${failedCount}个)`);
      else showSuccessMessage('已清空所有保存的邮箱');
    }
  };

  if (savedMailboxes.length <= 1) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button onClick={() => setShowDropdown(!showDropdown)} className="w-8 h-8 flex items-center justify-center rounded-md transition-all duration-200 hover:bg-primary/20 hover:text-primary hover:scale-110 mr-1" title="切换邮箱">
        <i className="fas fa-exchange-alt text-sm"></i>
      </button>
      {showDropdown && (
        <div className="absolute top-9 left-0 bg-popover text-popover-foreground border rounded-md shadow-lg p-1 z-20 min-w-[250px]">
          <div className="text-xs font-medium px-2 py-1 text-muted-foreground flex justify-between items-center">
            已保存的邮箱
            <button onClick={handleClearAllMailboxes} className="text-red-500 hover:text-red-700 text-xs" title="全部清除">
              <i className="fas fa-trash-alt mr-1"></i>全部清除
            </button>
          </div>
          <div className="max-h-[400px] overflow-y-auto">
            {savedMailboxes.map(m => (
              <div key={m.address} className="flex items-center justify-between hover:bg-muted rounded-sm">
                <button
                  onClick={() => handleSwitchMailbox(m)}
                  className={`w-full text-left text-sm px-2 py-1.5 transition-colors truncate ${m.address === currentMailbox.address ? 'bg-primary/10 text-primary font-medium' : ''}`}
                >
                  {m.address}@{domain}
                </button>
                {m.address !== currentMailbox.address && (
                  <button onClick={() => handleDeleteMailbox(m.address)} className="p-2 text-red-500 hover:text-red-700" title="删除">
                    <i className="fas fa-trash-alt text-xs"></i>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MailboxSwitcher;