import { EmptyState } from '../components/ui';
export default function NotFound() { return <main className="page not-found"><span className="eyebrow">404 · A SMALL DETOUR</span><EmptyState title="This time, we missed the connection." description="That page is not here. Let’s find you a session instead." to="/browse"/></main>; }
