import React from 'react';
import Container from './Container';

const Footer: React.FC = () => {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t py-4">
      <Container>
        <div className="text-center text-xs text-muted-foreground">
          <p>© {year} 私人账号管理工具</p>
        </div>
      </Container>
    </footer>
  );
};

export default Footer;
