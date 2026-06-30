import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Sandpack } from '@codesandbox/sandpack-react';
import { githubLight } from '@codesandbox/sandpack-themes';

const fallbackProject = {
  id: 'mock-landing',
  title: 'Aurora SaaS Landing Page',
  prompt: 'Build a polished SaaS landing page with a premium hero, feature grid, and responsive design.',
  summary: 'Added a React landing page with a hero, feature cards, CTA band, and responsive styling.',
  description: 'The generated project uses React components and CSS tailored for a modern product website.',
  files: [
    {
      path: 'src/App.jsx',
      language: 'jsx',
      content: `import './styles.css';
import { Hero } from './Hero.jsx';

const features = [
  'AI-ready intake flows',
  'Responsive product sections',
  'Conversion-focused CTA copy',
  'Accessible, polished components',
];

export default function App() {
  return (
    <main className="page-shell">
      <Hero />
      <section className="feature-grid" aria-label="Highlights">
        {features.map((feature) => (
          <article className="feature-card" key={feature}>
            <span>✦</span>
            <h2>{feature}</h2>
            <p>Designed with clean spacing, strong hierarchy, and production-friendly React structure.</p>
          </article>
        ))}
      </section>
      <section className="cta-band">
        <p>Ready for iteration</p>
        <h2>Ask OmniClient for edits and the preview updates.</h2>
        <button>Launch workflow</button>
      </section>
    </main>
  );
}
`,
    },
    {
      path: 'src/Hero.jsx',
      language: 'jsx',
      content: `export function Hero() {
  return (
    <section className="hero">
      <div className="hero-copy">
        <span className="eyebrow">OmniClient Website Builder</span>
        <h1>Generate React websites in a live workspace.</h1>
        <p>
          A Lovable-style builder shell with chat, build history, code inspection, and Sandpack preview.
        </p>
        <div className="hero-actions">
          <button>Start building</button>
          <a href="#features">View files</a>
        </div>
      </div>
      <div className="hero-panel" aria-hidden="true">
        <div className="panel-row active"></div>
        <div className="panel-row"></div>
        <div className="panel-row short"></div>
      </div>
    </section>
  );
}
`,
    },
    {
      path: 'src/styles.css',
      language: 'css',
      content: `:root { font-family: Inter, ui-sans-serif, system-ui, sans-serif; color: #172033; background: #f6f8fb; }
* { box-sizing: border-box; }
body { margin: 0; }
.page-shell { min-height: 100vh; padding: 48px; background: radial-gradient(circle at top left, #dbeafe, transparent 34%), #f7fafc; }
.hero { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(280px, .9fr); gap: 40px; align-items: center; max-width: 1120px; margin: 0 auto; }
.eyebrow { color: #2563eb; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; font-size: 12px; }
h1 { margin: 14px 0 16px; font-size: clamp(42px, 7vw, 76px); line-height: .94; letter-spacing: -0.04em; color: #111827; }
p { color: #526173; font-size: 18px; line-height: 1.65; }
.hero-actions { display: flex; align-items: center; gap: 16px; margin-top: 26px; }
button { border: 0; border-radius: 12px; padding: 13px 18px; background: #111827; color: white; font-weight: 800; cursor: pointer; box-shadow: 0 14px 30px rgba(17, 24, 39, .18); }
a { color: #2563eb; font-weight: 800; text-decoration: none; }
.hero-panel { min-height: 360px; border-radius: 28px; padding: 28px; background: linear-gradient(145deg, #111827, #334155); box-shadow: 0 28px 80px rgba(15, 23, 42, .28); display: grid; align-content: end; gap: 14px; }
.panel-row { height: 46px; border-radius: 999px; background: rgba(255,255,255,.16); }
.panel-row.active { background: #60a5fa; }
.panel-row.short { width: 62%; }
.feature-grid { max-width: 1120px; margin: 48px auto 0; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
.feature-card { padding: 20px; border: 1px solid #e2e8f0; border-radius: 18px; background: rgba(255,255,255,.86); }
.feature-card h2 { font-size: 16px; margin: 10px 0 8px; color: #111827; }
.feature-card p { margin: 0; font-size: 14px; }
.cta-band { max-width: 1120px; margin: 18px auto 0; padding: 28px; border-radius: 24px; background: #111827; color: white; display: flex; align-items: center; justify-content: space-between; gap: 18px; }
.cta-band p, .cta-band h2 { margin: 0; color: white; }
@media (max-width: 860px) { .page-shell { padding: 24px; } .hero, .feature-grid { grid-template-columns: 1fr; } .cta-band { align-items: flex-start; flex-direction: column; } }
`,
    },
  ],
  build_steps: [
    { type: 'thought', text: 'Thought for 7s: map the requested website into a React component tree and visual system.' },
    { type: 'command', label: 'Checking dependencies', command: 'npm list react @codesandbox/sandpack-react' },
    { type: 'command', label: 'Installing libraries', command: 'npm install @codesandbox/sandpack-react react react-dom' },
    { type: 'file_edit', file: 'src/App.jsx', diff: '+ Added app shell, feature grid, and CTA section' },
    { type: 'file_edit', file: 'src/Hero.jsx', diff: '+ Added reusable hero component' },
    { type: 'file_edit', file: 'src/styles.css', diff: '+ Added responsive visual styling and hover-ready controls' },
  ],
};

