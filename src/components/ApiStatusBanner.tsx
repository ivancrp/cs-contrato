import { useEffect, useState } from 'react';
import { checkApiHealth } from '../services/api/apiClient';
import { API_BASE_URL } from '../config/api';

function isLocalDev(): boolean {
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1';
}

export function ApiStatusBanner() {
  const [online, setOnline] = useState<boolean | null>(null);

  useEffect(() => {
    checkApiHealth(true).then(setOnline);
    const interval = setInterval(() => checkApiHealth(true).then(setOnline), 60_000);
    return () => clearInterval(interval);
  }, []);

  if (online === null) return null;

  const offlineMessage = isLocalDev()
    ? 'API offline — inicie: npm run dev:api'
    : 'Backend indisponível — aguarde o deploy ou recarregue a página';

  return (
    <div className={`api-status ${online ? 'api-status--online' : 'api-status--offline'}`}>
      <span className="api-status__dot" />
      {online ? `API conectada (${API_BASE_URL})` : offlineMessage}
    </div>
  );
}
