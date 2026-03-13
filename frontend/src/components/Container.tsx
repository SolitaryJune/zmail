import React, { ReactNode } from 'react';

interface ContainerProps {
  children: ReactNode;
  className?: string;
}

// 共享容器组件，确保一致的宽度
const Container: React.FC<ContainerProps> = ({ children, className = '' }) => {
  return (
    <div className={`max-w-6xl mx-auto px-4 w-full ${className}`}>
      {children}
    </div>
  );
};

export default Container; 