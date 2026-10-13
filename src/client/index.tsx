import { createRoot } from 'react-dom/client';
import HomePage from './pages/HomePage';
import { Seo } from './components/Seo';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <>
    <Seo />
    <HomePage />
  </>,
);
