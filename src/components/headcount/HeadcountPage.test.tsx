import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { saveJson } from '../../lib/storage';
import { axeViolations } from '../../test/axe';
import { HeadcountPage } from './HeadcountPage';

async function addGroup(user: ReturnType<typeof userEvent.setup>, name: string, people: string) {
  await user.type(screen.getByLabelText('Family or group'), name);
  await user.type(screen.getByLabelText('People'), people);
  await user.click(screen.getByRole('button', { name: 'Add' }));
}

describe('HeadcountPage', () => {
  beforeEach(() => localStorage.clear());

  it('starts empty, with no forecast, and passes the accessibility checks', async () => {
    const { container } = render(<HeadcountPage />);
    expect(
      screen.getByRole('heading', { level: 1, name: /How many guests will actually come/ }),
    ).toBeVisible();
    expect(screen.getByText(/No guests yet/)).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Your likely headcount' })).not.toBeInTheDocument();
    expect(await axeViolations(container)).toEqual([]);
  });

  it('rejects a group with no name or no people', async () => {
    const user = userEvent.setup();
    render(<HeadcountPage />);
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Give the family or group a name.');
    await user.type(screen.getByLabelText('Family or group'), 'Mama’s family');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter how many people');
    expect(screen.getByText(/No guests yet/)).toBeVisible();
  });

  it('forecasts from the families added and updates when one answers', async () => {
    const user = userEvent.setup();
    const { container } = render(<HeadcountPage />);
    await addGroup(user, 'Relatives', '100');

    const result = screen.getByRole('region', { name: 'Your likely headcount' });
    expect(within(result).getByText(/of 100 invited are likely to come/)).toBeVisible();
    expect(within(result).getByText('Call these first')).toBeVisible();
    const before = within(result).getByText(/plates$/).textContent;

    await user.selectOptions(screen.getByLabelText('What Relatives said'), 'yes');
    expect(within(result).getByText(/plates$/).textContent).not.toBe(before);
    expect(within(result).queryByText('Call these first')).not.toBeInTheDocument();
    expect(await axeViolations(container)).toEqual([]);
  });

  it('loads the example, shares it on WhatsApp and keeps the list after a reload', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<HeadcountPage />);
    await user.click(screen.getByRole('button', { name: /Try an example/ }));
    expect(screen.getByText('Baba’s office')).toBeVisible();

    const share = screen.getByRole('link', { name: /Share with the family on WhatsApp/ });
    expect(share).toHaveAttribute('href', expect.stringContaining('https://wa.me/?text='));
    expect(decodeURIComponent(share.getAttribute('href') ?? '')).toContain('Guarantee to the caterer');

    unmount();
    render(<HeadcountPage />);
    expect(screen.getByText('Baba’s office')).toBeVisible();
  });

  it('removes a family and clears the whole list', async () => {
    const user = userEvent.setup();
    render(<HeadcountPage />);
    await addGroup(user, 'Mama’s family', '5');
    await addGroup(user, 'Office', '30');
    await user.click(screen.getByRole('button', { name: 'Remove Office' }));
    expect(screen.queryByText('Office')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Clear all/ }));
    expect(screen.getByText(/No guests yet/)).toBeVisible();
  });

  it('ignores a tampered saved list', () => {
    saveJson('headcount.groups', [{ name: 'x', people: -4 }]);
    render(<HeadcountPage />);
    expect(screen.getByText(/No guests yet/)).toBeVisible();
  });
});
