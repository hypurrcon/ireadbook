import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Icon } from './Icon';
import { sfx, haptic } from '../audio/sound';
import { spring } from './kit';

const TABS = [
  { to: '/', key: 'shelf', icon: 'shelf' },
  { to: '/read', key: 'read', icon: 'read' },
  { to: '/add', key: 'add', icon: 'plus' },
  { to: '/stats', key: 'stats', icon: 'stats' },
  { to: '/assistant', key: 'assistant', icon: 'assistant' },
] as const;

export function TabBar() {
  const { t } = useTranslation();
  const loc = useLocation();
  return (
    <nav className="tabbar" aria-label="main">
      {TABS.map((tab) => {
        const on = tab.to === '/' ? loc.pathname === '/' : loc.pathname.startsWith(tab.to);
        if (tab.key === 'add') {
          return (
            <NavLink key={tab.to} to={tab.to} aria-label={t('tabs.add')} onClick={() => { sfx('tap'); haptic(8); }}>
              <motion.span className="tab-add" whileTap={{ scale: 0.9 }} transition={spring}><Icon name="plus" size={26} sw={2} /></motion.span>
            </NavLink>
          );
        }
        return (
          <NavLink key={tab.to} to={tab.to} className={`tab ${on ? 'on' : ''}`} onClick={() => { sfx('tap'); haptic(5); }}>
            {on && <motion.span layoutId="tab-dot" className="tab-dot" transition={spring} />}
            <Icon name={tab.icon} />
            <span>{t(`tabs.${tab.key}`)}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
