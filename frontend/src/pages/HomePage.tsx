import React, { useState, useEffect, useContext, useCallback } from 'react';
import Container from '../components/Container';
import EmailList from '../components/EmailList';
import EmailDetail from '../components/EmailDetail';
import AccountForm from '../components/AccountForm';
import { MailboxContext } from '../contexts/MailboxContext';
import { fetchAccounts, createAccount, updateAccount, deleteAccount, fetchPlatforms, fetchAllMailboxes, getEmails, deleteMailbox as apiDeleteMailbox } from '../utils/api';
import { getEmailDomains } from '../config';
import { API_BASE_URL } from '../config';

const HomePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'accounts' | 'mailbox' | 'overview'>('accounts');

  // ==================== 账号管理状态 ====================
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPlatform, setFilterPlatform] = useState('');
  const [isAccountsLoading, setIsAccountsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [expandedAccountId, setExpandedAccountId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // ==================== 临时邮箱状态 ====================
  const { mailbox, emails, selectedEmail, setSelectedEmail } = useContext(MailboxContext);

  // ==================== 收件总览状态 ====================
  const [allMailboxes, setAllMailboxes] = useState<(Mailbox & { emailCount: number; unreadCount: number })[]>([]);
  const [isOverviewLoading, setIsOverviewLoading] = useState(false);
  const [expandedMailboxId, setExpandedMailboxId] = useState<string | null>(null);
  const [mailboxEmails, setMailboxEmails] = useState<Email[]>([]);
  const [isMailboxEmailsLoading, setIsMailboxEmailsLoading] = useState(false);
  const [overviewSelectedEmail, setOverviewSelectedEmail] = useState<string | null>(null);
  const [overviewEmailDetail, setOverviewEmailDetail] = useState<Email | null>(null);
  const [isOverviewDetailLoading, setIsOverviewDetailLoading] = useState(false);
  const [overviewDomains, setOverviewDomains] = useState<string[]>([]);

  // 加载账号列表
  const loadAccounts = useCallback(async () => {
    setIsAccountsLoading(true);
    const result = await fetchAccounts(searchTerm || undefined, filterPlatform || undefined);
    if (result.success) {
      setAccounts(result.accounts);
    }
    setIsAccountsLoading(false);
  }, [searchTerm, filterPlatform]);

  // 加载平台列表
  const loadPlatforms = useCallback(async () => {
    const result = await fetchPlatforms();
    if (result.success) {
      setPlatforms(result.platforms);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'accounts') {
      loadAccounts();
      loadPlatforms();
    }
  }, [activeTab, loadAccounts, loadPlatforms]);

  // 搜索防抖
  useEffect(() => {
    const timer = setTimeout(loadAccounts, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, filterPlatform, loadAccounts]);

  // 加载收件总览数据
  const loadOverview = useCallback(async () => {
    setIsOverviewLoading(true);
    const [mailboxResult, domainResult] = await Promise.all([
      fetchAllMailboxes(),
      getEmailDomains(),
    ]);
    if (mailboxResult.success) setAllMailboxes(mailboxResult.mailboxes);
    setOverviewDomains(domainResult);
    setIsOverviewLoading(false);
  }, []);

  useEffect(() => {
    if (activeTab === 'overview') loadOverview();
  }, [activeTab, loadOverview]);

  // 展开邮箱查看邮件列表
  const handleExpandMailbox = async (mb: Mailbox & { emailCount: number; unreadCount: number }) => {
    if (expandedMailboxId === mb.id) {
      setExpandedMailboxId(null);
      setMailboxEmails([]);
      setOverviewSelectedEmail(null);
      setOverviewEmailDetail(null);
      return;
    }
    setExpandedMailboxId(mb.id);
    setOverviewSelectedEmail(null);
    setOverviewEmailDetail(null);
    setIsMailboxEmailsLoading(true);
    const result = await getEmails(mb.address);
    if (result.success) setMailboxEmails(result.emails || []);
    else setMailboxEmails([]);
    setIsMailboxEmailsLoading(false);
  };

  // 查看收件总览中的邮件详情
  const handleOverviewEmailClick = async (emailId: string) => {
    if (overviewSelectedEmail === emailId) {
      setOverviewSelectedEmail(null);
      setOverviewEmailDetail(null);
      return;
    }
    setOverviewSelectedEmail(emailId);
    setIsOverviewDetailLoading(true);
    try {
      const token = sessionStorage.getItem('auth_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const response = await fetch(`${API_BASE_URL}/api/emails/${emailId}`, { headers });
      if (response.ok) {
        const data = await response.json();
        if (data.success) setOverviewEmailDetail(data.email);
      }
    } catch (e) { console.error('获取邮件详情失败:', e); }
    setIsOverviewDetailLoading(false);
  };

  // 删除收件总览中的邮箱
  const handleDeleteOverviewMailbox = async (address: string) => {
    if (!window.confirm(`确定要删除邮箱 ${address} 吗？其所有邮件也会被删除。`)) return;
    const result = await apiDeleteMailbox(address);
    if (result.success) {
      setExpandedMailboxId(null);
      setOverviewSelectedEmail(null);
      setOverviewEmailDetail(null);
      loadOverview();
    }
  };

  // 创建/更新账号
  const handleSaveAccount = async (data: Partial<Account>) => {
    if (editingAccount) {
      const result = await updateAccount(editingAccount.id, data);
      if (result.success) {
        setShowForm(false);
        setEditingAccount(null);
        loadAccounts();
        loadPlatforms();
      }
    } else {
      const result = await createAccount(data);
      if (result.success) {
        setShowForm(false);
        loadAccounts();
        loadPlatforms();
      }
    }
  };

  // 删除账号
  const handleDeleteAccount = async (id: string) => {
    const result = await deleteAccount(id);
    if (result.success) {
      setDeleteConfirmId(null);
      setExpandedAccountId(null);
      loadAccounts();
      loadPlatforms();
    }
  };

  // ==================== 工具函数 ====================
  const formatDate = (timestamp: number) => {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    }).format(new Date(timestamp * 1000));
  };

  const formatFullDate = (timestamp: number) => {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    }).format(new Date(timestamp * 1000));
  };

  const isExpired = (expiresAt: number) => expiresAt <= Date.now() / 1000;

  // ==================== 渲染 ====================
  return (
    <Container>
      {/* Tab 导航 */}
      <div className="flex border-b mb-6">
        <button
          onClick={() => setActiveTab('accounts')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'accounts'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <i className="fas fa-key mr-2"></i>账号管理
        </button>
        <button
          onClick={() => setActiveTab('mailbox')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'mailbox'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <i className="fas fa-envelope mr-2"></i>临时邮箱
        </button>
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === 'overview'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <i className="fas fa-inbox mr-2"></i>收件总览
        </button>
      </div>

      {/* ==================== 账号管理 Tab ==================== */}
      {activeTab === 'accounts' && (
        <div>
          {/* 搜索栏和操作按钮 */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="flex-1">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="搜索标题、用户名、邮箱、手机号..."
                className="w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary text-sm"
              />
            </div>
            <select
              value={filterPlatform}
              onChange={(e) => setFilterPlatform(e.target.value)}
              className="px-3 py-2 border rounded-md bg-background text-sm"
            >
              <option value="">全部平台</option>
              {platforms.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <button
              onClick={() => { setEditingAccount(null); setShowForm(true); }}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 whitespace-nowrap"
            >
              <i className="fas fa-plus mr-1"></i>新增账号
            </button>
          </div>

          {/* 账号列表 */}
          {isAccountsLoading ? (
            <div className="text-center py-12 text-muted-foreground">加载中...</div>
          ) : accounts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <i className="fas fa-inbox text-4xl mb-3 block opacity-30"></i>
              <p>{searchTerm || filterPlatform ? '没有匹配的账号' : '暂无账号，点击新增开始记录'}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {accounts.map(account => (
                <div key={account.id} className="border rounded-lg overflow-hidden">
                  {/* 账号摘要行 */}
                  <div
                    className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => setExpandedAccountId(expandedAccountId === account.id ? null : account.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">{account.title}</span>
                        {Array.isArray(account.platforms) && account.platforms.length > 0 && (
                          <div className="flex gap-1 flex-shrink-0">
                            {account.platforms.slice(0, 3).map(p => (
                              <span key={p} className="text-xs px-1.5 py-0.5 bg-primary/10 text-primary rounded">{p}</span>
                            ))}
                            {account.platforms.length > 3 && (
                              <span className="text-xs px-1.5 py-0.5 bg-muted text-muted-foreground rounded">+{account.platforms.length - 3}</span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 truncate">
                        {[account.username, account.email].filter(Boolean).join(' · ') || '无详细信息'}
                      </div>
                    </div>
                    <i className={`fas fa-chevron-${expandedAccountId === account.id ? 'up' : 'down'} text-xs text-muted-foreground ml-2`}></i>
                  </div>

                  {/* 展开详情 */}
                  {expandedAccountId === account.id && (
                    <div className="border-t p-3 bg-muted/10 space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                        {account.username && (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground w-16 text-xs">用户名</span>
                            <span className="font-mono text-xs">{account.username}</span>
                            <button onClick={() => navigator.clipboard.writeText(account.username)} className="text-xs text-primary hover:text-primary/80" title="复制">
                              <i className="fas fa-copy"></i>
                            </button>
                          </div>
                        )}
                        {account.email && (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground w-16 text-xs">邮箱</span>
                            <span className="font-mono text-xs">{account.email}</span>
                            <button onClick={() => navigator.clipboard.writeText(account.email)} className="text-xs text-primary hover:text-primary/80" title="复制">
                              <i className="fas fa-copy"></i>
                            </button>
                          </div>
                        )}
                        {account.password && (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground w-16 text-xs">密码</span>
                            <span className="font-mono text-xs">{account.password}</span>
                            <button onClick={() => navigator.clipboard.writeText(account.password)} className="text-xs text-primary hover:text-primary/80" title="复制">
                              <i className="fas fa-copy"></i>
                            </button>
                          </div>
                        )}
                        {account.phone && (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground w-16 text-xs">手机号</span>
                            <span className="font-mono text-xs">{account.phone}</span>
                            <button onClick={() => navigator.clipboard.writeText(account.phone)} className="text-xs text-primary hover:text-primary/80" title="复制">
                              <i className="fas fa-copy"></i>
                            </button>
                          </div>
                        )}
                      </div>
                      {Array.isArray(account.platforms) && account.platforms.length > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground text-xs w-16">平台</span>
                          <div className="flex gap-1 flex-wrap">
                            {account.platforms.map(p => (
                              <span key={p} className="text-xs px-1.5 py-0.5 bg-primary/10 text-primary rounded">{p}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {account.notes && (
                        <div className="flex items-start gap-2">
                          <span className="text-muted-foreground text-xs w-16">备注</span>
                          <span className="text-xs whitespace-pre-wrap">{account.notes}</span>
                        </div>
                      )}
                      {/* 操作按钮 */}
                      <div className="flex gap-2 pt-2 border-t">
                        <button
                          onClick={() => { setEditingAccount(account); setShowForm(true); }}
                          className="px-3 py-1 text-xs rounded bg-primary/10 text-primary hover:bg-primary/20"
                        >
                          <i className="fas fa-edit mr-1"></i>编辑
                        </button>
                        {deleteConfirmId === account.id ? (
                          <>
                            <button
                              onClick={() => handleDeleteAccount(account.id)}
                              className="px-3 py-1 text-xs rounded bg-destructive text-destructive-foreground"
                            >
                              确认删除
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              className="px-3 py-1 text-xs rounded bg-muted"
                            >
                              取消
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirmId(account.id)}
                            className="px-3 py-1 text-xs rounded bg-destructive/10 text-destructive hover:bg-destructive/20"
                          >
                            <i className="fas fa-trash mr-1"></i>删除
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 统计信息 */}
          {accounts.length > 0 && (
            <div className="text-xs text-muted-foreground text-center mt-4">
              共 {accounts.length} 条记录
            </div>
          )}
        </div>
      )}

      {/* ==================== 临时邮箱 Tab ==================== */}
      {activeTab === 'mailbox' && (
        <div>
          {mailbox ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-1">
                <EmailList />
              </div>
              <div className="md:col-span-2">
                {selectedEmail ? (
                  <EmailDetail emailId={selectedEmail} />
                ) : (
                  <div className="border rounded-lg p-8 text-center text-muted-foreground">
                    <i className="fas fa-envelope-open text-3xl mb-3 block opacity-30"></i>
                    <p>请选择一封邮件查看详情</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <i className="fas fa-inbox text-4xl mb-3 block opacity-30"></i>
              <p>请先在顶部创建或选择一个临时邮箱</p>
            </div>
          )}
        </div>
      )}

      {/* ==================== 收件总览 Tab ==================== */}
      {activeTab === 'overview' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-muted-foreground">所有邮箱的收件记录，包括已过期邮箱</p>
            <button
              onClick={loadOverview}
              className="px-3 py-1.5 text-sm rounded-md bg-muted hover:bg-muted/80 transition-colors"
              disabled={isOverviewLoading}
            >
              <i className={`fas fa-sync-alt mr-1 ${isOverviewLoading ? 'animate-spin' : ''}`}></i>刷新
            </button>
          </div>

          {isOverviewLoading ? (
            <div className="text-center py-12 text-muted-foreground">加载中...</div>
          ) : allMailboxes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <i className="fas fa-inbox text-4xl mb-3 block opacity-30"></i>
              <p>暂无邮箱记录</p>
            </div>
          ) : (
            <div className="space-y-2">
              {allMailboxes.map(mb => {
                const expired = isExpired(mb.expiresAt);
                const domain = overviewDomains[0] || 'example.com';
                return (
                  <div key={mb.id} className="border rounded-lg overflow-hidden">
                    {/* 邮箱摘要行 */}
                    <div
                      className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => handleExpandMailbox(mb)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <code className="text-sm font-medium truncate">{mb.address}@{domain}</code>
                          {expired ? (
                            <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded flex-shrink-0">已过期</span>
                          ) : (
                            <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400 rounded flex-shrink-0">活跃</span>
                          )}
                          {mb.unreadCount > 0 && (
                            <span className="text-xs px-1.5 py-0.5 bg-primary text-primary-foreground rounded-full flex-shrink-0">{mb.unreadCount}</span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          创建于 {formatFullDate(mb.createdAt)} · {mb.emailCount} 封邮件
                        </div>
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(`${mb.address}@${domain}`); }}
                          className="w-7 h-7 flex items-center justify-center rounded hover:bg-primary/20 hover:text-primary transition-colors"
                          title="复制地址"
                        >
                          <i className="fas fa-copy text-xs"></i>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteOverviewMailbox(mb.address); }}
                          className="w-7 h-7 flex items-center justify-center rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 transition-colors"
                          title="删除邮箱"
                        >
                          <i className="fas fa-trash-alt text-xs"></i>
                        </button>
                        <i className={`fas fa-chevron-${expandedMailboxId === mb.id ? 'up' : 'down'} text-xs text-muted-foreground ml-1`}></i>
                      </div>
                    </div>

                    {/* 展开邮件列表 */}
                    {expandedMailboxId === mb.id && (
                      <div className="border-t">
                        {isMailboxEmailsLoading ? (
                          <div className="flex justify-center py-6">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                          </div>
                        ) : mailboxEmails.length === 0 ? (
                          <div className="p-4 text-center text-sm text-muted-foreground">暂无邮件</div>
                        ) : (
                          <ul className="divide-y">
                            {mailboxEmails.map(email => (
                              <React.Fragment key={email.id}>
                                <li
                                  className={`p-3 cursor-pointer hover:bg-muted/50 transition-colors ${overviewSelectedEmail === email.id ? 'bg-muted' : ''} ${!email.isRead ? 'font-semibold' : ''}`}
                                  onClick={() => handleOverviewEmailClick(email.id)}
                                >
                                  <div className="flex justify-between mb-0.5">
                                    <span className="text-sm truncate">{email.fromName || email.fromAddress}</span>
                                    <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">{formatDate(email.receivedAt)}</span>
                                  </div>
                                  <div className="text-sm truncate text-muted-foreground">{email.subject || '无主题'}</div>
                                </li>
                                {/* 内联邮件详情 */}
                                {overviewSelectedEmail === email.id && (
                                  <li className="border-t bg-muted/10">
                                    {isOverviewDetailLoading ? (
                                      <div className="flex justify-center py-6">
                                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                                      </div>
                                    ) : overviewEmailDetail ? (
                                      <div className="p-4 space-y-3">
                                        <div className="flex justify-between items-start">
                                          <div>
                                            <h3 className="font-semibold text-base">{overviewEmailDetail.subject || '无主题'}</h3>
                                            <div className="text-xs text-muted-foreground mt-1">
                                              <p>发件人: {overviewEmailDetail.fromAddress}</p>
                                              <p>时间: {formatFullDate(overviewEmailDetail.receivedAt)}</p>
                                            </div>
                                          </div>
                                          <button
                                            onClick={() => { setOverviewSelectedEmail(null); setOverviewEmailDetail(null); }}
                                            className="p-1.5 rounded hover:bg-muted text-muted-foreground"
                                          >
                                            <i className="fas fa-times text-sm"></i>
                                          </button>
                                        </div>
                                        <hr />
                                        {overviewEmailDetail.htmlContent ? (
                                          <div className="prose max-w-none border rounded-md p-3 bg-white text-sm" dangerouslySetInnerHTML={{ __html: overviewEmailDetail.htmlContent }} />
                                        ) : overviewEmailDetail.textContent ? (
                                          <pre className="whitespace-pre-wrap border rounded-md p-3 bg-white font-sans text-sm">{overviewEmailDetail.textContent}</pre>
                                        ) : (
                                          <p className="text-muted-foreground italic text-sm">无内容</p>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="p-4 text-center text-sm text-muted-foreground">加载失败</div>
                                    )}
                                  </li>
                                )}
                              </React.Fragment>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* 统计信息 */}
          {allMailboxes.length > 0 && (
            <div className="text-xs text-muted-foreground text-center mt-4">
              共 {allMailboxes.length} 个邮箱
            </div>
          )}
        </div>
      )}

      {/* 账号表单模态框 */}
      {showForm && (
        <AccountForm
          account={editingAccount}
          onSave={handleSaveAccount}
          onClose={() => { setShowForm(false); setEditingAccount(null); }}
        />
      )}
    </Container>
  );
};

export default HomePage;