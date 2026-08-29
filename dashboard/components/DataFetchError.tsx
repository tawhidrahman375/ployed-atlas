import { AlertTriangleIcon } from './icons';

export interface DataFetchErrorEntry {
  source: string;
  message: string;
}

export default function DataFetchError({ errors }: { errors: DataFetchErrorEntry[] }) {
  if (!errors.length) return null;

  return (
    <div className="data-error-banner" role="alert">
      <div className="data-error-head">
        <AlertTriangleIcon size={16} />
        Couldn&rsquo;t reach Supabase for {errors.length} data source{errors.length > 1 ? 's' : ''} — the
        numbers and lists below are incomplete, not actually empty.
      </div>
      <ul className="data-error-list">
        {errors.map((e) => (
          <li key={e.source}>
            <b>{e.source}:</b> {e.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
