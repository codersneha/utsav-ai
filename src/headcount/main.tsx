import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/fraunces';
import '@fontsource-variable/plus-jakarta-sans';
import { HeadcountPage } from '../components/headcount/HeadcountPage';
import '../styles/index.css';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <HeadcountPage />
    </StrictMode>,
  );
}
