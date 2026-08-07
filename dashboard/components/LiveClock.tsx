'use client';

import { useEffect, useState } from 'react';

function format(d: Date): string {
  return (
    d.toLocaleString('en-GB', {
      timeZone: 'UTC',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }) + ' UTC'
  );
}

export default function LiveClock({ initial }: { initial: string }) {
  const [now, setNow] = useState(initial);

  useEffect(() => {
    const id = setInterval(() => setNow(format(new Date())), 1000);
    return () => clearInterval(id);
  }, []);

  return <span className="clock">{now}</span>;
}
