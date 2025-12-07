import { useState } from 'react';
import { User } from '../App';
import { MessageSquare } from 'lucide-react';
import { supabase } from '../App';
import { projectId, publicAnonKey } from '../utils/supabase/info';

interface LoginPageProps {
  onLogin: (user: User) => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'hr' | 'employee'>('employee');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!email || !password || (!isLogin && !name)) {
      setError('Mohon lengkapi semua field');
      setLoading(false);
      return;
    }

    try {
      if (isLogin) {
        // Login with Supabase
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          console.log('Login error:', signInError);
          setError(signInError.message || 'Email atau password salah');
          setLoading(false);
          return;
        }

        if (data.session?.user) {
          const user: User = {
            id: data.session.user.id,
            email: data.session.user.email || '',
            name: data.session.user.user_metadata?.name || 'Unknown',
            role: data.session.user.user_metadata?.role || 'employee',
            accessToken: data.session.access_token,
          };
          onLogin(user);
        }
      } else {
        // Register with server
        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-a177d153/signup`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${publicAnonKey}`,
            },
            body: JSON.stringify({ email, password, name, role }),
          }
        );

        const data = await response.json();

        if (!response.ok) {
          console.log('Signup error:', data.error);
          setError(data.error || 'Gagal membuat akun');
          setLoading(false);
          return;
        }

        // After successful signup, auto login
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          setError('Akun berhasil dibuat, silakan login');
          setIsLogin(true);
          setLoading(false);
          return;
        }

        if (signInData.session?.user) {
          const user: User = {
            id: signInData.session.user.id,
            email: signInData.session.user.email || '',
            name: signInData.session.user.user_metadata?.name || name,
            role: signInData.session.user.user_metadata?.role || role,
            accessToken: signInData.session.access_token,
          };
          onLogin(user);
        }
      }
    } catch (error) {
      console.log('Auth exception:', error);
      setError('Terjadi kesalahan, silakan coba lagi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-8 border border-purple-500/20">
        <div className="flex items-center justify-center mb-6">
          <div className="bg-gradient-to-r from-purple-600 to-cyan-500 p-3 rounded-full">
            <MessageSquare className="w-8 h-8 text-white" />
          </div>
        </div>
        
        <h1 className="text-center text-white mb-2">
          Chatbot Training Pegawai Magang
        </h1>
        <p className="text-center text-purple-300 mb-6">
          {isLogin ? 'Masuk ke akun Anda' : 'Buat akun baru'}
        </p>

        {error && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label htmlFor="name" className="block text-purple-200 mb-2">
                Nama Lengkap
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 bg-slate-700 border border-purple-500/30 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-white placeholder-slate-400"
                placeholder="Masukkan nama lengkap"
              />
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-purple-200 mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 bg-slate-700 border border-purple-500/30 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-white placeholder-slate-400"
              placeholder="contoh@email.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-purple-200 mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 bg-slate-700 border border-purple-500/30 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-white placeholder-slate-400"
              placeholder="Masukkan password"
            />
          </div>

          {!isLogin && (
            <div>
              <label htmlFor="role" className="block text-purple-200 mb-2">
                Role
              </label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value as 'hr' | 'employee')}
                className="w-full px-4 py-2 bg-slate-700 border border-purple-500/30 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-white"
              >
                <option value="employee">Pegawai Magang</option>
                <option value="hr">HR</option>
              </select>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-purple-600 to-cyan-500 text-white py-3 rounded-lg hover:from-purple-700 hover:to-cyan-600 transition-all shadow-lg shadow-purple-500/50 disabled:from-slate-600 disabled:to-slate-600 disabled:cursor-not-allowed"
          >
            {loading ? 'Memproses...' : (isLogin ? 'Masuk' : 'Daftar')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
            }}
            className="text-purple-300 hover:text-purple-200"
          >
            {isLogin ? 'Belum punya akun? Daftar' : 'Sudah punya akun? Masuk'}
          </button>
        </div>
      </div>
    </div>
  );
}