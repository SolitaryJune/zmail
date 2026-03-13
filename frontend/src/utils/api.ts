import { API_BASE_URL } from "../config";

// 获取认证 header
const getAuthHeaders = (): Record<string, string> => {
  const token = sessionStorage.getItem('auth_token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

// API请求基础URL
const apiUrl = (path: string) => `${API_BASE_URL}${path}`;

// ==================== 邮箱相关 API（保留原有功能） ====================

// 创建随机邮箱
export const createRandomMailbox = async (expiresInHours = 24) => {
  try {
    const response = await fetch(apiUrl('/api/mailboxes'), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ expiresInHours }),
    });
    if (!response.ok) throw new Error('Failed to create mailbox');
    const data = await response.json();
    if (data.success) return { success: true, mailbox: data.mailbox };
    throw new Error(data.error || 'Unknown error');
  } catch (error) {
    return { success: false, error };
  }
};

// 创建自定义邮箱
export const createCustomMailbox = async (address: string, expiresInHours = 24) => {
  try {
    if (!address.trim()) return { success: false, error: 'Invalid address' };
    const response = await fetch(apiUrl('/api/mailboxes'), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ address: address.trim(), expiresInHours }),
    });
    const data = await response.json();
    if (!response.ok) {
      if (response.status === 400) return { success: false, error: data.error || 'Address already exists' };
      throw new Error(data.error || 'Failed to create mailbox');
    }
    if (data.success) return { success: true, mailbox: data.mailbox };
    throw new Error(data.error || 'Unknown error');
  } catch (error) {
    return { success: false, error };
  }
};

// 获取邮箱信息
export const getMailbox = async (address: string) => {
  try {
    const response = await fetch(apiUrl(`/api/mailboxes/${address}`), { headers: getAuthHeaders() });
    if (!response.ok) {
      if (response.status === 404) return { success: false, error: 'Mailbox not found' };
      throw new Error('Failed to fetch mailbox');
    }
    const data = await response.json();
    if (data.success) return { success: true, mailbox: data.mailbox };
    throw new Error(data.error || 'Unknown error');
  } catch (error) {
    return { success: false, error };
  }
};

// 获取邮件列表
export const getEmails = async (address: string) => {
  try {
    if (!address) return { success: false, error: 'Address is empty', emails: [] };
    const response = await fetch(apiUrl(`/api/mailboxes/${address}/emails`), { headers: getAuthHeaders() });
    if (response.status === 404) return { success: false, error: 'Mailbox not found', notFound: true };
    if (!response.ok) throw new Error(`Failed to fetch emails: ${response.status}`);
    const data = await response.json();
    if (data.success) return { success: true, emails: data.emails };
    if (data.error && (data.error.includes('邮箱不存在') || data.error.includes('Mailbox not found'))) {
      return { success: false, error: data.error, notFound: true };
    }
    throw new Error(data.error || 'Unknown error');
  } catch (error) {
    return { success: false, error, emails: [] };
  }
};

