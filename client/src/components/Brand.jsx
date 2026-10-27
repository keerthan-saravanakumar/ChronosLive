import { Link } from 'react-router-dom';

export default function Brand({ className = '' }) {
  return (
    <Link to="/" className={`brand ${className}`} aria-label="ChronosLive — explore sessions">
      <img src="/images/ChronosLiveLogo.png" alt="ChronosLive" width="180" height="150" />
    </Link>
  );
}
