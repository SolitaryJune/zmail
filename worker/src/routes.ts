import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Env } from './types';
import { 
  createMailbox, 
  getMailbox,
  getMailboxByAddress,
  getAllMailboxes,
  deleteMailbox, 
  getEmails, 
  getEmail, 
  deleteEmail,
  getAttachments,
  getAttachment,
  createAccount,
  getAccounts,
  getAccount,
  updateAccount,
  deleteAccount,
  deleteAccountsByEmails,
  getAllPlatforms
} from './database';
import { generateRandomAddress } from './utils';

// 创建 Hono 应用
const app = new Hono<{ Bindings: Env }>();

// 添加 CORS 中间件
app.use('/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
  maxAge: 86400,
}));

// ==================== 防暴破机制 ====================
// 基于 IP 的登录频率限制
const loginAttempts = new Map<string, { count: number; lockedUntil: number }>();
const MAX_ATTEMPTS = 5;       // 最多连续失败次数
const LOCK_DURATION = 15 * 60 * 1000; // 锁定 15 分钟（毫秒）

function getClientIp(c: any): string {
  return c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() || 'unknown';
}

// 登录验证端点
app.post('/api/login', async (c) => {
  try {
    const ip = getClientIp(c);
    const now = Date.now();
    
    // 检查是否被锁定
    const attempt = loginAttempts.get(ip);
    if (attempt && attempt.lockedUntil > now) {
      const remainingSeconds = Math.ceil((attempt.lockedUntil - now) / 1000);
      const remainingMinutes = Math.ceil(remainingSeconds / 60);
      return c.json({ 
        success: false, 
        error: `登录尝试过多，请 ${remainingMinutes} 分钟后再试` 
      }, 429);
    }
    
    const body = await c.req.json();
    const password = body.password;
    const authPassword = c.env.AUTH_PASSWORD;
    
    if (!authPassword) {
      return c.json({ success: false, error: '服务端未配置认证密码' }, 500);
    }
    
    if (password === authPassword) {
      // 登录成功，清除失败记录
      loginAttempts.delete(ip);
      return c.json({ success: true, token: authPassword });
    } else {
      // 登录失败，记录失败次数
      const current = loginAttempts.get(ip) || { count: 0, lockedUntil: 0 };
      current.count += 1;
      
      if (current.count >= MAX_ATTEMPTS) {
        current.lockedUntil = now + LOCK_DURATION;
        loginAttempts.set(ip, current);
        return c.json({ 
          success: false, 
          error: `连续失败 ${MAX_ATTEMPTS} 次，账号已锁定 15 分钟` 
        }, 429);
      }
      
      loginAttempts.set(ip, current);
      return c.json({ 
        success: false, 
        error: `密码错误（剩余 ${MAX_ATTEMPTS - current.count} 次尝试机会）` 
      }, 401);
    }
  } catch (error) {
    return c.json({ success: false, error: '登录失败' }, 400);
  }
});

// 认证中间件 — 除 /api/login 外所有 /api/* 请求需要密码验证
app.use('/api/*', async (c, next) => {
  // 跳过 login 和 config 端点
  if (c.req.path === '/api/login' || c.req.path === '/api/config') {
    return next();
  }
  
  const authPassword = c.env.AUTH_PASSWORD;
  if (!authPassword) {
    // 未配置密码时不做认证限制
    return next();
  }
  
  const authorization = c.req.header('Authorization');
  const token = authorization?.replace('Bearer ', '');
  
  if (token !== authPassword) {
    return c.json({ success: false, error: '未授权访问' }, 401);
  }
  
  return next();
});

// 健康检查端点
app.get('/', (c) => {
  return c.json({ status: 'ok', message: '私有化账号管理系统' });
});

