import React, { useContext, useState } from 'react';
import { MailboxContext } from '../contexts/MailboxContext';
import EmailDetail from './EmailDetail';

const EmailList: React.FC = () => {
  const { 
    emails, selectedEmail, setSelectedEmail, autoRefresh, setAutoRefresh, 
    refreshEmails, mailbox, deleteMailbox, isEmailsLoading
  } = useContext(MailboxContext);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return new Intl.DateTimeFormat(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    }).format(date);
  };
  
  const formatFullDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
    }).format(date);
  };
  
  const calculateTimeLeft = (expiresAt: number) => {
    if (!expiresAt) return '';
    const now = Math.floor(Date.now() / 1000);
    const timeLeftSeconds = expiresAt - now;
    if (timeLeftSeconds <= 0) return '已过期';
    const hours = Math.floor(timeLeftSeconds / 3600);
    const minutes = Math.floor((timeLeftSeconds % 3600) / 60);
    return hours > 0 ? `${hours}小时${minutes}分钟` : `${minutes}分钟`;
  };
  
  const handleRefresh = () => refreshEmails(true);
  const toggleAutoRefresh = () => setAutoRefresh(!autoRefresh);
  
  const handleDeleteMailbox = async () => {
    if (window.confirm('确定要删除当前邮箱吗？删除后将立即创建新的邮箱。')) {
      setIsDeleting(true);
      try { await deleteMailbox(); } 
      catch (error) { console.error('Error deleting mailbox:', error); } 
      finally { setIsDeleting(false); }
    }
  };
  
  const isLoading = isEmailsLoading || isDeleting;
  
  if (isLoading && emails.length === 0) {
    return (
      <div className="border rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">收件箱</h2>
        </div>
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="border rounded-lg">
      <div className="flex justify-between items-center p-4 border-b">
        <h2 className="text-lg font-semibold">收件箱</h2>
        <div className="flex items-center space-x-2">
          <button onClick={handleRefresh} className="p-1 rounded-md hover:bg-muted" title="刷新邮件">
            <i className="fas fa-sync-alt text-sm"></i>
          </button>
          <button
            onClick={toggleAutoRefresh}
            className={`p-1 rounded-md ${autoRefresh ? 'text-primary' : 'text-muted-foreground'}`}
            title={autoRefresh ? '自动刷新: 开' : '自动刷新: 关'}
          >
            <i className="fas fa-clock text-sm"></i>
          </button>
        </div>
      </div>
      
      {mailbox && (
        <div className="px-4 py-2 bg-muted/30 border-b text-xs text-muted-foreground">
          <div className="flex justify-between items-center mb-1">
            <span>创建时间:</span>
            <span>{formatFullDate(mailbox.createdAt)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span>过期时间:</span>
            <span>{formatFullDate(mailbox.expiresAt)}</span>
          </div>
          <div className="flex justify-between items-center mt-1">
            <span>剩余时间:</span>
            <span>{calculateTimeLeft(mailbox.expiresAt)}</span>
          </div>
          <div className="flex justify-end mt-2">
            <button onClick={handleDeleteMailbox} className="text-red-500 hover:text-red-600 text-xs flex items-center gap-1" title="删除邮箱">
              <i className="fas fa-trash-alt"></i>
              <span>删除邮箱</span>
            </button>
          </div>
        </div>
      )}
      
      <div className="flex justify-between items-center px-4 py-2 bg-muted/30">
        <span className="text-sm text-muted-foreground">{emails.length} 封邮件</span>
        <span className="text-xs text-muted-foreground">{autoRefresh ? '自动刷新: 开' : '自动刷新: 关'}</span>
      </div>
      
      {emails.length === 0 ? (
        <div className="p-6 text-center text-muted-foreground">
          <p>邮箱为空</p>
          <p className="text-sm mt-2">等待接收邮件...</p>
        </div>
      ) : (
        <ul className="divide-y">
          {emails.map((email) => (
            <React.Fragment key={email.id}>
              <li 
                className={`p-4 cursor-pointer hover:bg-muted/50 ${selectedEmail === email.id ? 'bg-muted' : ''} ${!email.isRead ? 'font-semibold' : ''}`}
                onClick={() => setSelectedEmail(selectedEmail === email.id ? null : email.id)}
              >
                <div className="flex justify-between mb-1">
                  <span className="truncate">{email.fromName || email.fromAddress}</span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">{formatDate(email.receivedAt)}</span>
                </div>
                <div className="text-sm truncate">{email.subject || '无主题'}</div>
              </li>
              {selectedEmail === email.id && (
                <li className="border-t border-muted">
                  <EmailDetail emailId={email.id} onClose={() => setSelectedEmail(null)} />
                </li>
              )}
            </React.Fragment>
          ))}
        </ul>
      )}
    </div>
  );
};

export default EmailList;