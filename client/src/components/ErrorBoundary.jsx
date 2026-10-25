import { Component } from 'react';
export default class ErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { console.error('A page could not be displayed.'); }
  render() {
    if (this.state.failed) return <main className="empty-state"><h1>Let’s get you back on track.</h1><p>This page ran into a problem. Your saved bookings are safe.</p><button className="btn btn-primary" onClick={() => window.location.assign('/')}>Back to ChronosLive</button></main>;
    return this.props.children;
  }
}
