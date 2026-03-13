import React, { useState, useEffect, useContext } from 'react';
import { API_BASE_URL } from '../config';
import { MailboxContext } from '../contexts/MailboxContext';

interface EmailDetailProps {
  emailId: string;
  onClose?: () => void;
}

interface AttachmentInfo {
  id: string;
  emailId: string;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: number;
  isLarge: boolean;
  chunksCount: number;
}

const EmailDetail: React.FC<EmailDetailProps> = ({ emailId, onClose }) => {
  const { emailCache, addToEmailCache, handleMailboxNotFound, showErrorMessage, showSuccessMessage } = useContext(MailboxContext);
  const [email, setEmail] = useState<Email | null>(null);
  const [attachments, setAttachments] = useState<AttachmentInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingAttachments, setIsLoadingAttachments] = useState(false);

  const getAuthHeaders = (): Record<string, string> => {
    const token = sessionStorage.getItem('auth_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };
  
  useEffect(() => {
    const fetchEmail = async () => {
      try {
        if (emailCache[emailId]) {
          setEmail(emailCache[emailId].email);
          setAttachments(emailCache[emailId].attachments);
          setIsLoading(false);
          return;
        }
        setIsLoading(true);
        const response = await fetch(`${API_BASE_URL}/api/emails/${emailId}`, { headers: getAuthHeaders() });
        if (!response.ok) {
          if (response.status === 404) { await handleMailboxNotFound(); onClose?.(); return; }
          throw new Error('Failed to fetch email');
        }
        const data = await response.json();
        if (data.success) {
          setEmail(data.email);
          if (data.email.hasAttachments) { await fetchAttachments(emailId, data.email); }
          else { addToEmailCache(emailId, data.email, []); }
        }
      } catch (error) {
        showErrorMessage('获取邮件失败');
      } finally {
        setIsLoading(false);
      }
    };
    fetchEmail();
  }, [emailId]);
  
  const fetchAttachments = async (eid: string, emailData?: Email) => {
    try {
      setIsLoadingAttachments(true);
      const response = await fetch(`${API_BASE_URL}/api/emails/${eid}/attachments`, { headers: getAuthHeaders() });
      if (!response.ok) {
        if (response.status === 404) { await handleMailboxNotFound(); onClose?.(); return; }
        throw new Error('Failed to fetch attachments');
      }
      const data = await response.json();
      if (data.success) {
        setAttachments(data.attachments);
        if (emailData) addToEmailCache(eid, emailData, data.attachments);
      }
    } catch (error) {
      console.error('Error fetching attachments:', error);
    } finally {
      setIsLoadingAttachments(false);
    }
  };
  
  const handleDelete = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/emails/${emailId}`, { method: 'DELETE', headers: getAuthHeaders() });
      if (!response.ok) throw new Error('Failed to delete email');
      const data = await response.json();
      if (data.success) {
        showSuccessMessage('邮件删除成功');
        setTimeout(() => onClose?.(), 2000);
      }
    } catch (error) {
      showErrorMessage('邮件删除失败');
    }
  };
  
  const formatDate = (timestamp: number) => {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).format(new Date(timestamp * 1000));
  };
  
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  const getFileIcon = (mimeType: string): string => {
    if (mimeType.startsWith('image/')) return 'fa-file-image';
    if (mimeType.startsWith('video/')) return 'fa-file-video';
    if (mimeType.startsWith('audio/')) return 'fa-file-audio';
    if (mimeType === 'application/pdf') return 'fa-file-pdf';
    if (mimeType.includes('text/')) return 'fa-file-alt';
    return 'fa-file';
  };
  
  const getAttachmentUrl = (attachmentId: string, download = false): string => {
    const token = sessionStorage.getItem('auth_token');
    return `${API_BASE_URL}/api/attachments/${attachmentId}?${download ? 'download=true&' : ''}token=${token || ''}`;
  };
  
  const renderAttachmentPreview = (attachment: AttachmentInfo) => {
    const url = getAttachmentUrl(attachment.id, true);
    if (attachment.mimeType.startsWith('image/')) {
      return <div className="mt-2"><img src={url} alt={attachment.filename} className="max-w-full max-h-[300px] object-contain rounded border" /></div>;
    }
    return null;
  };
  
  return (
    <div className="border rounded-lg p-6">
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : email ? (
        <div className="space-y-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-semibold mb-2">{email.subject || '无主题'}</h2>
              <div className="text-sm text-muted-foreground">
                <p><strong>发件人:</strong> {email.fromAddress}</p>
                <p><strong>收件人:</strong> {email.toAddress}</p>
                <p><strong>日期:</strong> {formatDate(email.receivedAt)}</p>
              </div>
            </div>
            <div className="flex space-x-2">
              {onClose && (
                <button onClick={onClose} className="p-2 rounded-md hover:bg-muted" title="关闭">
                  <i className="fas fa-times"></i>
                </button>
              )}
              <button onClick={handleDelete} className="p-2 rounded-md hover:bg-red-100 text-red-600" title="删除">
                <i className="fas fa-trash-alt"></i>
              </button>
            </div>
          </div>
          
          <hr />
          
          <div>
            <h3 className="font-medium mb-2">邮件内容</h3>
            {email.htmlContent ? (
              <div className="prose max-w-none border rounded-md p-4 bg-white" dangerouslySetInnerHTML={{ __html: email.htmlContent }} />
            ) : email.textContent ? (
              <pre className="whitespace-pre-wrap border rounded-md p-4 bg-white font-sans">{email.textContent}</pre>
            ) : (
              <p className="text-muted-foreground italic">无内容</p>
            )}
          </div>
          
          {email.hasAttachments && (
            <div>
              <h3 className="font-medium mb-2">
                附件 {isLoadingAttachments && <span className="ml-2 inline-block animate-spin h-4 w-4 border-b-2 border-primary rounded-full"></span>}
              </h3>
              {attachments.length > 0 ? (
                <div className="space-y-3">
                  {attachments.map(att => (
                    <div key={att.id} className="border rounded-md p-3 bg-white">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center space-x-3">
                          <i className={`fas ${getFileIcon(att.mimeType)} text-primary text-lg`}></i>
                          <div>
                            <p className="font-medium">{att.filename}</p>
                            <p className="text-xs text-muted-foreground">{formatFileSize(att.size)}</p>
                          </div>
                        </div>
                        <a href={getAttachmentUrl(att.id, true)} download={att.filename} className="px-3 py-1 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90" target="_blank" rel="noopener noreferrer">
                          下载
                        </a>
                      </div>
                      {renderAttachmentPreview(att)}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground italic">没有附件</p>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">邮件不存在或已被删除</p>
        </div>
      )}
    </div>
  );
};

export default EmailDetail;