import React, { useContext } from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import { MailboxContext } from '../contexts/MailboxContext';

const Layout: React.FC = () => {
  const { mailbox, setMailbox, isLoading } = useContext(MailboxContext);
  
  return (
    <div className="flex min-h-screen flex-col">
      <Header 
        mailbox={mailbox} 
        onMailboxChange={setMailbox} 
        isLoading={isLoading}
      />
      <main className="flex-1 py-6">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};

export default Layout;