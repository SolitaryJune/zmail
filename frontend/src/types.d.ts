// 允许导入 JSON 文件
declare module '*.json' {
  const value: any;
  export default value;
}

// 定义邮箱相关类型
interface Mailbox {
  id: string;
  address: string;
  createdAt: number;
  expiresAt: number;
  lastAccessed: number;
  ipAddress?: string;
}

interface Email {
  id: string;
  mailboxId: string;
  fromAddress: string;
  fromName?: string;
  toAddress: string;
  subject?: string;
  textContent?: string;
  htmlContent?: string;
  receivedAt: number;
  hasAttachments: boolean;
  isRead: boolean;
}

interface Attachment {
  id: string;
  emailId: string;
  filename: string;
  contentType: string;
  content: ArrayBuffer;
  size: number;
}

interface Account {
  id: string;
  title: string;
  username: string;
  email: string;
  password: string;
  phone: string;
  platforms: string[];
  notes: string;
  createdAt: number;
  updatedAt: number;
}

// Toast 相关类型
interface Toast {
  id: string;
  title?: string;
  description?: string;
  action?: React.ReactNode;
  variant?: 'default' | 'destructive';
}

// 声明环境变量类型
interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_EMAIL_DOMAIN: string;
  readonly VITE_API_BASE_URL: string;
  readonly MODE: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
} 