import { UserPlus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import {
  CLOSENESS,
  DISTANCES,
  LIMITS,
  type Closeness,
  type Distance,
  type GuestGroup,
} from '../../lib/headcount';
import { SelectField } from '../plannerForm/fields';
import { CLOSENESS_LABELS, DISTANCE_LABELS } from './labels';

interface Props {
  onAdd: (group: Omit<GuestGroup, 'id'>) => void;
}

/** Adds one family, or a batch of similar guests ("Baba's office, 40 people"). */
export function GroupForm({ onAdd }: Props) {
  const [name, setName] = useState('');
  const [people, setPeople] = useState('');
  const [closeness, setCloseness] = useState<Closeness>('close');
  const [distance, setDistance] = useState<Distance>('local');
  const [error, setError] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const count = Math.round(Number(people));
    const label = name.trim();
    if (!label) return setError('Give the family or group a name.');
    if (!(count >= 1 && count <= LIMITS.peopleMax)) {
      return setError(`Enter how many people, from 1 to ${LIMITS.peopleMax}.`);
    }
    setError('');
    onAdd({ name: label, people: count, closeness, distance, reply: 'not-asked' });
    setName('');
    setPeople('');
  };

  return (
    <form className="headcount-add" onSubmit={submit} noValidate aria-label="Add a family or group">
      <div className="field">
        <label htmlFor="group-name">Family or group</label>
        <input
          id="group-name"
          value={name}
          maxLength={LIMITS.nameMax}
          placeholder="e.g. Mama’s family, Baba’s office"
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="group-people">People</label>
        <input
          id="group-people"
          type="number"
          inputMode="numeric"
          min={1}
          max={LIMITS.peopleMax}
          value={people}
          placeholder="4"
          onChange={(e) => setPeople(e.target.value)}
        />
      </div>
      <div className="field">
        <SelectField
          id="group-closeness"
          label="Who they are"
          value={closeness}
          options={CLOSENESS}
          labels={(c) => CLOSENESS_LABELS[c]}
          onChange={setCloseness}
        />
      </div>
      <div className="field">
        <SelectField
          id="group-distance"
          label="Where they live"
          value={distance}
          options={DISTANCES}
          labels={(d) => DISTANCE_LABELS[d]}
          onChange={setDistance}
        />
      </div>
      <button type="submit" className="btn primary">
        <UserPlus size={18} aria-hidden="true" /> Add
      </button>
      <p className="field-error" role="alert">
        {error}
      </p>
    </form>
  );
}