function toSandpackFiles(files) {
  const output = {};
  files.forEach((file) => {
    const path = file.path.startsWith('/') ? file.path : `/${file.path}`;
    output[path] = { code: file.content || '' };
  });
  if (!output['/package.json']) {
    output['/package.json'] = {
      code: JSON.stringify({ scripts: { start: 'vite --host 0.0.0.0' }, dependencies: { '@vitejs/plugin-react': 'latest', vite: 'latest', react: 'latest', 'react-dom': 'latest', 'lucide-react': 'latest', 'framer-motion': 'latest', three: 'latest', '@react-three/fiber': 'latest' }, devDependencies: {} }, null, 2),
    };
  }
  if (!output['/src/main.jsx']) {
    output['/src/main.jsx'] = { code: "import React from 'react';\nimport { createRoot } from 'react-dom/client';\nimport App from './App.jsx';\n\ncreateRoot(document.getElementById('root')).render(<App />);\n" };
  }
  if (!output['/index.html']) {
    output['/index.html'] = { code: '<div id="root"></div><script type="module" src="/src/main.jsx"></script>' };
  }
  return output;
}

function WorkspaceApp() {
  const [project, setProject] = useState(fallbackProject);
  const [view, setView] = useState('preview');
  const [activeFile, setActiveFile] = useState(fallbackProject.files[0]?.path || 'src/App.jsx');
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    function handleUpdate(event) {
      const next = event.detail || fallbackProject;
      setProject({ ...fallbackProject, ...next, files: next.files?.length ? next.files : fallbackProject.files });
      setActiveFile((next.files?.[0] || fallbackProject.files[0]).path);
      setView('preview');
    }
    window.addEventListener('omni:website-project', handleUpdate);
    return () => window.removeEventListener('omni:website-project', handleUpdate);
  }, []);

  const sandpackFiles = useMemo(() => toSandpackFiles(project.files || []), [project]);
  const currentFile = (project.files || []).find((file) => file.path === activeFile) || project.files?.[0];

  function downloadProject() {
    if (project.id && !String(project.id).startsWith('mock')) {
      window.location.href = `/api/website/${project.id}/download`;
      return;
    }
    const blob = new Blob([JSON.stringify(project.files, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'omniclient-website-files.json';
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="wb-shell">
      <aside className="wb-chat-panel">
        <div className="wb-chat-top">
          <div>
            <p>Website Builder</p>
            <h2>{project.title}</h2>
          </div>
          <button className="wb-bell" type="button" aria-label="Notifications"><span /></button>
        </div>
        <div className="wb-user-prompt">{project.prompt}</div>
        <article className="wb-result-card">
          <span>Result</span>
          <h3>{project.summary || 'Added landing page'}</h3>
          <p>{project.description || 'Generated a React website workspace with live preview and code files.'}</p>
          <div className="wb-card-actions">
            <button type="button" onClick={() => setDetailsOpen((open) => !open)}>Details</button>
            <button type="button" onClick={() => setView('preview')}>Preview</button>
          </div>
        </article>
        {detailsOpen && (
          <div className="wb-details">
            {(project.build_steps || []).map((step, index) => (
              <div className={`wb-step wb-step-${step.type}`} key={`${step.type}-${index}`}>
                <strong>{step.label || step.file || step.type}</strong>
                <p>{step.text || step.command || step.diff || ''}</p>
              </div>
            ))}
          </div>
        )}
        <div className="wb-followup">
          <input placeholder="Ask a follow-up..." />
          <button type="button">Send</button>
        </div>
      </aside>

      <section className="wb-stage">
        <header className="wb-toolbar">
          <div className="wb-view-toggle" role="tablist" aria-label="Website workspace views">
            <button className={view === 'preview' ? 'active' : ''} type="button" onClick={() => setView('preview')}>Preview</button>
            <button className={view === 'code' ? 'active' : ''} type="button" onClick={() => setView('code')}>Code</button>
          </div>
          <button className="wb-download" type="button" onClick={downloadProject}>Download</button>
        </header>
        {view === 'preview' ? (
          <div className="wb-preview">
            <Sandpack
              template="react"
              files={sandpackFiles}
              theme={githubLight}
              options={{ showNavigator: false, showTabs: false, showLineNumbers: false, editorHeight: '100%', externalResources: ['https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap'] }}
              customSetup={{ dependencies: { '@vitejs/plugin-react': 'latest', vite: 'latest', react: 'latest', 'react-dom': 'latest', 'lucide-react': 'latest', 'framer-motion': 'latest', three: 'latest', '@react-three/fiber': 'latest' } }}
            />
          </div>
        ) : (
          <div className="wb-code-view">
            <nav className="wb-file-tree" aria-label="Generated files">
              {(project.files || []).map((file) => (
                <button key={file.path} type="button" className={file.path === currentFile?.path ? 'active' : ''} onClick={() => setActiveFile(file.path)}>{file.path}</button>
              ))}
            </nav>
            <section className="wb-code-pane">
              <div className="wb-file-header">{currentFile?.path}</div>
              <pre className={`language-${currentFile?.language || 'jsx'}`}><code>{currentFile?.content || ''}</code></pre>
            </section>
          </div>
        )}
      </section>
    </div>
  );
}

window.mountOmniWebsiteWorkspace = function mountOmniWebsiteWorkspace(target) {
  const node = typeof target === 'string' ? document.querySelector(target) : target;
  if (!node || node.dataset.mounted === 'true') return;
  node.dataset.mounted = 'true';
  createRoot(node).render(<WorkspaceApp />);
};

