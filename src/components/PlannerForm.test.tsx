import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations } from '../test/axe';
import { weddingDetails } from '../test/fixtures';
import { PlannerForm } from './PlannerForm';

describe('PlannerForm', () => {
  it('has no detectable accessibility violations', async () => {
    const { container } = render(<PlannerForm onSubmit={vi.fn()} />);
    expect(await axeViolations(container)).toEqual([]);
  });

  it('shows an error summary, marks fields invalid and focuses the summary', async () => {
    const onSubmit = vi.fn();
    const { container } = render(<PlannerForm onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole('button', { name: 'Create my plan' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Please fix these 5 fields');
    expect(screen.getByLabelText(/City or town/)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(/City or town/)).toHaveAccessibleDescription('Enter the city or town.');
    expect(onSubmit).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(alert).toHaveFocus());
    expect(await axeViolations(container)).toEqual([]);
  });

  it('submits validated, typed details', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<PlannerForm onSubmit={onSubmit} />);
    await user.click(screen.getByLabelText(/Birthday/));
    await user.type(screen.getByLabelText('Event name'), 'Meera turns 7');
    await user.type(screen.getByLabelText(/Event date/), '2099-01-01');
    await user.clear(screen.getByLabelText(/Event date/));
    const future = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
    await user.type(screen.getByLabelText(/Event date/), future);
    await user.type(screen.getByLabelText(/City or town/), 'Pune');
    await user.type(screen.getByLabelText(/Number of guests/), '40');
    await user.type(screen.getByLabelText(/Total budget/), '60000');
    await user.click(screen.getByLabelText('Food'));
    await user.click(screen.getByLabelText('Decor'));
    await user.click(screen.getByLabelText('Venue'));
    await user.click(screen.getByRole('button', { name: 'Create my plan' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'birthday',
        title: 'Meera turns 7',
        date: future,
        guests: 40,
        budget: 60000,
        priorities: ['decor', 'venue'],
      }),
    );
  });

  it('pre-fills when editing and supports cancel', async () => {
    const onCancel = vi.fn();
    render(<PlannerForm initial={weddingDetails} onSubmit={vi.fn()} onCancel={onCancel} />);
    expect(screen.getByLabelText(/City or town/)).toHaveValue('Jaipur');
    expect(screen.getByLabelText('Food')).toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });
});