// 获取系统配置
app.get('/api/config', (c) => {
  try {
    const emailDomains = c.env.VITE_EMAIL_DOMAIN || '';
    const domains = emailDomains.split(',').map((domain: string) => domain.trim()).filter((domain: string) => domain);
    
    return c.json({ 
      success: true, 
      config: {
        emailDomains: domains
      }
    });
  } catch (error) {
    console.error('获取配置失败:', error);
    return c.json({ 
      success: false, 
      error: '获取配置失败',
      message: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});


// 获取所有邮箱（收件总览）
app.get('/api/mailboxes', async (c) => {
  try {
    const mailboxes = await getAllMailboxes(c.env.DB);
    return c.json({ success: true, mailboxes });
  } catch (error) {
    console.error('获取邮箱列表失败:', error);
    return c.json({ 
      success: false, 
      error: '获取邮箱列表失败',
      message: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// 创建邮箱
app.post('/api/mailboxes', async (c) => {
  try {
    const body = await c.req.json();
    
    // 验证参数
    if (body.address && typeof body.address !== 'string') {
      return c.json({ success: false, error: '无效的邮箱地址' }, 400);
    }
    
    const expiresInHours = 24; // 固定24小时有效期
    
    // 获取客户端IP
    const ip = c.req.header('CF-Connecting-IP') || 'unknown';
    
    // 生成或使用提供的地址
    const address = body.address || generateRandomAddress();
    
    // 检查邮箱是否已存在
    const existingMailbox = await getMailbox(c.env.DB, address);
    if (existingMailbox) {
      return c.json({ success: false, error: '邮箱地址已存在' }, 400);
    }
    
    // 创建邮箱
    const mailbox = await createMailbox(c.env.DB, {
      address,
      expiresInHours,
      ipAddress: ip,
    });
    
    return c.json({ success: true, mailbox });
  } catch (error) {
    console.error('创建邮箱失败:', error);
    return c.json({ 
      success: false, 
      error: '创建邮箱失败',
      message: error instanceof Error ? error.message : String(error)
    }, 400);
  }
});

// 获取邮箱信息
app.get('/api/mailboxes/:address', async (c) => {
  try {
    const address = c.req.param('address');
    const mailbox = await getMailbox(c.env.DB, address);
    
    if (!mailbox) {
      return c.json({ success: false, error: '邮箱不存在' }, 404);
    }
    
    return c.json({ success: true, mailbox });
  } catch (error) {
    console.error('获取邮箱失败:', error);
    return c.json({ 
      success: false, 
      error: '获取邮箱失败',
      message: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// 删除邮箱
app.delete('/api/mailboxes/:address', async (c) => {
  try {
    const address = c.req.param('address');
    await deleteMailbox(c.env.DB, address);
    
    return c.json({ success: true });
  } catch (error) {
    console.error('删除邮箱失败:', error);
    return c.json({ 
      success: false, 
      error: '删除邮箱失败',
      message: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// 获取邮件列表（支持过期邮箱查询，用于收件总览）
app.get('/api/mailboxes/:address/emails', async (c) => {
  try {
    const address = c.req.param('address');
    // 先按地址查找（不过滤过期），支持收件总览查看过期邮箱的邮件
    const mailbox = await getMailboxByAddress(c.env.DB, address);
    
    if (!mailbox) {
      return c.json({ success: false, error: '邮箱不存在' }, 404);
    }
    
    const emails = await getEmails(c.env.DB, mailbox.id);
    
    return c.json({ success: true, emails });
  } catch (error) {
    console.error('获取邮件列表失败:', error);
    return c.json({ 
      success: false, 
      error: '获取邮件列表失败',
      message: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// 获取邮件详情
app.get('/api/emails/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const email = await getEmail(c.env.DB, id);
    
    if (!email) {
      return c.json({ success: false, error: '邮件不存在' }, 404);
    }
    
    return c.json({ success: true, email });
  } catch (error) {
    console.error('获取邮件详情失败:', error);
    return c.json({ 
      success: false, 
      error: '获取邮件详情失败',
      message: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// 获取邮件的附件列表
app.get('/api/emails/:id/attachments', async (c) => {
  try {
    const id = c.req.param('id');
    
    // 检查邮件是否存在
    const email = await getEmail(c.env.DB, id);
    if (!email) {
      return c.json({ success: false, error: '邮件不存在' }, 404);
    }
    
    // 获取附件列表
    const attachments = await getAttachments(c.env.DB, id);
    
    return c.json({ success: true, attachments });
  } catch (error) {
    console.error('获取附件列表失败:', error);
    return c.json({ 
      success: false, 
      error: '获取附件列表失败',
      message: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// 获取附件详情
app.get('/api/attachments/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const attachment = await getAttachment(c.env.DB, id);
    
    if (!attachment) {
      return c.json({ success: false, error: '附件不存在' }, 404);
    }
    
    // 检查是否需要直接返回附件内容
    const download = c.req.query('download') === 'true';
    
    if (download) {
      // 将Base64内容转换为二进制
      const binaryContent = atob(attachment.content);
      const bytes = new Uint8Array(binaryContent.length);
      for (let i = 0; i < binaryContent.length; i++) {
        bytes[i] = binaryContent.charCodeAt(i);
      }
      
      // 设置响应头
      c.header('Content-Type', attachment.mimeType);
      c.header('Content-Disposition', `attachment; filename="${encodeURIComponent(attachment.filename)}"`);
      
      return c.body(bytes);
    }
    
    // 返回附件信息（不包含内容，避免响应过大）
    return c.json({ 
      success: true, 
      attachment: {
        id: attachment.id,
        emailId: attachment.emailId,
        filename: attachment.filename,
        mimeType: attachment.mimeType,
        size: attachment.size,
        createdAt: attachment.createdAt,
        isLarge: attachment.isLarge,
        chunksCount: attachment.chunksCount
      }
    });
  } catch (error) {
    console.error('获取附件详情失败:', error);
    return c.json({ 
      success: false, 
      error: '获取附件详情失败',
      message: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// 删除邮件
app.delete('/api/emails/:id', async (c) => {
  try {
    const id = c.req.param('id');
    await deleteEmail(c.env.DB, id);
    
    return c.json({ success: true });
  } catch (error) {
    console.error('删除邮件失败:', error);
    return c.json({ 
      success: false, 
      error: '删除邮件失败',
      message: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// ==================== 账号管理 API ====================

// 获取账号列表
app.get('/api/accounts', async (c) => {
  try {
    const search = c.req.query('search');
    const platform = c.req.query('platform');
    const accounts = await getAccounts(c.env.DB, search, platform);
    return c.json({ success: true, accounts });
  } catch (error) {
    console.error('获取账号列表失败:', error);
    return c.json({ success: false, error: '获取账号列表失败' }, 500);
  }
});

// 获取所有平台列表
app.get('/api/platforms', async (c) => {
  try {
    const platforms = await getAllPlatforms(c.env.DB);
    return c.json({ success: true, platforms });
  } catch (error) {
    console.error('获取平台列表失败:', error);
    return c.json({ success: false, error: '获取平台列表失败' }, 500);
  }
});

// 创建账号
app.post('/api/accounts', async (c) => {
  try {
    const body = await c.req.json();
    if (!body.title || !body.title.trim()) {
      return c.json({ success: false, error: '标题不能为空' }, 400);
    }
    const account = await createAccount(c.env.DB, body);
    return c.json({ success: true, account });
  } catch (error) {
    console.error('创建账号失败:', error);
    return c.json({ success: false, error: '创建账号失败' }, 500);
  }
});

// 获取单个账号详情
app.get('/api/accounts/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const account = await getAccount(c.env.DB, id);
    if (!account) {
      return c.json({ success: false, error: '账号不存在' }, 404);
    }
    return c.json({ success: true, account });
  } catch (error) {
    console.error('获取账号详情失败:', error);
    return c.json({ success: false, error: '获取账号详情失败' }, 500);
  }
});

// 更新账号
app.put('/api/accounts/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const account = await updateAccount(c.env.DB, id, body);
    if (!account) {
      return c.json({ success: false, error: '账号不存在' }, 404);
    }
    return c.json({ success: true, account });
  } catch (error) {
    console.error('更新账号失败:', error);
    return c.json({ success: false, error: '更新账号失败' }, 500);
  }
});

// 删除账号
app.delete('/api/accounts/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const deleted = await deleteAccount(c.env.DB, id);
    if (!deleted) {
      return c.json({ success: false, error: '账号不存在' }, 404);
    }
    return c.json({ success: true });
  } catch (error) {
    console.error('删除账号失败:', error);
    return c.json({ success: false, error: '删除账号失败' }, 500);
  }
});

// 批量删除账号（按邮箱列表，可选平台过滤）
app.post('/api/accounts/batch-delete', async (c) => {
  try {
    const body = await c.req.json();
    const emails: string[] = body.emails;
    const platform: string | undefined = body.platform;
    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return c.json({ success: false, error: '需要提供 emails 数组' }, 400);
    }
    const deleted = await deleteAccountsByEmails(c.env.DB, emails, platform);
    return c.json({ success: true, deleted });
  } catch (error) {
    console.error('批量删除账号失败:', error);
    return c.json({ success: false, error: '批量删除账号失败' }, 500);
  }
});

// ==================== 预设平台快捷栏 API ====================

import {
  getPresetPlatforms,
  addPresetPlatform,
  updatePresetPlatform,
  deletePresetPlatform
} from './database';

// 获取所有预设平台
app.get('/api/presets/platforms', async (c) => {
  try {
    const presets = await getPresetPlatforms(c.env.DB);
    return c.json({ success: true, presets });
  } catch (error) {
    console.error('获取预设平台失败:', error);
    return c.json({ success: false, error: '获取预设平台失败' }, 500);
  }
});

// 新增预设平台
app.post('/api/presets/platforms', async (c) => {
  try {
    const body = await c.req.json();
    if (!body.name || !body.name.trim()) {
      return c.json({ success: false, error: '平台名称不能为空' }, 400);
    }
    const preset = await addPresetPlatform(c.env.DB, body.name);
    if (!preset) {
      return c.json({ success: false, error: '该平台已存在或无效' }, 400);
    }
    return c.json({ success: true, preset });
  } catch (error) {
    console.error('新增预设平台失败:', error);
    return c.json({ success: false, error: '新增预设平台失败' }, 500);
  }
});

// 修改预设平台
app.put('/api/presets/platforms', async (c) => {
  try {
    const body = await c.req.json();
    const { oldName, newName } = body;
    if (!oldName || !newName || !oldName.trim() || !newName.trim()) {
      return c.json({ success: false, error: '原名称和新名称都不能为空' }, 400);
    }
    const updated = await updatePresetPlatform(c.env.DB, oldName, newName);
    if (!updated) {
      return c.json({ success: false, error: '修改失败，可能是原名称不存在或新名称已冲突' }, 400);
    }
    return c.json({ success: true });
  } catch (error) {
    console.error('修改预设平台失败:', error);
    return c.json({ success: false, error: '修改预设平台失败' }, 500);
  }
});

// 删除预设平台
app.delete('/api/presets/platforms/:name', async (c) => {
  try {
    const name = c.req.param('name');
    const deleted = await deletePresetPlatform(c.env.DB, name);
    if (!deleted) {
      return c.json({ success: false, error: '删除失败，平台不存在' }, 404);
    }
    return c.json({ success: true });
  } catch (error) {
    console.error('删除预设平台失败:', error);
    return c.json({ success: false, error: '删除预设平台失败' }, 500);
  }
});


export default app;