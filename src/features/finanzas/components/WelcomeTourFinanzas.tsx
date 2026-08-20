import React, { useState } from 'react';
import { ChevronRight, X } from 'lucide-react';
import '../styles/WelcomeTourFinanzas.css';

interface WelcomeTourProps {
  onComplete?: () => void;
  onSkip?: () => void;
}

export const WelcomeTourFinanzas: React.FC<WelcomeTourProps> = ({
  onComplete,
  onSkip
}) => {
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: '¿Qué es Lukapp?',
      subtitle: 'Tu dinero, bajo control',
      icon: '💰',
      content: (
        <div className="tour-content-text">
          <p>Registra cada peso que gastas. Importa extractos de tus bancos. Entiende dónde va tu plata.</p>
          <p className="subtle">Sin algoritmos raros. Todo local. Tus datos son tuyos.</p>
        </div>
      )
    },
    {
      title: 'Lenguaje natural',
      subtitle: 'Escribe como hablas',
      icon: '✍️',
      content: (
        <div className="tour-content-demo">
          <div className="input-demo">
            <div className="label">Escribe:</div>
            <code>gasté 45 mil en almuerzo con Juan</code>
          </div>
          <div className="arrow">↓</div>
          <div className="output-demo">
            <div className="label">Lukapp entiende:</div>
            <div className="parsed-item">
              <span className="emoji">🍔</span>
              <span className="desc">Comida</span>
              <span className="amount">-$45.000</span>
            </div>
          </div>
        </div>
      )
    },
    {
      title: 'Importa extractos',
      subtitle: 'De tus bancos colombianos',
      icon: '📄',
      content: (
        <div className="tour-content-text">
          <p>Davivienda, Bancolombia, Nequi, Nu — descarga el PDF y sube.</p>
          <p className="subtle">Lukapp no duplica transacciones. Separa lo nuevo de lo que ya estaba.</p>
          <div className="supported-banks">
            <span className="bank">Davivienda</span>
            <span className="bank">Bancolombia</span>
            <span className="bank">Nequi</span>
            <span className="bank">Nu</span>
          </div>
        </div>
      )
    },
    {
      title: 'Múltiples cuentas',
      subtitle: 'Débito, crédito, efectivo — todo en uno',
      icon: '🏦',
      content: (
        <div className="tour-content-demo">
          <div className="accounts-demo">
            <div className="account-item">
              <span className="icon">💳</span>
              <span className="name">Davivienda débito</span>
              <span className="balance">$2.450</span>
            </div>
            <div className="account-item">
              <span className="icon">💰</span>
              <span className="name">Alcancía</span>
              <span className="balance">$850</span>
            </div>
            <div className="account-item">
              <span className="icon">💸</span>
              <span className="name">Efectivo en bolsillo</span>
              <span className="balance">$120</span>
            </div>
          </div>
          <div className="total">
            <span className="label">Tu saldo total:</span>
            <span className="amount">$3.420</span>
          </div>
        </div>
      )
    },
    {
      title: 'Análisis automático',
      subtitle: 'Ve dónde va tu plata',
      icon: '📊',
      content: (
        <div className="tour-content-text">
          <p>Gráficos por categoría. Tendencias. Gastos recurrentes. Cuánto ahorras cada mes.</p>
          <p className="subtle">Sin juzgar. Solo números.</p>
          <div className="categories-demo">
            <div className="category">
              <span className="emoji">🍔</span>
              <span className="name">Comida</span>
              <span className="pct">45%</span>
            </div>
            <div className="category">
              <span className="emoji">🚕</span>
              <span className="name">Transporte</span>
              <span className="pct">20%</span>
            </div>
            <div className="category">
              <span className="emoji">💊</span>
              <span className="name">Salud</span>
              <span className="pct">15%</span>
            </div>
            <div className="category">
              <span className="emoji">🎬</span>
              <span className="name">Ocio</span>
              <span className="pct">20%</span>
            </div>
          </div>
        </div>
      )
    },
    {
      title: '¿Listo?',
      subtitle: 'Empieza en menos de 5 minutos',
      icon: '🚀',
      content: (
        <div className="tour-content-text">
          <p>Crea una cuenta, agrega tu primera transacción y entiende de una vez dónde va tu plata.</p>
          <p className="subtle">Todo es tuyo. Nada se vende. Ni se guarda en servidores extranjeros.</p>
        </div>
      )
    }
  ];

  const current = steps[step];

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      onComplete?.();
    }
  };

  return (
    <div className="welcome-tour-finanzas">
      <div className="tour-modal">
        <button
          className="close-btn"
          onClick={() => onSkip?.()}
          aria-label="Cerrar"
        >
          <X size={24} />
        </button>

        <div className="tour-header">
          <span className="icon">{current.icon}</span>
        </div>

        <div className="tour-title-section">
          <h2>{current.title}</h2>
          <p className="subtitle">{current.subtitle}</p>
        </div>

        <div className="tour-body">
          {current.content}
        </div>

        <div className="tour-progress">
          {steps.map((_, i) => (
            <button
              key={i}
              className={`dot ${i === step ? 'active' : ''}`}
              onClick={() => setStep(i)}
              aria-label={`Paso ${i + 1}`}
            />
          ))}
        </div>

        <div className="tour-footer">
          <div className="buttons">
            {step > 0 && (
              <button className="btn-secondary" onClick={() => setStep(step - 1)}>
                Atrás
              </button>
            )}

            {step < steps.length - 1 ? (
              <button className="btn-primary" onClick={handleNext}>
                Siguiente <ChevronRight size={18} />
              </button>
            ) : (
              <button className="btn-primary" onClick={onComplete}>
                Empezar <ChevronRight size={18} />
              </button>
            )}
          </div>

          <p className="counter">
            {step + 1} de {steps.length}
          </p>
        </div>
      </div>
    </div>
  );
};
