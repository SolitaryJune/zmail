import React, { useContext } from 'react';
import Container from './Container';
import HeaderMailbox from './HeaderMailbox';
import ThemeSwitcher from './ThemeSwitcher';
import { AuthContext } from '../contexts/AuthContext';

interface HeaderProps {
  mailbox: Mailbox | null;
  onMailboxChange: (mailbox: Mailbox) => void;
  isLoading: boolean;
}

const Header: React.FC<HeaderProps> = ({ mailbox, onMailboxChange, isLoading }) => {
  const { logout } = useContext(AuthContext);

  return (
    <header className="border-b">
      <Container>
        <div className="flex items-center justify-between h-14">
          {/* 左侧标题 */}
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold">🔐 私人管理</span>
          </div>

          {/* 中间邮箱操作 */}
          <div className="flex-1 mx-4">
            <HeaderMailbox 
              mailbox={mailbox} 
              onMailboxChange={onMailboxChange} 
              isLoading={isLoading}
            />
          </div>

          {/* 右侧工具 */}
          <div className="flex items-center gap-1">
            <ThemeSwitcher />
            <button
              onClick={logout}
              className="w-8 h-8 flex items-center justify-center rounded-md transition-all duration-200 hover:bg-destructive/20 hover:text-destructive hover:scale-110"
              title="退出登录"
            >
              <i className="fas fa-sign-out-alt text-base"></i>
            </button>
          </div>
        </div>
      </Container>
    </header>
  );
};

export default Header;