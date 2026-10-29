import { checklistProgress, mapsSearchUrl } from '../lib/checklist';
import type { VendorGroup } from '../types';

interface Props {
  groups: VendorGroup[];
  city: string;
  done: Record<string, boolean>;
  onToggle: (id: string) => void;
}

/** Vendor-by-vendor checklist with saved progress and Google Maps search links. */
export function ChecklistPanel({ groups, city, done, onToggle }: Props) {
  const progress = checklistProgress(groups, done);
  return (
    <section aria-labelledby="checklist-heading">
      <h3 id="checklist-heading">Vendor checklist</h3>
      <div className="progress-row">
        <label htmlFor="checklist-progress">Progress: {progress}% complete</label>
        <progress id="checklist-progress" max={100} value={progress}>
          {progress}%
        </progress>
      </div>
      <div className="vendor-grid">
        {groups.map((group) => (
          <fieldset key={group.id} className="vendor card">
            <legend>{group.vendor}</legend>
            <ul>
              {group.items.map((item) => (
                <li key={item.id}>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={Boolean(done[item.id])}
                      onChange={() => onToggle(item.id)}
                    />
                    <span>{item.task}</span>
                  </label>
                </li>
              ))}
            </ul>
            <a
              className="maps-link"
              href={mapsSearchUrl(group.searchTerm, city)}
              target="_blank"
              rel="noopener noreferrer"
            >
              Find {group.vendor.toLowerCase()} near {city} on Google Maps
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </fieldset>
        ))}
      </div>
    </section>
  );
}
