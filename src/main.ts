import '@fontsource/newsreader/400.css';
import '@fontsource/newsreader/400-italic.css';
import '@fontsource/newsreader/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/caveat/500.css';
import './styles/main.css';

import { entries } from './data/entries';
import { mountLenses } from './ui/lenses';

const root = document.getElementById('lenses-root');
if (root) mountLenses(root, entries);
