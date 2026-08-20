import React, { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Check, Eye, EyeOff, Loader2, MailCheck, X } from 'lucide-react';
import type { Sesion } from '../../data/useSesion';
import { Reveal } from './primitivas';
import { TituloPalabras } from './adornos';

/** Lo mínimo que pide Supabase. Decirlo antes evita el viaje de ida y vuelta. */
const MINIMO_PASSWORD = 6;

/** Estado de la comprobación del apodo contra la base. */
type EstadoApodo = 'vacio' | 'corto' | 'comprobando' | 'libre' | 'cogido';

const APODO_MINIMO = 3;

interface RegistroProps {
  sesion: Sesion;
  onIrAEntrar?: () => void;
}

export const Registro: React.FC<RegistroProps> = ({ sesion, onIrAEntrar }) => {
  const quieto = useReducedMotion();
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [usuario, setUsuario] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [apodo, setApodo] = useState<EstadoApodo>('vacio');

  /* La comprobación del apodo va con retardo: sin él se dispara una consulta
     por cada tecla, y la respuesta de la penúltima puede llegar después de la
     última y pintar un veredicto que ya no corresponde a lo que hay escrito.
     El contador de peticiones descarta las que llegan tarde. */
  const peticion = useRef(0);
  useEffect(() => {
    const limpio = usuario.trim();
    if (limpio === '') {
      setApodo('vacio');
      return;
    }
    if (limpio.length < APODO_MINIMO) {
      setApodo('corto');
      return;
    }

    setApodo('comprobando');
    const mia = ++peticion.current;
    const id = setTimeout(async () => {
      const libre = await sesion.usuarioDisponible(limpio);
      if (mia === peticion.current) setApodo(libre ? 'libre' : 'cogido');
    }, 450);

    return () => clearTimeout(id);
  }, [usuario, sesion]);

  const correoValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim());
  const listo =
    correoValido && password.length >= MINIMO_PASSWORD && apodo === 'libre' && !sesion.ocupado;

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!listo) return;
    await sesion.registrarse(correo, password, usuario);
    setEnviado(true);
  };

  /* Supabase responde igual a un alta correcta que a una con el correo ya
     registrado, así que "revisa tu correo" solo se enseña si no hubo error. */
  const exito = enviado && !sesion.error && !sesion.ocupado;

  if (exito) {
    return (
      <section className="registro" id="registro">
        <Reveal className="registro-caja registro-exito">
          <span className="registro-sello">
            <MailCheck size={26} strokeWidth={1.75} aria-hidden />
          </span>
          <h2>Revisa tu correo</h2>
          <p>
            Te mandamos un enlace a <strong>{correo.trim()}</strong>. Ábrelo y tu
            cuenta queda lista. Si no aparece en unos minutos, mira en spam.
          </p>
          <button className="btn-secondary" onClick={onIrAEntrar}>
            Ya lo confirmé, quiero entrar
          </button>
        </Reveal>
      </section>
    );
  }

  return (
    <section className="registro" id="registro">
      <Reveal as="header" className="seccion-cabecera registro-cabecera">
        <span className="seccion-etiqueta">Crea tu cuenta</span>
        <TituloPalabras texto="Empieza en menos de un minuto" resaltarUltimas={2} />
        <p className="seccion-sub">
          Sin tarjeta, sin llamadas, sin esperar a que alguien te apruebe.
          Correo, contraseña y ya estás adentro.
        </p>
      </Reveal>

      <Reveal className="registro-caja" delay={0.1}>
        <form onSubmit={enviar} noValidate>
          <label className="registro-campo">
            <span className="registro-etiqueta">Tu correo</span>
            <input
              type="email"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              placeholder="tu@correo.com"
              autoComplete="email"
              required
            />
          </label>

          <label className="registro-campo">
            <span className="registro-etiqueta">
              Cómo te llamamos
              <ApodoAviso estado={apodo} />
            </span>
            <input
              type="text"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              placeholder="juli"
              autoComplete="username"
              spellCheck={false}
              required
            />
          </label>

          <label className="registro-campo">
            <span className="registro-etiqueta">Una contraseña</span>
            <span className="registro-password">
              <input
                type={verPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                onClick={() => setVerPassword(!verPassword)}
                aria-label={verPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
              >
                {verPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </span>
            <span className="registro-pista">
              {password.length > 0 && password.length < MINIMO_PASSWORD
                ? `Te faltan ${MINIMO_PASSWORD - password.length} caracteres.`
                : `Mínimo ${MINIMO_PASSWORD} caracteres.`}
            </span>
          </label>

          {sesion.error && (
            <motion.p
              className="registro-error"
              initial={quieto ? false : { opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              role="alert"
            >
              {sesion.error}
            </motion.p>
          )}

          <button type="submit" className="btn-primary-lg registro-enviar" disabled={!listo}>
            {sesion.ocupado ? (
              <>
                <Loader2 size={18} className="registro-girando" aria-hidden />
                Creando tu cuenta…
              </>
            ) : (
              <>
                Crear mi cuenta
                <ArrowRight size={18} strokeWidth={2} aria-hidden />
              </>
            )}
          </button>

          <p className="registro-pie">
            ¿Ya tienes cuenta?{' '}
            <button type="button" className="registro-enlace" onClick={onIrAEntrar}>
              Entra por aquí
            </button>
          </p>
        </form>
      </Reveal>
    </section>
  );
};

/** El veredicto del apodo, al lado de su etiqueta. */
const ApodoAviso: React.FC<{ estado: EstadoApodo }> = ({ estado }) => {
  if (estado === 'vacio') return null;

  if (estado === 'corto') {
    return <span className="apodo-aviso">mínimo {APODO_MINIMO} letras</span>;
  }

  if (estado === 'comprobando') {
    return (
      <span className="apodo-aviso">
        <Loader2 size={12} className="registro-girando" aria-hidden />
        mirando
      </span>
    );
  }

  if (estado === 'libre') {
    return (
      <span className="apodo-aviso libre">
        <Check size={12} strokeWidth={3} aria-hidden />
        libre
      </span>
    );
  }

  return (
    <span className="apodo-aviso cogido">
      <X size={12} strokeWidth={3} aria-hidden />
      ya está cogido
    </span>
  );
};