// 删除邮箱
export const deleteMailbox = async (address: string) => {
  try {
    const response = await fetch(apiUrl(`/api/mailboxes/${address}`), {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to delete mailbox');
    const data = await response.json();
    if (data.success) return { success: true };
    throw new Error(data.error || 'Unknown error');
  } catch (error) {
    return { success: false, error };
  }
};

// 本地存储相关
export const saveMailboxToLocalStorage = (mailbox: Mailbox) => {
  localStorage.setItem('tempMailbox', JSON.stringify({ ...mailbox, savedAt: Date.now() / 1000 }));
};

export const getMailboxFromLocalStorage = (): Mailbox | null => {
  const savedMailbox = localStorage.getItem('tempMailbox');
  if (!savedMailbox) return null;
  try {
    const mailbox = JSON.parse(savedMailbox) as Mailbox & { savedAt: number };
    if (mailbox.expiresAt < Date.now() / 1000) {
      localStorage.removeItem('tempMailbox');
      return null;
    }
    return mailbox;
  } catch {
    localStorage.removeItem('tempMailbox');
    return null;
  }
};

export const removeMailboxFromLocalStorage = () => {
  localStorage.removeItem('tempMailbox');
};

// ==================== 账号管理 API ====================

// 获取账号列表
export const fetchAccounts = async (search?: string, platform?: string) => {
  try {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (platform) params.set('platform', platform);
    const query = params.toString();
    const response = await fetch(apiUrl(`/api/accounts${query ? `?${query}` : ''}`), { headers: getAuthHeaders() });
    if (!response.ok) throw new Error('Failed to fetch accounts');
    const data = await response.json();
    return { success: true, accounts: data.accounts as Account[] };
  } catch (error) {
    return { success: false, accounts: [] as Account[], error };
  }
};

// 创建账号
export const createAccount = async (params: Partial<Account>) => {
  try {
    const response = await fetch(apiUrl('/api/accounts'), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(params),
    });
    if (!response.ok) throw new Error('Failed to create account');
    const data = await response.json();
    return { success: true, account: data.account as Account };
  } catch (error) {
    return { success: false, error };
  }
};

// 更新账号
export const updateAccount = async (id: string, params: Partial<Account>) => {
  try {
    const response = await fetch(apiUrl(`/api/accounts/${id}`), {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(params),
    });
    if (!response.ok) throw new Error('Failed to update account');
    const data = await response.json();
    return { success: true, account: data.account as Account };
  } catch (error) {
    return { success: false, error };
  }
};

// 删除账号
export const deleteAccount = async (id: string) => {
  try {
    const response = await fetch(apiUrl(`/api/accounts/${id}`), {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to delete account');
    const data = await response.json();
    return { success: data.success };
  } catch (error) {
    return { success: false, error };
  }
};

// 获取所有平台列表
export const fetchPlatforms = async () => {
  try {
    const response = await fetch(apiUrl('/api/platforms'), { headers: getAuthHeaders() });
    if (!response.ok) throw new Error('Failed to fetch platforms');
    const data = await response.json();
    return { success: true, platforms: data.platforms as string[] };
  } catch (error) {
    return { success: false, platforms: [] as string[], error };
  }
};

// 获取所有邮箱列表（含邮件统计）
export const fetchAllMailboxes = async () => {
  try {
    const response = await fetch(apiUrl('/api/mailboxes'), { headers: getAuthHeaders() });
    if (!response.ok) throw new Error('Failed to fetch mailboxes');
    const data = await response.json();
    return { success: true, mailboxes: data.mailboxes as (Mailbox & { emailCount: number; unreadCount: number })[] };
  } catch (error) {
    return { success: false, mailboxes: [] as (Mailbox & { emailCount: number; unreadCount: number })[], error };
  }
};

// ==================== 预设平台快捷栏 API ====================

// 获取所有预设平台
export const fetchPresetPlatforms = async () => {
  try {
    const response = await fetch(apiUrl('/api/presets/platforms'), { headers: getAuthHeaders() });
    if (!response.ok) throw new Error('Failed to fetch preset platforms');
    const data = await response.json();
    return { success: true, presets: data.presets as { id: string; name: string; createdAt: number }[] };
  } catch (error) {
    return { success: false, presets: [], error };
  }
};

// 新增预设平台
export const createPresetPlatform = async (name: string) => {
  try {
    const response = await fetch(apiUrl('/api/presets/platforms'), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ name }),
    });
    if (!response.ok) throw new Error('Failed to create preset platform');
    const data = await response.json();
    return { success: data.success, preset: data.preset, error: data.error };
  } catch (error) {
    return { success: false, error };
  }
};

// 修改预设平台
export const updatePresetPlatform = async (oldName: string, newName: string) => {
  try {
    const response = await fetch(apiUrl('/api/presets/platforms'), {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ oldName, newName }),
    });
    if (!response.ok) throw new Error('Failed to update preset platform');
    const data = await response.json();
    return { success: data.success, error: data.error };
  } catch (error) {
    return { success: false, error };
  }
};

// 删除预设平台
export const deletePresetPlatform = async (name: string) => {
  try {
    const response = await fetch(apiUrl(`/api/presets/platforms/${encodeURIComponent(name)}`), {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to delete preset platform');
    const data = await response.json();
    return { success: data.success, error: data.error };
  } catch (error) {
    return { success: false, error };
  }
};