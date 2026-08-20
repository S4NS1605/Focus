import React, { useState } from 'react';
import { ChevronRight, Menu, X } from 'lucide-react';
import '../styles/LandingFinanzas.css';

interface LandingProps {
  onGetStarted?: () => void;
  onSeeDemo?: () => void;
  onLogin?: () => void;
}

export const LandingFinanzas: React.FC<LandingProps> = ({
  onGetStarted,
  onSeeDemo,
  onLogin
}) => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="landing-finanzas">
      {/* NAVBAR */}
      <nav className="nav-bar">
        <div className="nav-content">
          <div className="logo">💰 Lukapp</div>

          <div className={`nav-links ${menuOpen ? 'open' : ''}`}>
            <a href="#que-es" onClick={() => setMenuOpen(false)}>Qué es</a>
            <a href="#como-funciona" onClick={() => setMenuOpen(false)}>Cómo funciona</a>
            <button className="link-btn" onClick={() => { onLogin?.(); setMenuOpen(false); }}>
              Acceder
            </button>
          </div>

          <button
            className="menu-btn"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="hero-text">
          <h1>Sabe exactamente dónde está tu plata</h1>
          <p>
            Registra gastos en lenguaje natural. Importa extractos de tus bancos.
            Entiende tendencias sin que nadie te juzgue.
          </p>

          <div className="hero-ctas">
            <button className="btn-primary" onClick={onGetStarted}>
              Empezar gratis
              <ChevronRight size={18} />
            </button>
            <button className="btn-secondary" onClick={onSeeDemo}>
              Ver demo
            </button>
          </div>

          <p className="hero-note">
            30 días gratis. No pide tarjeta de crédito.
          </p>
        </div>

        <div className="hero-visual">
          <div className="card-visual">
            <div className="balance-section">
              <span className="label">Tu saldo hoy</span>
              <span className="amount">$5.340</span>
            </div>
            <div className="transactions">
              <div className="tx out">
                <span className="emoji">🍔</span>
                <span className="desc">Almuerzo en La Bodega</span>
                <span className="amount">-$28.500</span>
              </div>
              <div className="tx out">
                <span className="emoji">🚕</span>
                <span className="desc">Uber a casa</span>
                <span className="amount">-$15.300</span>
              </div>
              <div className="tx in">
                <span className="emoji">💵</span>
                <span className="desc">Pago de cliente</span>
                <span className="amount">+$2.500.000</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* QUÉ ES */}
      <section className="what-is" id="que-es">
        <h2>Qué es Lukapp</h2>
        <div className="features">
          <div className="feature">
            <span className="icon">✍️</span>
            <h3>Lenguaje natural</h3>
            <p>"gasté 45k en pizza" se convierte automáticamente en un gasto de comida.</p>
          </div>

          <div className="feature">
            <span className="icon">📄</span>
            <h3>Extractos de bancos</h3>
            <p>Davivienda, Bancolombia, Nequi, Nu — sube el PDF y listo.</p>
          </div>

          <div className="feature">
            <span className="icon">🏦</span>
            <h3>Múltiples cuentas</h3>
            <p>Débito, crédito, efectivo, ahorros — todo en un saldo único.</p>
          </div>

          <div className="feature">
            <span className="icon">📊</span>
            <h3>Análisis automático</h3>
            <p>Gráficos por categoría. Tendencias. Gastos recurrentes. Sin juzgar.</p>
          </div>

          <div className="feature">
            <span className="icon">🔒</span>
            <h3>Tus datos son tuyos</h3>
            <p>Todo es local. Nada se vende. Nada se guarda en servidores extranjeros.</p>
          </div>

          <div className="feature">
            <span className="icon">⚡</span>
            <h3>Sin algoritmos raros</h3>
            <p>Matemática transparente. El código está en GitHub. Sin sorpresas.</p>
          </div>
        </div>
      </section>

      {/* CÓMO FUNCIONA */}
      <section className="how-it-works" id="como-funciona">
        <h2>Cómo funciona</h2>
        <div className="steps">
          <div className="step">
            <div className="number">1</div>
            <h3>Crea una cuenta</h3>
            <p>Email. Listo.</p>
          </div>

          <div className="step">
            <div className="number">2</div>
            <h3>Agrega tu dinero</h3>
            <p>Débito, crédito, efectivo. Donde esté tu plata.</p>
          </div>

          <div className="step">
            <div className="number">3</div>
            <h3>Registra gastos</h3>
            <p>Escribe como hablas. Lukapp entiende.</p>
          </div>

          <div className="step">
            <div className="number">4</div>
            <h3>Analiza</h3>
            <p>Entiende dónde va tu dinero, sin rodeos.</p>
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="final-cta">
        <h2>¿Listo?</h2>
        <p>30 días para entender tu dinero</p>
        <button className="btn-primary-lg" onClick={onGetStarted}>
          Empezar ahora
          <ChevronRight size={20} />
        </button>
      </section>

      {/* FOOTER */}
      <footer className="footer">
        <p>© 2026 Lukapp | Tu dinero, bajo control</p>
      </footer>
    </div>
  );
};
