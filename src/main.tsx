import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import LandingPage from './LandingPage';
import { useWorkspace } from './useWorkspace';
import './theme.css';
import './styles.css';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <main className="fatal-error"><h1>CareThread needs to reopen</h1><p>Your last successfully saved workspace is still on this device. Reload to try again.</p><button onClick={() => location.reload()}>Reload CareThread</button></main>;
    return this.props.children;
  }
}
type Route = 'home' | 'workspace';
const currentRoute = (): Route => /^\/workspace\/?$/.test(window.location.pathname) ? 'workspace' : 'home';

function Root() {
  const workspace = useWorkspace();
  const [route, setRoute] = React.useState<Route>(currentRoute);
  const previousRoute = React.useRef(route);

  React.useEffect(() => {
    const onPopState = () => setRoute(currentRoute());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  React.useEffect(() => {
    document.title = route === 'home'
      ? 'CareThread — A clearer conversation starts here'
      : 'CareThread — Your workspace';
    if (previousRoute.current === route) return;
    previousRoute.current = route;
    const frame = requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'instant' });
      const main = document.querySelector<HTMLElement>('main');
      if (main && !main.hasAttribute('tabindex')) main.tabIndex = -1;
      main?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [route]);

  const navigate = (next: Route) => {
    const path = next === 'workspace' ? '/workspace' : '/';
    if (window.location.pathname !== path || window.location.hash) history.pushState({}, '', path);
    setRoute(next);
  };
  const tryDemo = () => {
    if (workspace.saveState === 'loading' || workspace.busy) return;
    navigate('workspace');
    if (!workspace.episode) void workspace.loadDemo();
  };

  return route === 'workspace'
    ? <App workspace={workspace} onOpenHome={() => navigate('home')} />
    : <LandingPage onOpenWorkspace={() => navigate('workspace')} onTryDemo={tryDemo} hasEpisode={!!workspace.episode} loading={workspace.saveState === 'loading' || workspace.busy} />;
}
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><ErrorBoundary><Root /></ErrorBoundary></React.StrictMode>);
