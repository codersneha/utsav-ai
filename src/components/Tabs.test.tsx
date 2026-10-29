import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { Tabs } from './Tabs';

function Harness() {
  const [active, setActive] = useState('a');
  return (
    <Tabs
      label="Sections"
      active={active}
      onChange={setActive}
      tabs={[
        { id: 'a', label: 'Alpha', content: <p>Alpha panel</p> },
        { id: 'b', label: 'Beta', content: <p>Beta panel</p> },
        { id: 'c', label: 'Gamma', content: <p>Gamma panel</p> },
      ]}
    />
  );
}

describe('Tabs', () => {
  it('exposes tab semantics and shows only the active panel', () => {
    render(<Harness />);
    expect(screen.getByRole('tablist', { name: 'Sections' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Alpha' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Alpha' })).toHaveTextContent('Alpha panel');
    expect(screen.queryByText('Beta panel')).not.toBeInTheDocument();
  });

  it('supports arrow, Home and End keys with roving focus', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('tab', { name: 'Alpha' }));
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Beta' })).toHaveFocus();
    expect(screen.getByText('Beta panel')).toBeInTheDocument();
    await user.keyboard('{End}');
    expect(screen.getByRole('tab', { name: 'Gamma' })).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Alpha' })).toHaveFocus();
    await user.keyboard('{ArrowLeft}{Home}');
    expect(screen.getByRole('tab', { name: 'Alpha' })).toHaveAttribute('tabindex', '0');
    await user.keyboard('a');
    expect(screen.getByRole('tab', { name: 'Alpha' })).toHaveAttribute('aria-selected', 'true');
  });
});
