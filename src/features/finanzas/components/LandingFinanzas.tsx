import React, { useEffect, useState } from 'react';
import { ArrowRight, Menu, X } from 'lucide-react';
import { Hero } from './landing/Hero';
import { DemoParser } from './landing/DemoParser';
import { Funciones } from './landing/Funciones';
import { Cupo4x1000 } from './landing/Cupo4x1000';
import { FormasDeRegistrar } from './landing/FormasDeRegistrar';
import { Privacidad } from './landing/Privacidad';
import { BandaCifras } from './landing/BandaCifras';
import { Registro } from './landing/Registro';
import type { Sesion } from '../data/useSesion';
import { BarraProgreso, Ticker } from './landing/adornos';
import { Reveal } from './landing/primitivas';
import '../styles/LandingFinanzas.css';

/* La cinta que corre bajo el hero. Son frases que la app de verdad entiende
   —las mismas que el visitante puede pegar en el demo de abajo— así que además
   de mover la página está enseñando el producto. */
const FRASES_TICKER = [
  'gasté 45k en pizza',
  'uber a casa 12k',
  'mercado en el éxito 180 mil',
  'me pagaron 2 millones',
  'netflix 38900',
  'le presté 50 lucas a Andrés',
  'almuerzo 15 mil con la tarjeta',
  'tanqueé 120 mil ayer',
  'arriendo 1.800.000',
  'cine con Sara 42k'
];

interface LandingProps {
  onGetStarted?: () => void;
  onSeeDemo?: () => void;
  onLogin?: () => void;
  /**
   * Opcional para que la portada se pueda montar suelta (una vista de
   * inspección, un test) sin tener que fabricar una sesión. Sin ella no se
   * pinta el formulario de registro, que es lo único que la necesita.
   */
  sesion?: Sesion;
}

const ENLACES = [
  { href: '#demo', texto: 'Pruébalo' },
  { href: '#funciones', texto: 'Funciones' },
  { href: '#cuatro-por-mil', texto: '4×1000' },
  { href: '#privacidad', texto: 'Privacidad' },
  { href: '#registro', texto: 'Crear cuenta' }
];

export const LandingFinanzas: React.FC<LandingProps> = ({
  onGetStarted,
  onSeeDemo,
  onLogin,
  sesion
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [compacta, setCompacta] = useState(false);

  /* La barra se encoge al bajar. `passive` porque el handler no llama a
     preventDefault y sin eso Chrome bloquea el hilo de scroll en móvil. */
  useEffect(() => {
    const alScroll = () => setCompacta(window.scrollY > 24);
    alScroll();
    window.addEventListener('scroll', alScroll, { passive: true });
    return () => window.removeEventListener('scroll', alScroll);
  }, []);

  return (
    <div className="landing-finanzas">
      <nav className={`nav-bar ${compacta ? 'compacta' : ''}`}>
        <BarraProgreso />
        <div className="nav-content">
          <span className="logo">Lukapp</span>

          <div className={`nav-links ${menuOpen ? 'open' : ''}`}>
            {ENLACES.map(({ href, texto }) => (
              <a href={href} key={href} onClick={() => setMenuOpen(false)}>
                {texto}
              </a>
            ))}
            <button
              className="link-btn"
              onClick={() => {
                onLogin?.();
                setMenuOpen(false);
              }}
            >
              Acceder
            </button>
          </div>

          <button
            className="menu-btn"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={22} strokeWidth={1.75} /> : <Menu size={22} strokeWidth={1.75} />}
          </button>
        </div>
      </nav>

      <Hero onGetStarted={onGetStarted} onSeeDemo={onSeeDemo} />
      <Ticker frases={FRASES_TICKER} />
      <DemoParser />
      <BandaCifras />
      <Funciones />
      <Cupo4x1000 />
      <FormasDeRegistrar />
      <Privacidad />

      {sesion ? (
        <Registro sesion={sesion} onIrAEntrar={onLogin} />
      ) : (
        <section className="final-cta">
          <Reveal>
            <h2>¿Listo?</h2>
            <p>30 días para entender tu dinero.</p>
            <button className="btn-primary-lg" onClick={onGetStarted}>
              Empezar ahora
              <ArrowRight size={18} strokeWidth={2} aria-hidden />
            </button>
          </Reveal>
        </section>
      )}

      <footer className="footer">
        <p>© 2026 Lukapp — Tu dinero, bajo control</p>
      </footer>
    </div>
  );
};
