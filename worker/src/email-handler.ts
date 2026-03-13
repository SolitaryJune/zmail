import * as PostalMimeModule from 'postal-mime';
import { Env, ParsedEmail } from './types';
import { getMailbox, createMailbox, saveEmail, saveAttachment } from './database';

const PostalMime = PostalMimeModule.default;

/**
 * 处理接收到的邮件
 * @param message 邮件消息
 * @param env 环境变量
 */
export async function handleEmail(message: any, env: Env): Promise<void> {
  try {
    const parser = new PostalMime();
    const email = await parser.parse(message.raw) as ParsedEmail;

    console.log('邮件解析结果:', {
      subject: email.subject,
      from: email.from,
      to: email.to,
      hasHtml: !!email.html,
      hasText: !!email.text,
      attachmentsCount: email.attachments?.length || 0
    });

    // 提取邮箱地址部分（从email.to获取 ）
    const mailboxAddress = email.to[0].address.split('@')[0];
    
    // 查找对应的邮箱
    let mailbox = await getMailbox(env.DB, mailboxAddress);
    
    // 邮箱不存在（可能已过期被删除），自动新建同地址邮箱
    if (!mailbox) {
      console.log(`邮箱 ${mailboxAddress} 不存在，自动新建`);
      mailbox = await createMailbox(env.DB, {
        address: mailboxAddress,
        expiresInHours: 24,
        ipAddress: 'auto-created',
      });
      console.log(`邮箱 ${mailboxAddress} 自动新建成功`);
    }

    // 保存邮件
    const savedEmail = await saveEmail(env.DB, {
      mailboxId: mailbox.id,
      fromAddress: email.from.address,
      fromName: email.from.name || '',
      toAddress: mailboxAddress,
      subject: email.subject || '',
      textContent: email.text || '',
      htmlContent: email.html || '',
      hasAttachments: !!email.attachments?.length,
    });

    // 保存附件（如果有）
    if (email.attachments && email.attachments.length > 0) {
      console.log(`开始保存 ${email.attachments.length} 个附件`);
      
      for (const attachment of email.attachments) {
        try {
          // 将 ArrayBuffer 转换为 Base64 字符串
          const base64Content = arrayBufferToBase64(attachment.content);
          
          // 计算附件大小（字节）
          const size = attachment.size || attachment.content.byteLength;
          
          // 保存附件
          await saveAttachment(env.DB, {
            emailId: savedEmail.id,
            filename: attachment.filename,
            mimeType: attachment.mimeType,
            content: base64Content,
            size: size
          });
          
          console.log(`附件 ${attachment.filename} 保存成功`);
        } catch (attachmentError) {
          console.error(`保存附件 ${attachment.filename} 失败:`, attachmentError);
          // 继续处理其他附件，不中断流程
        }
      }
    }
  } catch (error) {
    console.error('处理邮件失败:', error);
  }
}

/**
 * 将 ArrayBuffer 转换为 Base64 字符串
 * @param buffer ArrayBuffer 数据
 * @returns Base64 字符串
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}