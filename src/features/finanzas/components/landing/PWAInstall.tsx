import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Download, Smartphone, Phone } from 'lucide-react';
import { Reveal } from './primitivas';

type Platform = 'ios' | 'android' | 'desktop' | null;

const detectPlatform = (): Platform => {
  const ua = navigator.userAgent.toLowerCase();
  const isIos = /iphone|ipad|ipod/.test(ua);
  const isAndroid = /android/.test(ua);

  if (isIos) return 'ios';
  if (isAndroid) return 'android';

  return null;
};

interface PWAInstallProps {
  onClose?: () => void;
  onSkip?: () => void;
  onProceed?: () => void;
}

export const PWAInstall: React.FC<PWAInstallProps> = ({ onClose, onSkip, onProceed }) => {
  const [platform, setPlatform] = useState<Platform>(null);

  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  if (!platform) return null;

  const isIos = platform === 'ios';

  return (
    <section className="pwa-install">
      <motion.div
        className="pwa-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />

      <Reveal className="pwa-modal">
        <div className="pwa-cabecera">
          <h2>Mejor en app</h2>
          <button
            className="pwa-cerrar"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </div>

        <p className="pwa-descripcion">
          La experiencia completa está optimizada para {isIos ? 'tu iPhone' : 'tu Android'}.
          Te mostramos cómo instalarla en un minuto.
        </p>

        <div className="pwa-pasos">
          {isIos ? (
            <>
              <div className="pwa-paso">
                <div className="pwa-numero">1</div>
                <div className="pwa-contenido">
                  <h3>Abre el navegador</h3>
                  <p>Asegúrate de estar usando Safari</p>
                </div>
              </div>

              <div className="pwa-paso">
                <div className="pwa-numero">2</div>
                <div className="pwa-contenido">
                  <h3>Toca el ícono de compartir</h3>
                  <p>Es el cuadrado con la flecha hacia arriba</p>
                </div>
              </div>

              <div className="pwa-paso">
                <div className="pwa-numero">3</div>
                <div className="pwa-contenido">
                  <h3>Selecciona "Agregar a Inicio"</h3>
                  <p>La app aparecerá en tu pantalla de inicio</p>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="pwa-paso">
                <div className="pwa-numero">1</div>
                <div className="pwa-contenido">
                  <h3>En Chrome, abre el menú</h3>
                  <p>Los tres puntos en la esquina superior</p>
                </div>
              </div>

              <div className="pwa-paso">
                <div className="pwa-numero">2</div>
                <div className="pwa-contenido">
                  <h3>Busca "Instalar aplicación"</h3>
                  <p>Esa opción aparecerá en el menú</p>
                </div>
              </div>

              <div className="pwa-paso">
                <div className="pwa-numero">3</div>
                <div className="pwa-contenido">
                  <h3>Confirma la instalación</h3>
                  <p>Listo. Ya tendrás la app en tu pantalla</p>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="pwa-beneficios">
          <div className="pwa-beneficio">
            <Phone size={18} />
            <span>Acceso instantáneo desde tu pantalla de inicio</span>
          </div>
          <div className="pwa-beneficio">
            <Smartphone size={18} />
            <span>Funciona sin conexión (datos en caché)</span>
          </div>
          <div className="pwa-beneficio">
            <Download size={18} />
            <span>Sin necesidad de ir a tiendas de apps</span>
          </div>
        </div>

        <div className="pwa-acciones">
          <button className="btn-primary-lg pwa-continuar" onClick={onProceed}>
            Ya lo instalé, continuar
          </button>
          <button className="btn-secondary pwa-despues" onClick={onSkip}>
            Hacerlo después
          </button>
        </div>
      </Reveal>
    </section>
  );
};
