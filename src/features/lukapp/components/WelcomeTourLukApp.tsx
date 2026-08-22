import React, { useLayoutEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ChevronRight, X, Wallet, MessageCircle, FileText, CreditCard, BarChart3, Zap } from 'lucide-react';
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
      title: '¿Qué es LukApp?',
      subtitle: 'Tu dinero, bajo control',
      Icon: Wallet,
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
      Icon: MessageCircle,
      content: (
        <div className="tour-content-demo">
          <div className="input-demo">
            <div className="label">Escribe</div>
            <code>gasté 45 mil en almuerzo con Juan</code>
          </div>
          <div className="arrow">↓</div>
          <div className="output-demo">
            <div className="label">LukApp entiende</div>
            <div className="parsed-item">
              <span className="category-badge">Comida</span>
              <span className="desc">Almuerzo con Juan</span>
              <span className="amount">-$45.000</span>
            </div>
          </div>
        </div>
      )
    },
    {
      title: 'Importa extractos',
      subtitle: 'De tus bancos colombianos',
      Icon: FileText,
      content: (
        <div className="tour-content-text">
          <p>Davivienda, Bancolombia, Nequi, Nu — descarga el PDF y sube.</p>
          <p className="subtle">LukApp no duplica transacciones. Separa lo nuevo de lo que ya estaba.</p>
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
      Icon: CreditCard,
      content: (
        <div className="tour-content-demo">
          <div className="accounts-demo">
            <div className="account-item">
              <span className="account-badge">Débito</span>
              <span className="name">Davivienda</span>
              <span className="balance">$2.450</span>
            </div>
            <div className="account-item">
              <span className="account-badge">Ahorro</span>
              <span className="name">Alcancía</span>
              <span className="balance">$850</span>
            </div>
            <div className="account-item">
              <span className="account-badge">Efectivo</span>
              <span className="name">Bolsillo</span>
              <span className="balance">$120</span>
            </div>
          </div>
          <div className="total">
            <span className="label">Tu saldo total</span>
            <span className="amount">$3.420</span>
          </div>
        </div>
      )
    },
    {
      title: 'Análisis automático',
      subtitle: 'Ve dónde va tu plata',
      Icon: BarChart3,
      content: (
        <div className="tour-content-text">
          <p>Gráficos por categoría. Tendencias. Gastos recurrentes. Cuánto ahorras cada mes.</p>
          <p className="subtle">Sin juzgar. Solo números.</p>
          <div className="categories-demo">
            <div className="category">
              <span className="category-dot" style={{ background: '#f59e0b' }}></span>
              <span className="name">Comida</span>
              <span className="pct">45%</span>
            </div>
            <div className="category">
              <span className="category-dot" style={{ background: '#3b82f6' }}></span>
              <span className="name">Transporte</span>
              <span className="pct">20%</span>
            </div>
            <div className="category">
              <span className="category-dot" style={{ background: '#10b981' }}></span>
              <span className="name">Salud</span>
              <span className="pct">15%</span>
            </div>
            <div className="category">
              <span className="category-dot" style={{ background: '#8b5cf6' }}></span>
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
      Icon: Zap,
      content: (
        <div className="tour-content-text">
          <p>Crea una cuenta, agrega tu primera transacción y entiende de una vez dónde va tu plata.</p>
          <p className="subtle">Todo es tuyo. Nada se vende. Ni se guarda en servidores extranjeros.</p>
        </div>
      )
    }
  ];

  const current = steps[step];
  const ultimo = step === steps.length - 1;
  const quieto = useReducedMotion();

  /* LA ALTURA DEL CUERPO
     Los seis pasos no miden lo mismo: el de cuentas lleva cuatro filas y el de
     cierre dos frases, 86px contra 289px. Antes el modal tomaba la altura de su
     contenido, así que crecía y encogía de golpe en cada clic y el botón de
     Siguiente se movía casi 90px de un paso a otro — no se podía ni apuntar dos
     veces al mismo sitio.

     Clavar una altura para todos tampoco servía: obliga a usar la del paso más
     alto y deja doscientos y pico de píxeles de vacío en los dos pasos cortos.
     Así que se mide el contenido de cada paso y se interpola de una altura a la
     otra. La caja se reacomoda, pero se la ve reacomodarse, que es lo que
     separa un movimiento de un salto. El suelo lo pone `min-height` en la hoja,
     para que los pasos cortos no queden apretados. */
  const cuerpoRef = useRef<HTMLDivElement>(null);
  const [alto, setAlto] = useState<number | 'auto'>('auto');
  useLayoutEffect(() => {
    if (cuerpoRef.current) setAlto(cuerpoRef.current.offsetHeight);
  }, [step]);

  const handleNext = () => {
    if (!ultimo) {
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
          <X size={20} strokeWidth={2} />
        </button>

        {/* Solo se recambia el contenido del paso; la cabecera del modal y el
            pie se quedan montados. Con `key` en este nodo cada paso entra con
            su propio fundido en vez de sustituirse en un fotograma. */}
        <motion.div
          key={step}
          className="tour-paso"
          initial={quieto ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
        >
          <current.Icon className="tour-glifo" size={30} strokeWidth={1.5} aria-hidden />

          <div className="tour-title-section">
            <h2>{current.title}</h2>
            <p className="subtitle">{current.subtitle}</p>
          </div>
        </motion.div>

        {/* `initial={false}`: en el primer pintado la altura ya es la correcta y
            animarla desde cero haría que el modal se desplegara al abrirse,
            encima de su propia entrada. */}
        <motion.div
          className="tour-body"
          initial={false}
          animate={{ height: alto }}
          transition={quieto ? { duration: 0 } : { duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Aquí el fundido es solo de opacidad, sin el desplazamiento que sí
              lleva la cabecera. Este nodo vive dentro de una caja recortada y
              con la altura justa de su contenido: bajarlo diez píxeles al
              entrar dejaría sus diez últimos fuera del recorte durante toda la
              transición. La cabecera puede permitírselo porque no la recorta
              nadie. */}
          <motion.div
            className="tour-body-inner"
            ref={cuerpoRef}
            key={step}
            initial={quieto ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
          >
            {current.content}
          </motion.div>
        </motion.div>

        <div className="tour-footer">
          <div className="tour-progress">
            {steps.map((_, i) => (
              <button
                key={i}
                className={`dot ${i === step ? 'active' : ''}`}
                onClick={() => setStep(i)}
                aria-label={`Paso ${i + 1} de ${steps.length}`}
                aria-current={i === step ? 'step' : undefined}
              />
            ))}
          </div>

          <div className="buttons">
            {step > 0 && (
              <button className="btn-secondary" onClick={() => setStep(step - 1)}>
                Atrás
              </button>
            )}

            <button className="btn-primary" onClick={handleNext}>
              {ultimo ? 'Empezar' : 'Siguiente'}
              <ChevronRight size={17} strokeWidth={2.2} aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
