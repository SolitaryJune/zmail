import { D1Database } from '@cloudflare/workers-types';
import { 
  Mailbox, 
  CreateMailboxParams, 
  Email, 
  SaveEmailParams, 
  EmailListItem,
  Attachment,
  AttachmentListItem,
  SaveAttachmentParams,
  Account,
  CreateAccountParams,
  UpdateAccountParams
} from './types';
import { 
  generateId, 
  getCurrentTimestamp, 
  calculateExpiryTimestamp 
} from './utils';

// 附件分块大小（字节）
const CHUNK_SIZE = 500000; // 约500KB

/**
 * 初始化数据库
 * @param db 数据库实例
 */
export async function initializeDatabase(db: D1Database): Promise<void> {
  try {
    // 创建邮箱表
    await db.exec(`CREATE TABLE IF NOT EXISTS mailboxes (id TEXT PRIMARY KEY, address TEXT UNIQUE NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, ip_address TEXT, last_accessed INTEGER NOT NULL);`);
    
    // 创建邮件表
    await db.exec(`CREATE TABLE IF NOT EXISTS emails (id TEXT PRIMARY KEY, mailbox_id TEXT NOT NULL, from_address TEXT NOT NULL, from_name TEXT, to_address TEXT NOT NULL, subject TEXT, text_content TEXT, html_content TEXT, received_at INTEGER NOT NULL, has_attachments BOOLEAN DEFAULT FALSE, is_read BOOLEAN DEFAULT FALSE, FOREIGN KEY (mailbox_id) REFERENCES mailboxes(id) ON DELETE CASCADE);`);
    
    // 创建附件表
    await db.exec(`CREATE TABLE IF NOT EXISTS attachments (id TEXT PRIMARY KEY, email_id TEXT NOT NULL, filename TEXT NOT NULL, mime_type TEXT NOT NULL, content TEXT, size INTEGER NOT NULL, created_at INTEGER NOT NULL, is_large BOOLEAN DEFAULT FALSE, chunks_count INTEGER DEFAULT 0, FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE);`);
    
    // 创建附件块表
    await db.exec(`CREATE TABLE IF NOT EXISTS attachment_chunks (id TEXT PRIMARY KEY, attachment_id TEXT NOT NULL, chunk_index INTEGER NOT NULL, content TEXT NOT NULL, FOREIGN KEY (attachment_id) REFERENCES attachments(id) ON DELETE CASCADE);`);
    
    // 创建索引
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_mailboxes_address ON mailboxes(address);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_mailboxes_expires_at ON mailboxes(expires_at);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_emails_mailbox_id ON emails(mailbox_id);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_emails_received_at ON emails(received_at);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_attachments_email_id ON attachments(email_id);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_attachment_chunks_attachment_id ON attachment_chunks(attachment_id);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_attachment_chunks_chunk_index ON attachment_chunks(chunk_index);`);
    
    // 创建账号表
    await db.exec(`CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, title TEXT NOT NULL, username TEXT DEFAULT '', email TEXT DEFAULT '', password TEXT DEFAULT '', phone TEXT DEFAULT '', platforms TEXT DEFAULT '[]', notes TEXT DEFAULT '', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);`);
    
    // 创建账号索引
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_accounts_title ON accounts(title);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_accounts_email ON accounts(email);`);
    await db.exec(`CREATE INDEX IF NOT EXISTS idx_accounts_updated_at ON accounts(updated_at);`);
    
    // 创建预设平台表
    await db.exec(`CREATE TABLE IF NOT EXISTS platform_presets (id TEXT PRIMARY KEY, name TEXT UNIQUE NOT NULL, created_at INTEGER NOT NULL);`);
    
    // 检查并插入默认平台（如果预设表为空）
    const presetCountResult = await db.prepare('SELECT count(*) as count FROM platform_presets').first();
    const count = (presetCountResult?.count as number) || 0;
    if (count === 0) {
      const defaultPlatforms = ['ChatGPT', 'Claude', 'Gemini', 'Midjourney', 'Poe', 'Coze', 'GitHub', 'Google'];
      const now = Math.floor(Date.now() / 1000);
      for (const p of defaultPlatforms) {
        await db.prepare('INSERT INTO platform_presets (id, name, created_at) VALUES (?, ?, ?)')
                .bind(generateId(), p, now)
                .run();
      }
    }

    console.log('数据库初始化成功');
  } catch (error) {
    console.error('数据库初始化失败:', error);
    // 抛出错误，让上层处理
    throw new Error(`数据库初始化失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 创建邮箱
 * @param db 数据库实例
 * @param params 参数
 * @returns 创建的邮箱
 */
export async function createMailbox(db: D1Database, params: CreateMailboxParams): Promise<Mailbox> {
  const now = getCurrentTimestamp();
  const mailbox: Mailbox = {
    id: generateId(),
    address: params.address,
    createdAt: now,
    expiresAt: calculateExpiryTimestamp(params.expiresInHours),
    ipAddress: params.ipAddress,
    lastAccessed: now,
  };
  
  await db.prepare(`INSERT INTO mailboxes (id, address, created_at, expires_at, ip_address, last_accessed) VALUES (?, ?, ?, ?, ?, ?)`).bind(mailbox.id, mailbox.address, mailbox.createdAt, mailbox.expiresAt, mailbox.ipAddress, mailbox.lastAccessed).run();
  
  return mailbox;
}

/**
 * 获取邮箱信息
 * @param db 数据库实例
 * @param address 邮箱地址
 * @returns 邮箱信息
 */
export async function getMailbox(db: D1Database, address: string): Promise<Mailbox | null> {
  const now = getCurrentTimestamp();
  const result = await db.prepare(`SELECT id, address, created_at, expires_at, ip_address, last_accessed FROM mailboxes WHERE address = ? AND expires_at > ?`).bind(address, now).first();
  
  if (!result) return null;
  
  // 更新最后访问时间
  await db.prepare(`UPDATE mailboxes SET last_accessed = ? WHERE id = ?`).bind(now, result.id).run();
  
  return {
    id: result.id as string,
    address: result.address as string,
    createdAt: result.created_at as number,
    expiresAt: result.expires_at as number,
    ipAddress: result.ip_address as string,
    lastAccessed: now,
  };
}

/**
 * 按地址查找邮箱（不过滤过期时间，收件总览用）
 * @param db 数据库实例
 * @param address 邮箱地址
 * @returns 邮箱信息
 */
export async function getMailboxByAddress(db: D1Database, address: string): Promise<Mailbox | null> {
  const result = await db.prepare(`SELECT id, address, created_at, expires_at, ip_address, last_accessed FROM mailboxes WHERE address = ?`).bind(address).first();
  
  if (!result) return null;
  
  return {
    id: result.id as string,
    address: result.address as string,
    createdAt: result.created_at as number,
    expiresAt: result.expires_at as number,
    ipAddress: result.ip_address as string,
    lastAccessed: result.last_accessed as number,
  };
}

/**
 * 获取用户的所有邮箱
 * @param db 数据库实例
 * @param ipAddress IP地址
 * @returns 邮箱列表
 */
export async function getMailboxes(db: D1Database, ipAddress: string): Promise<Mailbox[]> {
  const now = getCurrentTimestamp();
  const results = await db.prepare(`SELECT id, address, created_at, expires_at, ip_address, last_accessed FROM mailboxes WHERE ip_address = ? AND expires_at > ? ORDER BY created_at DESC`).bind(ipAddress, now).all();
  
  if (!results.results) return [];
  
  return results.results.map(result => ({
    id: result.id as string,
    address: result.address as string,
    createdAt: result.created_at as number,
    expiresAt: result.expires_at as number,
    ipAddress: result.ip_address as string,
    lastAccessed: result.last_accessed as number,
  }));
}

/**
 * 获取所有邮箱（收件总览用，不过滤过期）
 * @param db 数据库实例
 * @returns 邮箱列表（含邮件统计）
 */
export async function getAllMailboxes(db: D1Database): Promise<(Mailbox & { emailCount: number; unreadCount: number })[]> {
  const results = await db.prepare(`
    SELECT 
      m.id, m.address, m.created_at, m.expires_at, m.ip_address, m.last_accessed,
      COALESCE(e.total, 0) as email_count,
      COALESCE(e.unread, 0) as unread_count
    FROM mailboxes m
    LEFT JOIN (
      SELECT mailbox_id, COUNT(*) as total, SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) as unread
      FROM emails GROUP BY mailbox_id
    ) e ON m.id = e.mailbox_id
    ORDER BY CASE WHEN COALESCE(e.total, 0) > 0 THEN 0 ELSE 1 END, m.created_at DESC
  `).all();

  if (!results.results) return [];

  return results.results.map(result => ({
    id: result.id as string,
    address: result.address as string,
    createdAt: result.created_at as number,
    expiresAt: result.expires_at as number,
    ipAddress: result.ip_address as string,
    lastAccessed: result.last_accessed as number,
    emailCount: result.email_count as number,
    unreadCount: result.unread_count as number,
  }));
}

/**
 * 删除邮箱
 * @param db 数据库实例
 * @param address 邮箱地址
 */
export async function deleteMailbox(db: D1Database, address: string): Promise<void> {
  // [feat] 由于外键设置了 ON DELETE CASCADE，直接删除邮箱即可级联删除相关邮件和附件
  await db.prepare(`DELETE FROM mailboxes WHERE address = ?`).bind(address).run();
}

/**
 * 清理孤立的附件（没有关联到任何邮件的附件）
 * @param db 数据库实例
 * @returns 删除的附件数量
 */
async function cleanupOrphanedAttachments(db: D1Database): Promise<number> {
    // [refactor] 优化孤立附件的清理逻辑
    try {
        // 一次性查询所有孤立附件及其分块信息
        const orphanedAttachmentsResult = await db.prepare(`
            SELECT a.id 
            FROM attachments a 
            LEFT JOIN emails e ON a.email_id = e.id 
            WHERE e.id IS NULL
        `).all<{ id: string }>();

        if (!orphanedAttachmentsResult.results || orphanedAttachmentsResult.results.length === 0) {
            return 0;
        }

        const attachmentIds = orphanedAttachmentsResult.results.map(row => row.id);
        const placeholders = attachmentIds.map(() => '?').join(',');

        console.log(`找到 ${attachmentIds.length} 个孤立附件，准备清理...`);

        // 批量删除附件分块
        await db.prepare(`DELETE FROM attachment_chunks WHERE attachment_id IN (${placeholders})`).bind(...attachmentIds).run();
        console.log(`已清理孤立附件的所有分块`);

        // 批量删除附件记录
        const deleteResult = await db.prepare(`DELETE FROM attachments WHERE id IN (${placeholders})`).bind(...attachmentIds).run();
        const deletedCount = deleteResult.meta?.changes || 0;
        console.log(`已清理 ${deletedCount} 个孤立附件记录`);

        return deletedCount;
    } catch (error) {
        console.error('清理孤立附件时出错:', error);
        return 0;
    }
}

/**
 * 清理过期邮箱
 * @param db 数据库实例
 * @returns 删除的邮箱数量
 */
export async function cleanupExpiredMailboxes(db: D1Database): Promise<number> {
  const now = getCurrentTimestamp();
  // [refactor] 由于数据库 schema 中设置了 ON DELETE CASCADE，
  // 删除 mailboxes 表中的记录会自动删除 emails, attachments, 和 attachment_chunks 中所有相关的记录。
  // 这大大简化了清理逻辑，并提高了性能。
  const result = await db.prepare(`DELETE FROM mailboxes WHERE expires_at <= ?`).bind(now).run();
  
  // 清理可能由于异常情况产生的孤立附件
  await cleanupOrphanedAttachments(db);
  
  return result.meta?.changes || 0;
}

/**
 * 清理过期邮件
 * @param db 数据库实例
 * @returns 删除的邮件数量
 */
export async function cleanupExpiredMails(db: D1Database): Promise<number> {
  const now = getCurrentTimestamp();
  const oneDayAgo = now - 24 * 60 * 60; // 24小时前的时间戳（秒）
  
  // [refactor] 同样利用 ON DELETE CASCADE 特性简化逻辑
  const result = await db.prepare(`DELETE FROM emails WHERE received_at <= ?`).bind(oneDayAgo).run();
  
  await cleanupOrphanedAttachments(db);
  
  return result.meta?.changes || 0;
}

/**
 * 清理已被阅读的邮件
 * @param db 数据库实例
 * @returns 删除的邮件数量
 */
export async function cleanupReadMails(db: D1Database): Promise<number> {
  // [refactor] 同样利用 ON DELETE CASCADE 特性简化逻辑
  const result = await db.prepare(`DELETE FROM emails WHERE is_read = 1`).run();
  
  await cleanupOrphanedAttachments(db);
  
  return result.meta?.changes || 0;
}

/**
 * 清理指定邮件的所有附件
 * @param db 数据库实例
 * @param emailId 邮件ID
 */
async function cleanupAttachments(db: D1Database, emailId: string): Promise<void> {
  // [refactor] 利用 ON DELETE CASCADE，此函数在删除邮件时不再需要手动调用。
  // 但保留此函数以备其他需要单独清理附件的场景。
  try {
    // 获取邮件的所有附件ID
    const attachmentsResult = await db.prepare(`SELECT id FROM attachments WHERE email_id = ?`).bind(emailId).all<{ id: string }>();
    
    if (attachmentsResult.results && attachmentsResult.results.length > 0) {
      const attachmentIds = attachmentsResult.results.map(row => row.id);
      const placeholders = attachmentIds.map(() => '?').join(',');

      console.log(`邮件 ${emailId} 有 ${attachmentIds.length} 个附件需要清理`);
      
      // 批量删除所有分块
      await db.prepare(`DELETE FROM attachment_chunks WHERE attachment_id IN (${placeholders})`).bind(...attachmentIds).run();
      console.log(`已清理附件的所有分块`);
      
      // 批量删除所有附件记录
      await db.prepare(`DELETE FROM attachments WHERE id IN (${placeholders})`).bind(...attachmentIds).run();
      console.log(`已清理邮件 ${emailId} 的所有附件`);
    }
  } catch (error) {
    console.error(`清理邮件 ${emailId} 的附件时出错:`, error);
  }
}

/**
 * 保存邮件
 * @param db 数据库实例
 * @param params 参数
 * @returns 保存的邮件
 */
export async function saveEmail(db: D1Database, params: SaveEmailParams): Promise<Email> {
  try {
    console.log('开始保存邮件...');
    
    const now = getCurrentTimestamp();
    const email: Email = {
      id: generateId(),
      mailboxId: params.mailboxId,
      fromAddress: params.fromAddress,
      fromName: params.fromName || '',
      toAddress: params.toAddress,
      subject: params.subject || '',
      textContent: params.textContent || '',
      htmlContent: params.htmlContent || '',
      receivedAt: now,
      hasAttachments: params.hasAttachments || false,
      isRead: false,
    };
    
    console.log('准备插入邮件:', email.id);
    
    await db.prepare(`INSERT INTO emails (id, mailbox_id, from_address, from_name, to_address, subject, text_content, html_content, received_at, has_attachments, is_read) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(email.id, email.mailboxId, email.fromAddress, email.fromName, email.toAddress, email.subject, email.textContent, email.htmlContent, email.receivedAt, email.hasAttachments ? 1 : 0, email.isRead ? 1 : 0).run();
    
    console.log('邮件保存成功:', email.id);
    
    return email;
  } catch (error) {
    console.error('保存邮件失败:', error);
    throw new Error(`保存邮件失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 保存附件
 * @param db 数据库实例
 * @param params 参数
 * @returns 保存的附件
 */
export async function saveAttachment(db: D1Database, params: SaveAttachmentParams): Promise<Attachment> {
  try {
    console.log('开始保存附件...');
    
    const now = getCurrentTimestamp();
    const attachmentId = generateId();
    
    // 检查附件大小，决定是否需要分块存储
    const isLarge = params.content.length > CHUNK_SIZE;
    console.log(`附件大小: ${params.content.length} 字节, 是否为大型附件: ${isLarge}`);
    
    if (isLarge) {
      // 大型附件，需要分块存储
      const contentLength = params.content.length;
      const chunksCount = Math.ceil(contentLength / CHUNK_SIZE);
      console.log(`将附件分为 ${chunksCount} 块存储`);
      
      // 创建附件记录，但不存储内容
      const attachment: Attachment = {
        id: attachmentId,
        emailId: params.emailId,
        filename: params.filename,
        mimeType: params.mimeType,
        content: '', // 大型附件不在主表存储内容
        size: params.size,
        createdAt: now,
        isLarge: true,
        chunksCount: chunksCount
      };
      
      // 插入附件记录
      await db.prepare(`INSERT INTO attachments (id, email_id, filename, mime_type, content, size, created_at, is_large, chunks_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(attachment.id, attachment.emailId, attachment.filename, attachment.mimeType, attachment.content, attachment.size, attachment.createdAt, attachment.isLarge ? 1 : 0, attachment.chunksCount).run();
      
      // 分块存储附件内容
      for (let i = 0; i < chunksCount; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, contentLength);
        const chunkContent = params.content.substring(start, end);
        const chunkId = generateId();
        
        await db.prepare(`INSERT INTO attachment_chunks (id, attachment_id, chunk_index, content) VALUES (?, ?, ?, ?)`).bind(chunkId, attachment.id, i, chunkContent).run();
        console.log(`保存附件块 ${i+1}/${chunksCount}`);
      }
      
      console.log('大型附件保存成功:', attachment.id);
      return attachment;
    } else {
      // 小型附件，直接存储
      const attachment: Attachment = {
        id: attachmentId,
        emailId: params.emailId,
        filename: params.filename,
        mimeType: params.mimeType,
        content: params.content,
        size: params.size,
        createdAt: now,
        isLarge: false,
        chunksCount: 0
      };
      
      await db.prepare(`INSERT INTO attachments (id, email_id, filename, mime_type, content, size, created_at, is_large, chunks_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(attachment.id, attachment.emailId, attachment.filename, attachment.mimeType, attachment.content, attachment.size, attachment.createdAt, attachment.isLarge ? 1 : 0, attachment.chunksCount).run();
      
      console.log('小型附件保存成功:', attachment.id);
      return attachment;
    }
  } catch (error) {
    console.error('保存附件失败:', error);
    throw new Error(`保存附件失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 获取邮件列表
 * @param db 数据库实例
 * @param mailboxId 邮箱ID
 * @returns 邮件列表
 */
export async function getEmails(db: D1Database, mailboxId: string): Promise<EmailListItem[]> {
  const results = await db.prepare(`SELECT id, mailbox_id, from_address, from_name, to_address, subject, received_at, has_attachments, is_read FROM emails WHERE mailbox_id = ? ORDER BY received_at DESC`).bind(mailboxId).all();
  
  if (!results.results) return [];
  
  return results.results.map(result => ({
    id: result.id as string,
    mailboxId: result.mailbox_id as string,
    fromAddress: result.from_address as string,
    fromName: result.from_name as string,
    toAddress: result.to_address as string,
    subject: result.subject as string,
    receivedAt: result.received_at as number,
    hasAttachments: !!result.has_attachments,
    isRead: !!result.is_read,
  }));
}

/**
 * 获取邮件详情
 * @param db 数据库实例
 * @param id 邮件ID
 * @returns 邮件详情
 */
export async function getEmail(db: D1Database, id: string): Promise<Email | null> {
  const result = await db.prepare(`SELECT id, mailbox_id, from_address, from_name, to_address, subject, text_content, html_content, received_at, has_attachments, is_read FROM emails WHERE id = ?`).bind(id).first();
  
  if (!result) return null;
  
  // 标记为已读
  await db.prepare(`UPDATE emails SET is_read = 1 WHERE id = ?`).bind(id).run();
  
  return {
    id: result.id as string,
    mailboxId: result.mailbox_id as string,
    fromAddress: result.from_address as string,
    fromName: result.from_name as string,
    toAddress: result.to_address as string,
    subject: result.subject as string,
    textContent: result.text_content as string,
    htmlContent: result.html_content as string,
    receivedAt: result.received_at as number,
    hasAttachments: !!result.has_attachments,
    isRead: true,
  };
}

/**
 * 获取附件列表
 * @param db 数据库实例
 * @param emailId 邮件ID
 * @returns 附件列表
 */
export async function getAttachments(db: D1Database, emailId: string): Promise<AttachmentListItem[]> {
  const results = await db.prepare(`SELECT id, email_id, filename, mime_type, size, created_at, is_large, chunks_count FROM attachments WHERE email_id = ? ORDER BY created_at ASC`).bind(emailId).all();
  
  if (!results.results) return [];
  
  return results.results.map(result => ({
    id: result.id as string,
    emailId: result.email_id as string,
    filename: result.filename as string,
    mimeType: result.mime_type as string,
    size: result.size as number,
    createdAt: result.created_at as number,
    isLarge: !!result.is_large,
    chunksCount: result.chunks_count as number
  }));
}

/**
 * 获取附件详情
 * @param db 数据库实例
 * @param id 附件ID
 * @returns 附件详情
 */
export async function getAttachment(db: D1Database, id: string): Promise<Attachment | null> {
  const result = await db.prepare(`SELECT id, email_id, filename, mime_type, content, size, created_at, is_large, chunks_count FROM attachments WHERE id = ?`).bind(id).first();
  
  if (!result) return null;
  
  const isLarge = !!result.is_large;
  let content = result.content as string;
  
  // 如果是大型附件，需要从块表中获取内容
  if (isLarge) {
    const chunksCount = result.chunks_count as number;
    content = await getAttachmentContent(db, id, chunksCount);
  }
  
  return {
    id: result.id as string,
    emailId: result.email_id as string,
    filename: result.filename as string,
    mimeType: result.mime_type as string,
    content: content,
    size: result.size as number,
    createdAt: result.created_at as number,
    isLarge: isLarge,
    chunksCount: result.chunks_count as number
  };
}

/**
 * 获取大型附件的内容
 * @param db 数据库实例
 * @param attachmentId 附件ID
 * @param chunksCount 块数量
 * @returns 完整的附件内容
 */
async function getAttachmentContent(db: D1Database, attachmentId: string, chunksCount: number): Promise<string> {
  let content = '';
  
  // 按顺序获取所有块
  for (let i = 0; i < chunksCount; i++) {
    const chunk = await db.prepare(`SELECT content FROM attachment_chunks WHERE attachment_id = ? AND chunk_index = ?`).bind(attachmentId, i).first();
    if (chunk && chunk.content) {
      content += chunk.content as string;
    }
  }
  
  return content;
}

/**
 * 删除邮件
 * @param db 数据库实例
 * @param id 邮件ID
 */
export async function deleteEmail(db: D1Database, id: string): Promise<void> {
  // [refactor] 由于外键设置了 ON DELETE CASCADE，直接删除邮件即可
  await db.prepare(`DELETE FROM emails WHERE id = ?`).bind(id).run();
}

// ==================== 账号管理相关函数 ====================

/**
 * 创建账号
 */
export async function createAccount(db: D1Database, params: CreateAccountParams): Promise<Account> {
  const now = getCurrentTimestamp();
  const account: Account = {
    id: generateId(),
    title: params.title,
    username: params.username || '',
    email: params.email || '',
    password: params.password || '',
    phone: params.phone || '',
    platforms: params.platforms || [],
    notes: params.notes || '',
    createdAt: now,
    updatedAt: now,
  };
  
  await db.prepare(
    `INSERT INTO accounts (id, title, username, email, password, phone, platforms, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    account.id, account.title, account.username, account.email,
    account.password, account.phone, JSON.stringify(account.platforms),
    account.notes, account.createdAt, account.updatedAt
  ).run();
  
  return account;
}

/**
 * 获取账号列表（支持搜索和平台筛选）
 */
export async function getAccounts(db: D1Database, search?: string, platform?: string): Promise<Account[]> {
  let query = `SELECT * FROM accounts`;
  const conditions: string[] = [];
  const bindings: string[] = [];
  
  if (search) {
    conditions.push(`(title LIKE ? OR username LIKE ? OR email LIKE ? OR phone LIKE ? OR notes LIKE ?)`);
    const searchPattern = `%${search}%`;
    bindings.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
  }
  
  if (platform) {
    conditions.push(`platforms LIKE ?`);
    bindings.push(`%"${platform}"%`);
  }
  
  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(' AND ')}`;
  }
  
  query += ` ORDER BY updated_at DESC`;
  
  const stmt = db.prepare(query);
  const results = bindings.length > 0 ? await stmt.bind(...bindings).all() : await stmt.all();
  
  if (!results.results) return [];
  
  return results.results.map(row => {
    let parsedPlatforms: string[] = [];
    try {
      const p = JSON.parse((row.platforms as string) || '[]');
      parsedPlatforms = Array.isArray(p) ? p : (typeof p === 'string' && p ? [p] : []);
    } catch (e) {
      parsedPlatforms = [];
    }

    return {
      id: row.id as string,
      title: row.title as string,
      username: row.username as string,
      email: row.email as string,
      password: row.password as string,
      phone: row.phone as string,
      platforms: parsedPlatforms,
      notes: row.notes as string,
      createdAt: row.created_at as number,
      updatedAt: row.updated_at as number,
    };
  });
}

/**
 * 获取单个账号详情
 */
export async function getAccount(db: D1Database, id: string): Promise<Account | null> {
  const result = await db.prepare(`SELECT * FROM accounts WHERE id = ?`).bind(id).first();
  
  if (!result) return null;
  
  let parsedPlatforms: string[] = [];
  try {
    const p = JSON.parse((result.platforms as string) || '[]');
    parsedPlatforms = Array.isArray(p) ? p : (typeof p === 'string' && p ? [p] : []);
  } catch (e) {
    parsedPlatforms = [];
  }

  return {
    id: result.id as string,
    title: result.title as string,
    username: result.username as string,
    email: result.email as string,
    password: result.password as string,
    phone: result.phone as string,
    platforms: parsedPlatforms,
    notes: result.notes as string,
    createdAt: result.created_at as number,
    updatedAt: result.updated_at as number,
  };
}

/**
 * 更新账号
 */
export async function updateAccount(db: D1Database, id: string, params: UpdateAccountParams): Promise<Account | null> {
  const existing = await getAccount(db, id);
  if (!existing) return null;
  
  const now = getCurrentTimestamp();
  const updated: Account = {
    ...existing,
    title: params.title !== undefined ? params.title : existing.title,
    username: params.username !== undefined ? params.username : existing.username,
    email: params.email !== undefined ? params.email : existing.email,
    password: params.password !== undefined ? params.password : existing.password,
    phone: params.phone !== undefined ? params.phone : existing.phone,
    platforms: params.platforms !== undefined ? params.platforms : existing.platforms,
    notes: params.notes !== undefined ? params.notes : existing.notes,
    updatedAt: now,
  };
  
  await db.prepare(
    `UPDATE accounts SET title = ?, username = ?, email = ?, password = ?, phone = ?, platforms = ?, notes = ?, updated_at = ? WHERE id = ?`
  ).bind(
    updated.title, updated.username, updated.email, updated.password,
    updated.phone, JSON.stringify(updated.platforms), updated.notes,
    updated.updatedAt, id
  ).run();
  
  return updated;
}

/**
 * 删除账号
 */
export async function deleteAccount(db: D1Database, id: string): Promise<boolean> {
  const result = await db.prepare(`DELETE FROM accounts WHERE id = ?`).bind(id).run();
  return (result.meta?.changes || 0) > 0;
}

/**
 * 获取所有已使用的平台列表（用于筛选下拉）
 */
export async function getAllPlatforms(db: D1Database): Promise<string[]> {
  const results = await db.prepare(`SELECT DISTINCT platforms FROM accounts`).all();
  if (!results.results) return [];
  
  const platformSet = new Set<string>();
  for (const row of results.results) {
    try {
      const platforms = JSON.parse((row.platforms as string) || '[]');
      for (const p of platforms) {
        if (p) platformSet.add(p);
      }
    } catch (_e) {
      // 忽略解析错误
    }
  }
  
  return Array.from(platformSet).sort();
}

// ==================== 预设平台相关函数 ====================

import { PlatformPreset } from './types';

/**
 * 获取所有预设平台列表（用于快捷输入栏）
 */
export async function getPresetPlatforms(db: D1Database): Promise<PlatformPreset[]> {
  const results = await db.prepare(`SELECT * FROM platform_presets ORDER BY created_at ASC`).all();
  if (!results.results) return [];
  
  return results.results.map(row => ({
    id: row.id as string,
    name: row.name as string,
    createdAt: row.created_at as number,
  }));
}

/**
 * 添加新的预设平台
 * 会根据不区分大小写进行冲突检查
 */
export async function addPresetPlatform(db: D1Database, name: string): Promise<PlatformPreset | null> {
  const trimmedName = name.trim();
  if (!trimmedName) return null;

  // 检查是否已经存在（忽略大小写）
  const existing = await db.prepare(`SELECT id FROM platform_presets WHERE lower(name) = lower(?)`)
    .bind(trimmedName).first();
    
  if (existing) {
    return null; // 名字冲突
  }
  
  const now = getCurrentTimestamp();
  const preset: PlatformPreset = {
    id: generateId(),
    name: trimmedName,
    createdAt: now,
  };
  
  await db.prepare(`INSERT INTO platform_presets (id, name, created_at) VALUES (?, ?, ?)`)
    .bind(preset.id, preset.name, preset.createdAt)
    .run();
    
  return preset;
}

/**
 * 重命名预设平台
 * 不级联处理历史账号，只管本地快捷模板
 */
export async function updatePresetPlatform(db: D1Database, oldName: string, newName: string): Promise<boolean> {
  const trimmedOld = oldName.trim();
  const trimmedNew = newName.trim();
  if (!trimmedOld || !trimmedNew) return false;

  // 检查新名称是否与其他已经存在的预设冲突（不区分大小写）
  const existing = await db.prepare(`SELECT id, name FROM platform_presets WHERE lower(name) = lower(?) AND lower(name) != lower(?)`)
    .bind(trimmedNew, trimmedOld).first();
    
  if (existing) {
    return false; // 新名字和另外一个已有预设冲突
  }
  
  const result = await db.prepare(`UPDATE platform_presets SET name = ? WHERE name = ?`)
    .bind(trimmedNew, trimmedOld).run();
    
  return (result.meta?.changes || 0) > 0;
}

/**
 * 删除预设平台
 */
export async function deletePresetPlatform(db: D1Database, name: string): Promise<boolean> {
  const trimmedName = name.trim();
  if (!trimmedName) return false;
  
  const result = await db.prepare(`DELETE FROM platform_presets WHERE name = ?`)
    .bind(trimmedName).run();
    
  return (result.meta?.changes || 0) > 0;
}