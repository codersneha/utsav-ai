import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axeViolations } from '../test/axe';
import { weddingDetails } from '../test/fixtures';
import { PlannerForm } from './PlannerForm';

/** Clicks Next and waits until focus has moved to the new step's heading. */
async function nextStep(user: ReturnType<typeof userEvent.setup>, title: string) {
  await user.click(screen.getByRole('button', { name: /Next/ }));
  await vi.waitFor(() => expect(screen.getByRole('heading', { name: title })).toHaveFocus());
}

const future = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

describe('PlannerForm wizard', () => {
  it('has no detectable accessibility violations', async () => {
    const { container } = render(<PlannerForm onSubmit={vi.fn()} />);
    expect(await axeViolations(container)).toEqual([]);
  });

  it('validates only the current step, with an error summary and invalid fields', async () => {
    const user = userEvent.setup();
    const { container } = render(<PlannerForm onSubmit={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /Next/ }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Please fix these 3 fields');
    expect(screen.getByLabelText(/City or town/)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(/City or town/)).toHaveAccessibleDescription('Enter the city or town.');
    await vi.waitFor(() => expect(alert).toHaveFocus());
    expect(await axeViolations(container)).toEqual([]);
  });

  it('walks through the steps, shows a live preview and submits typed details', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<PlannerForm onSubmit={onSubmit} />);
    expect(screen.getByRole('button', { name: /1\. The occasion/ })).toHaveAttribute('aria-current', 'step');

    await user.click(screen.getByLabelText(/Birthday/));
    await user.type(screen.getByLabelText('Event name'), 'Meera turns 7');
    await user.type(screen.getByLabelText(/Event date/), future(30));
    await user.type(screen.getByLabelText(/City or town/), 'Pune');
    const preview = screen.getByRole('complementary', { name: 'Plan preview' });
    expect(preview).toHaveTextContent('Meera turns 7');
    expect(preview).toHaveTextContent(/\d+ days/);
    await nextStep(user, 'Guests & budget');

    await user.type(screen.getByLabelText(/Number of guests/), '40');
    await user.click(screen.getByRole('button', { name: '₹50k' }));
    expect(screen.getByLabelText(/Total budget/)).toHaveValue(50000);
    await user.click(screen.getByLabelText('Food'));
    await user.click(screen.getByLabelText('Decor'));
    await user.click(screen.getByLabelText('Venue'));
    await user.selectOptions(screen.getByLabelText('Language for AI suggestions'), 'hinglish');
    expect(preview).toHaveTextContent('₹1,250');
    await nextStep(user, 'Make it yours');

    await user.selectOptions(screen.getByLabelText('Venue type'), 'home');
    await user.click(screen.getByLabelText('Jain'));
    await user.click(screen.getByLabelText('Jain'));
    await user.click(screen.getByLabelText('Vegan'));
    await user.click(screen.getByRole('button', { name: /Back/ }));
    expect(screen.getByLabelText(/Number of guests/)).toHaveValue(40);
    await nextStep(user, 'Make it yours');
    await user.click(screen.getByRole('button', { name: /Create my plan/ }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'birthday',
        title: 'Meera turns 7',
        guests: 40,
        budget: 50000,
        priorities: ['decor', 'venue'],
        venueType: 'home',
        diets: ['vegan'],
        language: 'hinglish',
      }),
    );
  });

  it('jumps back to the step with errors when submitting early', async () => {
    const user = userEvent.setup();
    render(<PlannerForm initial={{ eventType: 'wedding', city: 'Pune' }} onSubmit={vi.fn()} />);
    await user.type(screen.getByLabelText(/Event date/), future(30));
    await nextStep(user, 'Guests & budget');
    await user.clear(screen.getByLabelText(/Number of guests/));
    await user.click(screen.getByRole('button', { name: /Create my plan/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Guests must be between/);
  });

  it('shows the AI intro, pre-fills when editing, allows jumping between steps and cancel', async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    const { unmount } = render(
      <PlannerForm initial={{ city: 'Indore' }} intro="AI filled 1 detail" onSubmit={vi.fn()} />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('AI filled 1 detail');
    expect(screen.getByLabelText(/City or town/)).toHaveValue('Indore');
    unmount();

    render(<PlannerForm initial={weddingDetails} isEdit onSubmit={vi.fn()} onCancel={onCancel} />);
    expect(screen.getByRole('button', { name: /Update my plan/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /3\. Make it yours/ }));
    expect(screen.getByLabelText('Jain')).toBeChecked();
    expect(screen.getByLabelText('Colour palette')).toHaveValue('pastel pink and mint');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });
});
