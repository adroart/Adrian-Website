import { useId, useState } from 'react';

const PAGE_SIZE = 6;

type TemplateChoice = { templateId: string; name: string };

export function CertificateTemplateChoices({
  templates,
  selectedId,
  onSelect,
  disabled = false,
}: {
  templates: TemplateChoice[];
  selectedId: string;
  onSelect: (id: string) => void;
  disabled?: boolean;
}) {
  const searchId = useId();
  const [query, setQuery] = useState('');
  const [requestedPage, setRequestedPage] = useState<number | null>(null);
  const needle = query.trim().toLowerCase();
  const filtered = templates.filter(template => template.name.toLowerCase().includes(needle));
  const lastPage = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const selectedIndex = filtered.findIndex(template => template.templateId === selectedId);
  const selectedPage = Math.floor(Math.max(0, selectedIndex) / PAGE_SIZE) + 1;
  const page = Math.min(lastPage, requestedPage ?? selectedPage);
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      {(templates.length > PAGE_SIZE || query) && (
        <div className="cert-field">
          <label className="cert-label" htmlFor={searchId}>Search templates</label>
          <input
            className="cert-control"
            id={searchId}
            type="search"
            value={query}
            disabled={disabled}
            onChange={event => {
              setQuery(event.target.value);
              setRequestedPage(event.target.value.trim() ? 1 : null);
            }}
          />
        </div>
      )}
      {visible.length ? (
        <ul className="cert-choice-list" aria-label="Certificate templates">
          {visible.map(template => (
            <li key={template.templateId}>
              <button
                className="cert-choice-row"
                type="button"
                aria-pressed={template.templateId === selectedId}
                disabled={disabled}
                onClick={() => onSelect(template.templateId)}
              >
                {template.name}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="cert-note">{needle ? 'No matching templates.' : 'No templates yet.'}</p>
      )}
      {lastPage > 1 && (
        <div className="cert-actions" role="group" aria-label="Template pages">
          <button className="cert-action" type="button" disabled={disabled || page === 1} onClick={() => setRequestedPage(page - 1)}>
            Previous
          </button>
          <span className="cert-note" aria-live="polite">Page {page} of {lastPage}</span>
          <button className="cert-action" type="button" disabled={disabled || page === lastPage} onClick={() => setRequestedPage(page + 1)}>
            Next
          </button>
        </div>
      )}
    </>
  );
}

export default CertificateTemplateChoices;
