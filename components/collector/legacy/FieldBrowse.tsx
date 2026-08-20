import type { FieldItem, FilteredFieldItem } from './FieldExperience';

function formatPlace(city: NonNullable<FieldItem['identity']['city']>) {
  const countrySuffix = `, ${city.country}`;
  return city.label.toLocaleLowerCase().endsWith(countrySuffix.toLocaleLowerCase())
    ? city.label
    : `${city.label}${countrySuffix}`;
}

function artworkHref(item: FieldItem) {
  const artworkPath = `/works/${encodeURIComponent(item.artworkId)}`;
  if (item.identity.status === 'unregistered' || !item.identity.publicCode) return artworkPath;
  const params = new URLSearchParams({ instance: item.identity.publicCode });
  return `${artworkPath}?${params.toString()}`;
}

function artworkDetails(item: FieldItem) {
  const details = [item.series, item.year === null ? null : String(item.year), item.identity.editionLabel ?? 'Catalog work']
    .filter((value): value is string => Boolean(value));
  return details.join(' · ');
}

function identityState(item: FieldItem) {
  if (item.identity.status === 'registered' && item.identity.city) {
    return `Registered · ${formatPlace(item.identity.city)}`;
  }
  if (item.identity.status === 'private') return 'Registered · Place private or not recorded';
  if (item.identity.status === 'registered') return 'Registered · Place not recorded';
  return 'Not registered · Place not recorded';
}

export default function FieldBrowse({ items }: { items: readonly FilteredFieldItem[] }) {
  return (
    <div className="collector-field__browse">
      <p className="collector-field__browse-intro">
        The list carries the same works and lens as the field. Every record stays available.
      </p>
      <ul className="collector-field__list" aria-label="Browse every work">
        {items.map(({ item, matches }) => (
          <li
            key={item.key}
            className="collector-field__item"
            data-field-key={item.key}
            data-field-match={String(matches)}
          >
            <a className="collector-field__item-link" href={artworkHref(item)}>
              <span>
                <span className="collector-field__item-title">{item.title}</span>
                <span className="collector-field__item-meta">
                  {artworkDetails(item)}
                  {item.identity.ordinal !== null && ` · Founding Light ${item.identity.ordinal}`}
                </span>
              </span>
              <span className="collector-field__item-state">
                {identityState(item)}
                {!matches && <span className="collector-field__lens-note">Outside the current lens</span>}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
