import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Upload, Plus, TrendingUp } from 'lucide-react';
import '../styles/QuickStartGuideFinanzas.css';

export const QuickStartGuideFinanzas: React.FC<{
  onDismiss?: () => void;
}> = ({ onDismiss }) => {
  const [expanded, setExpanded] = useState<number | null>(0);

  const steps = [
    {
      number: 1,
      title: 'Agrega tu primera cuenta',
      description: 'Débito, crédito, efectivo — donde esté tu plata',
      detail: (
        <div className="detail-content">
          <p>Dale un nombre (ej: "Davivienda débito"), elige el tipo y el saldo inicial.</p>
          <p className="hint">Si no sabes el saldo exacto, Lukapp se lo pedirá después.</p>
        </div>
      ),
      icon: '🏦'
    },
    {
      number: 2,
      title: 'Importa tu extracto (opcional)',
      description: 'Automático desde Davivienda, Nequi, Bancolombia o Nu',
      detail: (
        <div className="detail-content">
          <p>Descarga el extracto en PDF y subeló. Lukapp saca cada transacción automáticamente.</p>
          <p className="hint">No duplica, no pierde. Si ya lo importaste, lo sabrá.</p>
        </div>
      ),
      icon: '📄'
    },
    {
      number: 3,
      title: 'Registra un gasto en lenguaje natural',
      description: '"gasté 45k en almuerzo" o "Rappi 28 mil"',
      detail: (
        <div className="detail-content">
          <p>Escribe como hablas. Lukapp entiende el monto, la categoría y qué fue.</p>
          <div className="example">
            <code>gasté 15 mil en la farmacia</code>
            <span className="arrow">→</span>
            <div className="parsed">
              <span className="monto">-$15.000</span>
              <span className="categoria">💊 Salud</span>
            </div>
          </div>
        </div>
      ),
      icon: '✍️'
    },
    {
      number: 4,
      title: 'Abre tu primer reporte',
      description: 'Ve dónde fue tu plata esta semana / mes / año',
      detail: (
        <div className="detail-content">
          <p>Gráficos por categoría, tendencias, dónde más gastas.</p>
          <p className="hint">Sin juzgar. Solo números.</p>
        </div>
      ),
      icon: '📊'
    }
  ];

  return (
    <div className="quick-start-finanzas">
      <div className="qs-header">
        <div className="qs-title">
          <span className="icon">🚀</span>
          <div>
            <h3>Primeros pasos</h3>
            <p>4 cosas para tener tu dinero bajo control</p>
          </div>
        </div>
        {onDismiss && (
          <button className="dismiss-btn" onClick={onDismiss}>
            ✕
          </button>
        )}
      </div>

      <div className="qs-steps">
        {steps.map((step, idx) => (
          <div
            key={idx}
            className={`qs-step ${expanded === idx ? 'expanded' : ''}`}
          >
            <button
              className="step-header"
              onClick={() => setExpanded(expanded === idx ? null : idx)}
            >
              <div className="step-icon">{step.icon}</div>
              <div className="step-info">
                <h4>{step.title}</h4>
                <p>{step.description}</p>
              </div>
              <div className="toggle-icon">
                {expanded === idx ? (
                  <ChevronUp size={20} />
                ) : (
                  <ChevronDown size={20} />
                )}
              </div>
            </button>

            {expanded === idx && (
              <div className="step-detail">
                {step.detail}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="qs-tips">
        <h4>Consejos</h4>
        <ul>
          <li>
            <span className="bullet">→</span>
            Puedes editar cualquier gasto después
          </li>
          <li>
            <span className="bullet">→</span>
            Crea categorías propias además de las 13 que trae
          </li>
          <li>
            <span className="bullet">→</span>
            Los datos son tuyos — todo es local
          </li>
          <li>
            <span className="bullet">→</span>
            El análisis es automático, sin modelos raros
          </li>
        </ul>
      </div>
    </div>
  );
};
