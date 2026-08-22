import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useLanguage } from '../../context/LanguageContext';
import { useState, useEffect, useRef } from 'react';
import { User, LogOut, ChevronDown, Globe } from 'lucide-react';
import './Navbar.css';

const LANGUAGES = [
  { code: 'en', label: 'English',    flag: '🇬🇧' },
  { code: 'hi', label: 'हिंदी',      flag: '🇮🇳' },
  { code: 'mr', label: 'मराठी',      flag: '🇮🇳' },
  { code: 'bn', label: 'বাংলা',      flag: '🇧🇩' },
  { code: 'te', label: 'తెలుగు',    flag: '🇮🇳' },
  { code: 'or', label: 'ଓଡ଼ିଆ',     flag: '🇮🇳' },
  { code: 'ta', label: 'தமிழ்',     flag: '🇮🇳' },
  { code: 'gu', label: 'ગુજરાતી',   flag: '🇮🇳' },
  { code: 'kn', label: 'ಕನ್ನಡ',     flag: '🇮🇳' },
  { code: 'ml', label: 'മലയാളം',   flag: '🇮🇳' },
  { code: 'pa', label: 'ਪੰਜਾਬੀ',    flag: '🇮🇳' },
];

const Navbar = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isServicesOpen, setIsServicesOpen] = useState(false);
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isLangOpen, setIsLangOpen] = useState(false);

  const servicesRef = useRef(null);
  const toolsRef    = useRef(null);
  const profileRef  = useRef(null);
  const langRef     = useRef(null);

  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (servicesRef.current && !servicesRef.current.contains(event.target)) {
        setIsServicesOpen(false);
      }
      if (toolsRef.current && !toolsRef.current.contains(event.target)) {
        setIsToolsOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
      if (langRef.current && !langRef.current.contains(event.target)) {
        setIsLangOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMenuOpen(false);
    setIsServicesOpen(false);
    setIsToolsOpen(false);
    setIsLangOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleServiceClick = (path) => {
    setIsServicesOpen(false);
    setIsMenuOpen(false);
    navigate(path);
  };

  const handleToolClick = (path) => {
    setIsToolsOpen(false);
    setIsMenuOpen(false);
    navigate(path);
  };

  const isActive = (path) => location.pathname === path;

  const currentLang = LANGUAGES.find(l => l.code === language) || LANGUAGES[0];

  return (
    <nav className="navbar">
      <div className="navbar-container">
        {/* Brand */}
        <Link to="/" className="navbar-brand">
          <span className="brand-icon">🌿</span>
          <span className="brand-text">CropCareAI</span>
        </Link>

        {isAuthenticated && !isAuthPage && (
          <>
            {/* Mobile hamburger */}
            <button
              className="menu-toggle"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label="Toggle menu"
            >
              <span></span>
              <span></span>
              <span></span>
            </button>

            {/* Nav links */}
            <div className={`navbar-menu ${isMenuOpen ? 'active' : ''}`}>
              <Link
                to="/"
                className={`nav-link${isActive('/') ? ' nav-link-active' : ''}`}
              >
                {t('home')}
              </Link>

              {/* Services Dropdown */}
              <div className="nav-dropdown" ref={servicesRef}>
                <button
                  className={`nav-link dropdown-trigger${
                    ['/recommend', '/predict', '/fertilizer-recommendation', '/yield-prediction', '/history'].includes(location.pathname)
                      ? ' nav-link-active'
                      : ''
                  }`}
                  onClick={() => setIsServicesOpen(!isServicesOpen)}
                >
                  {t('services')}
                  <ChevronDown
                    className={`dropdown-icon ${isServicesOpen ? 'open' : ''}`}
                    size={16}
                  />
                </button>

                {isServicesOpen && (
                  <div className="dropdown-menu">
                    <button
                      onClick={() => handleServiceClick('/recommend')}
                      className={`dropdown-item${isActive('/recommend') ? ' dropdown-item-active' : ''}`}
                    >
                      <span className="dropdown-icon-emoji">🌾</span>
                      {t('cropRecommendation')}
                    </button>
                    <button
                      onClick={() => handleServiceClick('/predict')}
                      className={`dropdown-item${isActive('/predict') ? ' dropdown-item-active' : ''}`}
                    >
                      <span className="dropdown-icon-emoji">🔬</span>
                      {t('diseaseDetection')}
                    </button>
                    <button
                      onClick={() => handleServiceClick('/fertilizer-recommendation')}
                      className={`dropdown-item${isActive('/fertilizer-recommendation') ? ' dropdown-item-active' : ''}`}
                    >
                      <span className="dropdown-icon-emoji">🧪</span>
                      {t('fertilizerRecommendation')}
                    </button>
                    <button
                      onClick={() => handleServiceClick('/yield-prediction')}
                      className={`dropdown-item${isActive('/yield-prediction') ? ' dropdown-item-active' : ''}`}
                    >
                      <span className="dropdown-icon-emoji">📈</span>
                      {t('cropYieldPrediction')}
                    </button>
                    <div className="dropdown-divider"></div>
                    <button
                      onClick={() => handleServiceClick('/history')}
                      className={`dropdown-item${isActive('/history') ? ' dropdown-item-active' : ''}`}
                    >
                      <span className="dropdown-icon-emoji">📊</span>
                      {t('history')}
                    </button>
                  </div>
                )}
              </div>

              {/* Tools Dropdown */}
              <div className="nav-dropdown" ref={toolsRef}>
                <button
                  className={`nav-link dropdown-trigger${
                    ['/tools/irrigation', '/tools/crop-calendar', '/tools/mandi', '/tools/schemes'].includes(location.pathname)
                      ? ' nav-link-active'
                      : ''
                  }`}
                  onClick={() => setIsToolsOpen(!isToolsOpen)}
                >
                  {t('tools')}
                  <ChevronDown
                    className={`dropdown-icon ${isToolsOpen ? 'open' : ''}`}
                    size={16}
                  />
                </button>

                {isToolsOpen && (
                  <div className="dropdown-menu">
                    <button
                      onClick={() => handleToolClick('/tools/irrigation')}
                      className={`dropdown-item${isActive('/tools/irrigation') ? ' dropdown-item-active' : ''}`}
                    >
                      <span className="dropdown-icon-emoji">💧</span>
                      {t('irrigationAdvisory')}
                    </button>
                    <button
                      onClick={() => handleToolClick('/tools/crop-calendar')}
                      className={`dropdown-item${isActive('/tools/crop-calendar') ? ' dropdown-item-active' : ''}`}
                    >
                      <span className="dropdown-icon-emoji">📅</span>
                      {t('cropCalendar')}
                    </button>
                    <button
                      onClick={() => handleToolClick('/tools/mandi')}
                      className={`dropdown-item${isActive('/tools/mandi') ? ' dropdown-item-active' : ''}`}
                    >
                      <span className="dropdown-icon-emoji">📊</span>
                      {t('mandiPrices')}
                    </button>
                    <button
                      onClick={() => handleToolClick('/tools/schemes')}
                      className={`dropdown-item${isActive('/tools/schemes') ? ' dropdown-item-active' : ''}`}
                    >
                      <span className="dropdown-icon-emoji">🏛️</span>
                      {t('schemeEligibility')}
                    </button>
                  </div>
                )}
              </div>

              <Link
                to="/dashboard"
                className={`nav-link${isActive('/dashboard') ? ' nav-link-active' : ''}`}
              >
                {t('dashboard')}
              </Link>
            </div>

            {/* Language Selector */}
            <div className="lang-section" ref={langRef}>
              <button
                className="lang-trigger"
                onClick={() => setIsLangOpen(!isLangOpen)}
                aria-label="Select language"
                title="Change Language"
              >
                <Globe size={16} />
                <span className="lang-flag">{currentLang.flag}</span>
                <ChevronDown
                  className={`dropdown-icon ${isLangOpen ? 'open' : ''}`}
                  size={14}
                />
              </button>

              {isLangOpen && (
                <div className="lang-dropdown">
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      className={`lang-item ${language === lang.code ? 'lang-item-active' : ''}`}
                      onClick={() => {
                        setLanguage(lang.code);
                        setIsLangOpen(false);
                      }}
                    >
                      <span className="lang-item-flag">{lang.flag}</span>
                      <span>{lang.label}</span>
                      {language === lang.code && <span className="lang-check">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Profile */}
            <div className="profile-section" ref={profileRef}>
              <button
                className="profile-trigger"
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                aria-label="Profile menu"
              >
                <User size={20} />
              </button>

              {isProfileOpen && (
                <div className="profile-dropdown">
                  <div className="profile-header">
                    <User size={24} />
                    <div className="profile-info">
                      <span className="profile-name">{user?.name || 'User'}</span>
                      <span className="profile-email">{user?.email || ''}</span>
                    </div>
                  </div>
                  <div className="dropdown-divider"></div>
                  <button onClick={handleLogout} className="dropdown-item logout-item">
                    <LogOut size={16} />
                    {t('logout')}
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
