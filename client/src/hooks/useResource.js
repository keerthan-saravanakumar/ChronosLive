import { useEffect, useRef, useState, useCallback } from 'react';
export function useResource(fetcher, dependencies = []) {
  const fetcherRef = useRef(fetcher); fetcherRef.current = fetcher;
  const [data, setData] = useState(null), [error, setError] = useState(null), [loading, setLoading] = useState(true), [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion(v => v + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(null);
    fetcherRef.current(controller.signal).then(result => { if (!controller.signal.aborted) setData(result); })
      .catch(error => { if (!controller.signal.aborted) setError(error); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [...dependencies, version]);
  useEffect(() => {
    let timer;
    const listener = () => { clearTimeout(timer); timer = setTimeout(refresh, 80); };
    window.addEventListener('chronos:refresh', listener);
    return () => { clearTimeout(timer); window.removeEventListener('chronos:refresh', listener); };
  }, [refresh]);
  return { data, error, loading, refresh, setData };
}
