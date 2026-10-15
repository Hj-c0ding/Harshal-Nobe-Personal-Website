import type { LensId, Searchable } from '../lib/lenses';

export interface Entry extends Searchable {
  readonly id: string;
  /** Organization or project name. */
  readonly title: string;
  readonly role?: string;
  /** Human-readable range shown in the margin, e.g. "Sep 2026 – present". */
  readonly dates: string;
  readonly summary: string;
  readonly tags: readonly LensId[];
  /** Optional handwritten margin note (keep these rare). */
  readonly note?: string;
}

export const entries: readonly Entry[] = [
  {
    id: 'idx-exchange',
    title: 'IDX Exchange',
    role: 'Data Science Intern',
    dates: 'Sep 2026 – present',
    summary:
      'I pull CRMLS transaction data over FTP and build geographic spatial features from it. I train time-aware, rolling-window models with scikit-learn and XGBoost and serve property price predictions in a Streamlit app.',
    tags: ['data'],
    note: 'current',
  },
  {
    id: 'illinois-state',
    title: 'Illinois State University',
    role: 'Research Intern',
    dates: 'Jan – May 2026',
    summary:
      'I built a PyTorch prototype that lets a quadcopter hover and follow a figure-8. I worked in NumPy and Jupyter.',
    tags: ['data'],
  },
  {
    id: 'fynder',
    title: 'Fynder',
    dates: 'Jan – Apr 2026',
    summary:
      'I built a lost-and-found app for my school with Django and SQLite: image uploads, form validation, filtering, and tests for submissions, claims, moderation, and admin access. It placed 2nd at Illinois FBLA State.',
    tags: ['fullstack'],
    note: '2nd at state',
  },
  {
    id: 'backline',
    title: 'Backline',
    role: 'Intern',
    dates: 'Sep – Dec 2025',
    summary:
      'I automated a marketing pipeline with Python, Zapier, the OpenAI API, and Canva templates. I also prototyped a Reddit scraper for lead generation.',
    tags: ['data', 'cloud'],
  },
  {
    id: 'fbla',
    title: 'FBLA',
    role: 'State Vice President & Central Area President',
    dates: 'Jan 2025 – Jul 2026',
    summary:
      'I served 4,000+ state members, built toolkits for new chapters, and helped plan the 2026 State Leadership Conference. I ran Project Unlock workshops for 50+ first-generation immigrant students.',
    tags: ['leadership'],
  },
  {
    id: 'tsa',
    title: 'TSA',
    role: 'State President & Chapter Vice President',
    dates: 'May 2025 – Apr 2026',
    summary:
      'I presided over 200+ members at the 2026 State Conference. I was State Champion in Debating Technological Issues, placed 2nd in Technology Bowl (Oral), and earned the TSA Achievement Program Gold Award.',
    tags: ['leadership'],
    note: 'state champion',
  },
  {
    id: 'aws-ccp',
    title: 'AWS Certified Cloud Practitioner',
    // TODO(harshal): add the date the certification was earned.
    dates: 'Certification',
    summary: 'I hold the AWS Certified Cloud Practitioner certification.',
    tags: ['cloud'],
  },
];
