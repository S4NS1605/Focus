import React, { useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  Building2,
  FileText,
  Lock,
  Menu,
  Mic,
  PenLine,
  ShieldCheck,
  UtensilsCrossed,
  Car,
  Banknote,
  X,
  type LucideIcon
} from 'lucide-react';
import '../styles/LandingFinanzas.css';

interface LandingProps {
  onGetStarted?: () => void;
  onSeeDemo?: () => void;
  onLogin?: () => void;
}

const QUE_ES: { Icono: LucideIcon; titulo: string; texto: string }[] = [
  {
    Icono: PenLine,
    titulo: 'Lenguaje natural',
    texto: '"gasté 45k en pizza" se convierte automáticamente en un gasto de comida.'
  },
  {
    Icono: FileText,
    titulo: 'Extractos de bancos',
    texto: 'Davivienda, Bancolombia, Nequi, Nu — sube el PDF y listo.'
  },
  {
    Icono: Building2,
    titulo: 'Múltiples cuentas',
    texto: 'Débito, crédito, efectivo, ahorros — todo en un saldo único.'
  },
  {
    Icono: BarChart3,
    titulo: 'Análisis automático',
    texto: 'Gráficos por categoría. Tendencias. Gastos recurrentes. Sin juzgar.'
  },
  {
    Icono: Lock,
    titulo: 'Tus datos son tuyos',
    texto: 'Todo es local. Nada se vende. Nada se guarda en servidores extranjeros.'
  },
  {
    Icono: ShieldCheck,
    titulo: 'Sin algoritmos raros',
    texto: 'Matemática transparente. El código está en GitHub. Sin sorpresas.'
  }
];

const PASOS: { titulo: string; texto: string }[] = [
  { titulo: 'Crea una cuenta', texto: 'Email. Listo.' },
  { titulo: 'Agrega tu dinero', texto: 'Débito, crédito, efectivo. Donde esté tu plata.' },
  { titulo: 'Registra gastos', texto: 'Escribe como hablas. Lukapp entiende.' },
  { titulo: 'Analiza', texto: 'Entiende dónde va tu dinero, sin rodeos.' }
];

/* Los tres movimientos del mockup. Cifras en pesos y de cuantía creíble para
   Colombia: un almuerzo de $28.500 y un pago de cliente de $2.5M cuentan la
   historia de un independiente, que es a quien va dirigida la app. */
const MOVIMIENTOS: {
  Icono: LucideIcon;
  desc: string;
  monto: string;
  tipo: 'out' | 'in';
}[] = [
  { Icono: UtensilsCrossed, desc: 'Almuerzo en La Bodega', monto: '−$28.500', tipo: 'out' },
  { Icono: Car, desc: 'Uber a casa', monto: '−$15.300', tipo: 'out' },
  { Icono: Banknote, desc: 'Pago de cliente', monto: '+$2.500.000', tipo: 'in' }
];

export const LandingFinanzas: React.FC<LandingProps> = ({
  onGetStarted,
  onSeeDemo,
  onLogin
}) => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="landing-finanzas">
      <nav className="nav-bar">
        <div className="nav-content">
          <span className="logo">Lukapp</span>

          <div className={`nav-links ${menuOpen ? 'open' : ''}`}>
            <a href="#que-es" onClick={() => setMenuOpen(false)}>
              Qué es
            </a>
            <a href="#como-funciona" onClick={() => setMenuOpen(false)}>
              Cómo funciona
            </a>
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

      <section className="hero">
        <div className="hero-text">
          <h1>
            Sabe exactamente dónde
            <br />
            está <em>tu plata</em>.
          </h1>
          <p className="hero-sub">
            Registra gastos hablando. Importa los extractos de tu banco. Entiende
            en qué se te va el mes sin que nadie te juzgue.
          </p>

          <div className="hero-ctas">
            <button className="btn-primary" onClick={onGetStarted}>
              Empezar gratis
              <ArrowRight size={17} strokeWidth={2} aria-hidden />
            </button>
            <button className="btn-secondary" onClick={onSeeDemo}>
              Ver demo
            </button>
          </div>

          <p className="hero-note">30 días gratis. No pide tarjeta de crédito.</p>
        </div>

        <div className="hero-visual" aria-hidden="true">
          <div className="telefono">
            <div className="telefono-pantalla">
              <div className="balance-section">
                <span className="label">Tu saldo hoy</span>
                <span className="amount">$5.340</span>
              </div>

              <div className="transactions">
                {MOVIMIENTOS.map(({ Icono, desc, monto, tipo }) => (
                  <div className={`tx ${tipo}`} key={desc}>
                    <span className="tx-icono">
                      <Icono size={15} strokeWidth={1.75} />
                    </span>
                    <span className="desc">{desc}</span>
                    <span className="amount">{monto}</span>
                  </div>
                ))}
              </div>

              <div className="dictado">
                <span className="dictado-boton">
                  <Mic size={16} strokeWidth={1.75} />
                </span>
                <span className="dictado-texto">"gasté 45 mil en almuerzo"</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="what-is" id="que-es">
        <header className="seccion-cabecera">
          <span className="seccion-etiqueta">Qué es</span>
          <h2>Todo tu dinero, en un solo sitio</h2>
        </header>

        <div className="features">
          {QUE_ES.map(({ Icono, titulo, texto }) => (
            <article className="feature" key={titulo}>
              <span className="feature-icono">
                <Icono size={18} strokeWidth={1.5} aria-hidden />
              </span>
              <h3>{titulo}</h3>
              <p>{texto}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="how-it-works" id="como-funciona">
        <header className="seccion-cabecera">
          <span className="seccion-etiqueta">Cómo funciona</span>
          <h2>Cuatro pasos y ya</h2>
        </header>

        <ol className="steps">
          {PASOS.map(({ titulo, texto }, i) => (
            <li className="step" key={titulo}>
              <span className="number">{String(i + 1).padStart(2, '0')}</span>
              <h3>{titulo}</h3>
              <p>{texto}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="final-cta">
        <h2>¿Listo?</h2>
        <p>30 días para entender tu dinero.</p>
        <button className="btn-primary-lg" onClick={onGetStarted}>
          Empezar ahora
          <ArrowRight size={18} strokeWidth={2} aria-hidden />
        </button>
      </section>

      <footer className="footer">
        <p>© 2026 Lukapp — Tu dinero, bajo control</p>
      </footer>
    </div>
  );
};
