import React, { useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail 
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { Lock, Mail, ShieldCheck, AlertCircle, ArrowRight, KeyRound, ShieldAlert } from 'lucide-react';
import type { AppSettings } from '../types';

interface LoginProps {
  settings: AppSettings | null;
}

export function Login({ settings }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        setError('Acceso denegado. Correo o contraseña incorrectos, o este usuario no ha sido autorizado manualmente.');
      } else if (err.code === 'auth/invalid-email') {
        setError('El formato del correo electrónico no es válido.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Demasiados intentos fallidos. Por seguridad, la cuenta se ha bloqueado temporalmente. Intenta más tarde o restablece tu contraseña.');
      } else {
        setError(err.message || 'Error de autenticación. Verifica tus datos.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!email) {
      setError('Ingresa tu correo electrónico registrado en el campo superior para enviarte el enlace de recuperación.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setResetEmailSent(true);
      setShowResetModal(false);
    } catch (err: any) {
      setError('No se pudo enviar el correo de recuperación. Asegúrate de que el correo esté previamente registrado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex h-20 w-20 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-2 shadow-2xl mb-3 items-center justify-center overflow-hidden">
            <img 
              src={settings?.logoUrl || '/gaelec web.png'} 
              alt="Logo" 
              className="h-full w-full object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1550009158-9ebf69173e03?auto=format&fit=crop&q=80&w=200';
              }}
            />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            {settings?.companyName || 'Galería Electrónica'}
          </h1>
          <p className="text-emerald-400 font-medium text-xs sm:text-sm mt-1 flex items-center justify-center gap-1.5">
            <ShieldCheck size={16} /> Portal Administrativo Privado
          </p>
        </div>

        {/* Card */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-2xl">
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">
                Iniciar Sesión
              </h2>
              <span className="px-2.5 py-1 bg-amber-50 text-amber-700 text-[11px] font-bold rounded-full border border-amber-200/60 flex items-center gap-1">
                <Lock size={12} /> Acceso Manual
              </span>
            </div>
            <p className="text-slate-500 text-xs sm:text-sm mt-1">
              Ingresa las credenciales autorizadas por la gerencia para acceder.
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-red-700 text-xs sm:text-sm animate-in fade-in">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {resetEmailSent && (
            <div className="mb-5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm animate-in fade-in">
              ✅ Se ha enviado un enlace de recuperación a tu correo electrónico. Revisa tu bandeja de entrada o spam.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Correo Electrónico
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail size={18} />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@galeriaelectronica.com"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white text-xs sm:text-sm transition-colors"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Contraseña
                </label>
                <button
                  type="button"
                  onClick={handlePasswordReset}
                  className="text-xs text-emerald-600 hover:text-emerald-700 font-medium transition-colors"
                >
                  ¿Olvidaste tu clave?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock size={18} />
                </div>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white text-xs sm:text-sm transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold py-3.5 rounded-xl transition-colors shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 mt-5 disabled:opacity-50 text-xs sm:text-sm cursor-pointer"
            >
              {loading ? (
                <span>Verificando credenciales...</span>
              ) : (
                <>
                  <span>Ingresar al Sistema</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          {/* Notice: No Public Registration */}
          <div className="mt-6 pt-5 border-t border-slate-100 bg-slate-50/80 -mx-6 -mb-6 p-5 rounded-b-3xl text-center space-y-2">
            <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-slate-700">
              <ShieldAlert size={14} className="text-amber-600" />
              <span>Registro Público Deshabilitado</span>
            </div>
            <p className="text-[11px] text-slate-500 max-w-xs mx-auto leading-relaxed">
              El registro libre está bloqueado. Los nuevos usuarios solo pueden ser dados de alta manualmente desde la administración.
            </p>
          </div>
        </div>

        {/* Security badge footer */}
        <div className="mt-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
          <KeyRound size={14} className="text-emerald-400" />
          <span>Acceso encriptado y autenticado con Firebase Cloud Auth</span>
        </div>
      </div>
    </div>
  );
}

