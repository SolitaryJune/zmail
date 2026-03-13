import React, { useState, useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';

const LoginPage: React.FC = () => {
  const { login } = useContext(AuthContext);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const success = await login(password);
    if (!success) {
      setError('密码错误，请重试');
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">🔐 私人账号管理</h1>
          <p className="text-muted-foreground text-sm">请输入密码以访问</p>
        </div>
        
        <form onSubmit={handleSubmit} className="bg-card border rounded-lg p-6 space-y-4">
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="输入访问密码"
              className="w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              autoFocus
              disabled={isLoading}
            />
          </div>
          
          {error && (
            <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded-md">
              {error}
            </div>
          )}
          
          <button
            type="submit"
            disabled={isLoading || !password}
            className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {isLoading ? '验证中...' : '登录'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
