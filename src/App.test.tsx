import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import App from './App';
import { saveJson } from './lib/storage';
import { axeViolations } from './test/axe';
import { geminiIdeas } from './test/fixtures';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const future = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

async function fillForm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByLabelText(/Wedding/));
  await user.type(screen.getByLabelText('Event name'), 'Priya & Arjun');
  await user.type(screen.getByLabelText(/Event date/), future(200));
  await user.type(screen.getByLabelText(/City or town/), 'Jaipur');
  await user.type(screen.getByLabelText(/Number of guests/), '300');
  await user.type(screen.getByLabelText(/Total budget/), '2500000');
  await user.click(screen.getByRole('button', { name: 'Create my plan' }));
}

describe('App end-to-end flow', () => {
  it('creates a plan, shows Gemini ideas and every planning section', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      return body.mode === 'ask'
        ? jsonResponse({ answer: 'Book the venue first.' })
        : jsonResponse({ ideas: geminiIdeas });
    });
    const user = userEvent.setup();
    const { container } = render(<App />);
    expect(await axeViolations(container)).toEqual([]);

    await fillForm(user);

    expect(await screen.findByRole('heading', { name: 'Priya & Arjun' })).toBeInTheDocument();
    expect(await screen.findByText('Marigold')).toBeInTheDocument();
    expect(screen.getByText(/Generated with Google Gemini/)).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledWith('/api/generate', expect.objectContaining({ method: 'POST' }));
    expect(await axeViolations(container)).toEqual([]);

    // Budget: exact allocation and expense tracking.
    await user.click(screen.getByRole('tab', { name: 'Budget' }));
    expect(screen.getByText('Catering')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Amount spent on Venue & stay'), '9999999');
    expect(screen.getByText(/Spending is over plan in: Venue & stay/)).toBeInTheDocument();
    expect(await axeViolations(container)).toEqual([]);

    // Timeline.
    await user.click(screen.getByRole('tab', { name: 'Timeline' }));
    expect(screen.getByText(/Shortlist and book the venue/)).toBeInTheDocument();

    // Vendor checklist with persisted progress.
    await user.click(screen.getByRole('tab', { name: 'Vendors' }));
    await user.click(screen.getByLabelText('Visit at least 3 venues'));
    expect(screen.getByText(/Checklist: \d+% complete/)).not.toHaveTextContent('Checklist: 0%');
    expect(screen.getAllByRole('link', { name: /on Google Maps/ })[0]).toHaveAttribute(
      'href',
      expect.stringContaining('google.com/maps/search'),
    );
    expect(await axeViolations(container)).toEqual([]);

    // Ask the planner.
    await user.click(screen.getByRole('tab', { name: 'Ask AI' }));
    await user.type(screen.getByLabelText('Your question'), 'What first?');
    await user.click(screen.getByRole('button', { name: 'Ask' }));
    expect(await screen.findByText('Book the venue first.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /plan for rain/ }));
    expect(await screen.findAllByText('Book the venue first.')).toHaveLength(2);
    expect(await axeViolations(container)).toEqual([]);
  });

  it('falls back to curated ideas when the AI is unavailable', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ error: 'x' }, 503));
    const user = userEvent.setup();
    render(<App />);
    await fillForm(user);
    expect(await screen.findByText(/not configured on this deployment/)).toBeInTheDocument();
    expect(screen.getByText('Curated ideas')).toBeInTheDocument();
    expect(screen.getByText('Marigold Mela')).toBeInTheDocument();
  });

  it('restores a saved plan, supports editing, regenerating and starting over', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => jsonResponse({ ideas: geminiIdeas }));
    saveJson('details', {
      eventType: 'community',
      title: 'Diwali Mela',
      date: future(40),
      city: 'Indore',
      guests: 500,
      budget: 300000,
      preferences: '',
      priorities: ['entertainment'],
    });
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Diwali Mela' })).toBeInTheDocument();
    expect(screen.getByText(/days to go/)).toBeInTheDocument();

    // The restored plan loads ideas on its own first; wait for that before regenerating.
    expect(await screen.findByText('Marigold')).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Generate new ideas' }));
    expect(await screen.findByText('Marigold')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Change details' }));
    expect(screen.getByLabelText(/City or town/)).toHaveValue('Indore');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByRole('heading', { name: 'Diwali Mela' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Change details' }));
    await user.click(screen.getByLabelText(/Birthday/));
    await user.click(screen.getByRole('button', { name: 'Update my plan' }));
    const summary = await screen.findByRole('region', { name: 'Diwali Mela' });
    expect(within(summary).getByText('Birthday')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Start a new plan' }));
    expect(screen.getByRole('heading', { name: 'Plan your celebration in minutes' })).toBeInTheDocument();
  });

  it('ignores corrupt saved data', () => {
    window.localStorage.setItem('utsav-ai:v1:details', '{"eventType":"hack"}');
    render(<App />);
    expect(screen.getByRole('button', { name: 'Create my plan' })).toBeInTheDocument();
  });
});
