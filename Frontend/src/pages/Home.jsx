import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../context/LanguageContext';
import { ArrowRight } from 'lucide-react';
import './Home.css';

const Home = () => {
  const { user } = useAuth();
  const { t } = useLanguage();

  return (
    <div className="home-page">
      <div className="hero-section">
        <div className="hero-content">
          <div className="welcome-badge">
            <span className="badge-dot"></span>
            {t('welcomeBadge')}
          </div>

          <h1 className="hero-title">
            {user ? (
              <>
                {/* Split rendered so {name} is inside a styled <span> */}
                {t('helloUser').split('{name}')[0]}
                <span className="highlight">{user.name}</span>
                {t('helloUser').split('{name}')[1]}
              </>
            ) : (
              t('welcomeToCropCare')
            )}
          </h1>

          <p className="hero-description">
            {t('heroDescription')}
          </p>

          <div className="hero-cta">
            <Link to="/dashboard" className="cta-primary">
              {t('goToDashboard')}
              <ArrowRight size={20} />
            </Link>
          </div>
        </div>

        <div className="hero-visual">
          <div className="visual-card card-3">
            <div className="card-icon">🌱</div>
            <div className="card-stat">
              <span className="stat-number">{t('available24x7')}</span>
              <span className="stat-label">{t('available')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
