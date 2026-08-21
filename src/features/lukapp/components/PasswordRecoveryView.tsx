import React, { useState } from 'react';
import { Mail, CheckCircle, AlertCircle } from 'lucide-react';
import { RippleButton } from './RippleButton';
import { obtenerSupabase } from '../data/supabase';
import { RippleButton } from './RippleButton';

interface PasswordRecoveryViewProps {
  email?: string;
}

export const PasswordRecoveryView: React.FC<PasswordRecoveryViewProps> = ({ email = '' }) => {
  const [correo, setCorreo] = useState(email);
  const [estado, setEstado] = useState<'inicial' | 'enviando' | 'exito' | 'error'>('inicial');
  const [mensaje, setMensaje] = useState('');
  const [emailEnviado, setEmailEnviado] = useState('');

  const handleRecuperarContraseña = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correo.trim()) {
      setEstado('error');
      setMensaje('Por favor ingresa tu correo electrónico');
      return;
    }

    setEstado('enviando');
    try {
      const cliente = obtenerSupabase();
      if (!cliente) {
        setEstado('error');
        setMensaje('No se pudo conectar con el servidor');
        return;
      }

      const { error } = await cliente.auth.resetPasswordForEmail(correo, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (error) {
        setEstado('error');
        setMensaje(error.message || 'Error al enviar el correo de recuperación');
      } else {
        setEstado('exito');
        setEmailEnviado(correo);
        setMensaje('Verifica tu correo electrónico para el enlace de recuperación');
        setCorreo('');
      }
    } catch (err) {
      setEstado('error');
      setMensaje('Ocurrió un error inesperado. Intenta de nuevo.');
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-6 py-6">
      <div className="space-y-2 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--fin-soft)] mx-auto">
          <Mail className="h-6 w-6 text-[var(--fin-ink-soft)]" strokeWidth={2} />
        </div>
        <h2 className="text-[20px] font-semibold text-[var(--fin-ink)]">Recuperar contraseña</h2>
        <p className="text-[14px] text-[var(--fin-ink-soft)]">
          Ingresa tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña
        </p>
      </div>

      {estado === 'exito' ? (
        <div className="space-y-4 rounded-[var(--fin-r-card)] bg-[var(--fin-soft)] p-4">
          <div className="flex gap-3">
            <CheckCircle className="h-5 w-5 shrink-0 text-[var(--fin-in)]" strokeWidth={2.5} />
            <div>
              <p className="font-semibold text-[var(--fin-ink)]">Correo enviado</p>
              <p className="text-[13px] text-[var(--fin-ink-soft)] mt-1">
                Hemos enviado un enlace de recuperación a <strong>{emailEnviado}</strong>
              </p>
              <p className="text-[13px] text-[var(--fin-ink-soft)] mt-2">
                Revisa tu bandeja de entrada (o spam) y sigue el enlace para crear una nueva contraseña.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setEstado('inicial');
              setMensaje('');
              setEmailEnviado('');
            }}
            className="w-full rounded-[var(--fin-r-control)] bg-[var(--fin-accent)] px-4 py-2.5 text-[15px] font-semibold text-[var(--fin-on-accent)] transition-opacity hover:opacity-90"
          >
            Intentar con otro correo
          </button>
        </div>
      ) : (
        <form onSubmit={handleRecuperarContraseña} className="space-y-4">
          <div className="space-y-2">
            <label className="text-[13px] font-semibold text-[var(--fin-ink)]">Correo electrónico</label>
            <input
              type="email"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              placeholder="tu@correo.com"
              disabled={estado === 'enviando'}
              className="w-full rounded-[var(--fin-r-control)] bg-[var(--fin-soft)] px-3 py-2.5 text-base text-[var(--fin-ink)] placeholder:text-[var(--fin-ink-faint)] border-none focus:outline-none focus:ring-2 focus:ring-[var(--fin-accent)]"
            />
          </div>

          {estado === 'error' && mensaje && (
            <div className="flex gap-3 rounded-[var(--fin-r-card)] bg-[var(--fin-out-bg)] p-3">
              <AlertCircle className="h-5 w-5 shrink-0 text-[var(--fin-out)]" strokeWidth={2.5} />
              <p className="text-[13px] text-[var(--fin-out-ink)]">{mensaje}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={estado === 'enviando'}
            className="w-full rounded-[var(--fin-r-control)] bg-[var(--fin-accent)] px-4 py-2.5 text-[15px] font-semibold text-[var(--fin-on-accent)] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {estado === 'enviando' ? 'Enviando...' : 'Enviar enlace de recuperación'}
          </button>
        </form>
      )}

      <div className="rounded-[var(--fin-r-card)] bg-[var(--fin-soft)] p-4 text-[13px] text-[var(--fin-ink-soft)]">
        <p className="font-semibold text-[var(--fin-ink)] mb-2">💡 Consejos:</p>
        <ul className="space-y-1.5">
          <li>• Verifica tu carpeta de spam si no ves el correo</li>
          <li>• El enlace expira en 24 horas</li>
          <li>• Si no tienes acceso a ese correo, contacta con soporte</li>
        </ul>
      </div>
    </div>
  );
};
