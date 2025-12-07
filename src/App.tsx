import { useState, useEffect } from 'react';
import { LoginPage } from './components/LoginPage';
import { EmployeeChatPage } from './components/EmployeeChatPage';
import { HRDashboard } from './components/HRDashboard';
import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from './utils/supabase/info';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'hr' | 'employee';
  accessToken: string;
}

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  message: string;
  response: string;
  timestamp: number;
}

export interface TrainingQA {
  id: string;
  question: string;
  answer: string;
  createdAt: number;
}

export interface Document {
  id: string;
  name: string;
  uploadedAt: number;
}

// Create Supabase client
export const supabase = createClient(
  `https://${projectId}.supabase.co`,
  publicAnonKey
);

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user has active session
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.log('Session check error:', error);
        setLoading(false);
        return;
      }

      if (session?.user) {
        const user: User = {
          id: session.user.id,
          email: session.user.email || '',
          name: session.user.user_metadata?.name || 'Unknown',
          role: session.user.user_metadata?.role || 'employee',
          accessToken: session.access_token,
        };
        setCurrentUser(user);
      }
      
      setLoading(false);
    } catch (error) {
      console.log('Session check exception:', error);
      setLoading(false);
    }
  };

  const handleLogin = (user: User) => {
    setCurrentUser(user);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginPage onLogin={handleLogin} />;
  }

  if (currentUser.role === 'employee') {
    return <EmployeeChatPage user={currentUser} onLogout={handleLogout} />;
  }

  return <HRDashboard user={currentUser} onLogout={handleLogout} />;
}

export default App;