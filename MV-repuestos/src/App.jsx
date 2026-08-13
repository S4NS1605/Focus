import React, { useEffect } from 'react';
import { 
  Wrench, 
  Settings, 
  Droplet, 
  Zap, 
  MessageCircle, 
  MapPin, 
  Clock, 
  Star,
  ChevronRight,
  ShieldCheck,
  ArrowRight,
  Phone
} from 'lucide-react';
import './App.css';
import logoUrl from './assets/logo.jpg';

function App() {
  const whatsappNumber = "573163720956";
  const whatsappMsg = encodeURIComponent("Hola MV, me gustaría cotizar un servicio/repuesto para mi vehículo.");
  const wpLink = `https://wa.me/${whatsappNumber}?text=${whatsappMsg}`;

  // Simple scroll animation observer for elements below the fold
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-fade-in');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.scroll-animate').forEach(el => observer.observe(el));
    
    return () => observer.disconnect();
  }, []);

  return (
    <div className="app-container">
      {/* Navbar - Frosted Glass */}
      <nav className="navbar">
        <div className="container">
          <div className="nav-brand">
            <div className="logo-container">
              <img src={logoUrl} alt="MV Repuestos Logo" className="nav-logo" />
            </div>
            <div className="nav-title">
              MV
              <span>Repuestos</span>
            </div>
          </div>
          <div className="nav-links">
            <a href="#taller" className="nav-link">Taller Mecánico</a>
            <a href="#lujos" className="nav-link">Lujos y Accesorios</a>
            <a href="#nosotros" className="nav-link">Nosotros</a>
            <a href={wpLink} target="_blank" rel="noreferrer" className="nav-cta">
              <MessageCircle size={18} /> Agendar Cita
            </a>
          </div>
        </div>
      </nav>

      {/* Hero Section - Professional Split Layout */}
      <header className="hero">
        <div className="hero-bg-image"></div>
        <div className="hero-gradient"></div>
        <div className="container hero-content">
          <div className="hero-text animate-fade-in">
            <div className="hero-badge">
              <span className="badge-dot"></span> Taller y Lujos en Ibagué
            </div>
            <h1 className="hero-title">
              Potencia y estilo<br/>
              para <span className="text-primary">tu nave.</span>
            </h1>
            <p className="hero-subtitle">
              Expertos en mecánica multimarca y la selección más exclusiva de accesorios. Pasión por los motores, atención rigurosa al detalle.
            </p>
            <div className="hero-actions">
              <a href={wpLink} target="_blank" rel="noreferrer" className="btn btn-primary">
                <MessageCircle size={20} />
                Cotizar por WhatsApp
              </a>
              <a href="#lujos" className="btn btn-outline">
                Explorar Catálogo
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Stats / Trust Banner */}
      <div className="trust-banner">
        <div className="container trust-grid">
          <div className="trust-item scroll-animate">
            <div className="trust-number">4.4<Star size={24} fill="currentColor" /></div>
            <p>Calificación Google</p>
          </div>
          <div className="trust-item scroll-animate delay-1">
            <div className="trust-number">+10</div>
            <p>Años de Experiencia</p>
          </div>
          <div className="trust-item scroll-animate delay-2">
            <div className="trust-number"><ShieldCheck size={36} /></div>
            <p>Garantía Local</p>
          </div>
        </div>
      </div>

      {/* Taller Section - Clean Minimalist */}
      <section id="taller" className="section">
        <div className="container">
          <div className="section-header scroll-animate">
            <h2 className="section-title">El motor de tu tranquilidad.</h2>
            <p className="section-subtitle">
              Soluciones mecánicas transparentes y de precisión. Si suena, lo arreglamos; si falla, lo reparamos. Sin sorpresas.
            </p>
          </div>
          
          <div className="services-grid">
            <div className="service-card scroll-animate">
              <div className="service-icon-wrapper">
                <Wrench size={32} />
              </div>
              <h3 className="service-title">Mecánica General</h3>
              <p className="service-desc">Mantenimiento preventivo y correctivo para autos y motos con herramientas de última tecnología.</p>
            </div>
            
            <div className="service-card scroll-animate delay-1">
              <div className="service-icon-wrapper">
                <Settings size={32} />
              </div>
              <h3 className="service-title">Frenos y Suspensión</h3>
              <p className="service-desc">Garantizamos tu seguridad en la vía con repuestos originales y ajustes milimétricos.</p>
            </div>
            
            <div className="service-card scroll-animate delay-2">
              <div className="service-icon-wrapper">
                <Droplet size={32} />
              </div>
              <h3 className="service-title">Cambio de Aceite</h3>
              <p className="service-desc">Lubricación perfecta para prolongar la vida de tu motor con las marcas más reconocidas.</p>
            </div>
            
            <div className="service-card scroll-animate delay-1">
              <div className="service-icon-wrapper">
                <Zap size={32} />
              </div>
              <h3 className="service-title">Electricidad</h3>
              <p className="service-desc">Soluciones eléctricas completas, diagnósticos precisos e instalación de iluminación avanzada.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Lujos y Accesorios - Dark Premium */}
      <section id="lujos" className="section lujos-section">
        <div className="container">
          <div className="section-header scroll-animate">
            <h2 className="section-title">Redefine tu estilo.</h2>
            <p className="section-subtitle">
              Accesorios de primera línea para personalizar tu vehículo y destacarlo en cada semáforo.
            </p>
          </div>

          <div className="lujos-grid">
            <div className="lujo-item scroll-animate">
              <img src="https://images.unsplash.com/photo-1600705722908-bab1e61c0b4d?auto=format&fit=crop&q=80" alt="Luces y Bombillos" loading="lazy" />
              <div className="lujo-overlay">
                <div className="lujo-content">
                  <h3>Iluminación LED</h3>
                  <p>Ver opciones <ChevronRight size={18} /></p>
                </div>
              </div>
            </div>
            <div className="lujo-item scroll-animate delay-1">
              <img src="https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&q=80" alt="Lujos Estéticos" loading="lazy" />
              <div className="lujo-overlay">
                <div className="lujo-content">
                  <h3>Lujos Estéticos</h3>
                  <p>Explorar <ChevronRight size={18} /></p>
                </div>
              </div>
            </div>
            <div className="lujo-item scroll-animate delay-2">
              <img src="https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&q=80" alt="Repuestos y Manijas" loading="lazy" />
              <div className="lujo-overlay">
                <div className="lujo-content">
                  <h3>Repuestos Originales</h3>
                  <p>Cotizar ahora <ChevronRight size={18} /></p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Nosotros */}
      <section id="nosotros" className="section about-section">
        <div className="container about-content">
          <div className="about-image-card scroll-animate">
            <div className="mascot-placeholder">
              <img src={logoUrl} alt="MV Logo" className="about-logo" />
            </div>
            <div className="about-badge">
              <Star fill="currentColor" size={18} />
              <span>Conoce a tu equipo</span>
            </div>
          </div>
          <div className="about-text scroll-animate delay-1">
            <h2>Pasión mecánica, servicio humano.</h2>
            <p>
              En <strong>MV Repuestos</strong> no solo reparamos motores; cuidamos tu seguridad. Ubicados en la emblemática Carrera 5, somos la parada obligada en Ibagué para que tu carro o moto salgan rodando con estilo.
            </p>
            <p>
              Nuestro equipo combina experiencia técnica con un trato honesto, garantizando siempre los mejores precios y resultados que hablan por sí solos.
            </p>
            <div className="about-features">
               <div className="feature-item">
                 <ShieldCheck className="feature-icon" size={24} />
                 <span>Garantía Local</span>
               </div>
               <div className="feature-item">
                 <Settings className="feature-icon" size={24} />
                 <span>Calidad Original</span>
               </div>
               <div className="feature-item">
                 <Phone className="feature-icon" size={24} />
                 <span>Atención Rápida</span>
               </div>
               <div className="feature-item">
                 <MapPin className="feature-icon" size={24} />
                 <span>Fácil Acceso</span>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer - Minimalist Dark */}
      <footer className="footer">
        <div className="container">
          <div className="footer-grid">
            <div className="footer-col footer-brand">
              <div className="logo-container">
                <img src={logoUrl} alt="MV Logo" className="nav-logo" />
              </div>
              <div className="nav-title">
                MV
                <span>Repuestos</span>
              </div>
              <p className="footer-desc">
                Potencia y Estilo. El mejor taller y tienda de lujos en Ibagué para los amantes de los motores.
              </p>
            </div>
            
            <div className="footer-col">
              <h4>Contacto</h4>
              <div className="footer-info">
                <div className="info-item">
                  <MapPin className="info-icon" size={20} />
                  <span>Carrera 5 #25-35 Local 1<br/>Ibagué, Tolima</span>
                </div>
                <div className="info-item">
                  <MessageCircle className="info-icon" size={20} />
                  <span>316 372 0956<br/>301 395 8538</span>
                </div>
              </div>
            </div>
            
            <div className="footer-col">
              <h4>Horarios</h4>
              <div className="footer-info">
                <div className="info-item">
                  <Clock className="info-icon" size={20} />
                  <span>
                    <strong>Lun - Vie:</strong> 8:00 a.m. - 6:00 p.m.<br/><br/>
                    <strong>Sábados:</strong> 9:00 a.m. - 5:00 p.m.
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; {new Date().getFullYear()} MV Repuestos Lujos y Accesorios. Todos los derechos reservados.</p>
          </div>
        </div>
      </footer>

      {/* Floating WhatsApp */}
      <a href={wpLink} target="_blank" rel="noreferrer" className="fab-whatsapp" aria-label="Chat on WhatsApp">
        <MessageCircle size={32} />
      </a>
    </div>
  );
}

export default App;
