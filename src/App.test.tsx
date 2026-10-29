import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import App from './App';
import { shareUrl } from './lib/share';
import { saveJson } from './lib/storage';
import { axeViolations } from './test/axe';
import { apiResponder, birthdayDetails } from './test/fixtures';

/** Clicks Next and waits until focus has moved to the new step's heading. */
async function nextStep(user: ReturnType<typeof userEvent.setup>, title: string) {
  await user.click(screen.getByRole('button', { name: /Next/ }));
  await vi.waitFor(() => expect(screen.getByRole('heading', { name: title })).toHaveFocus());
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const future = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

async function fillForm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByLabelText(/Wedding/));
  await user.type(screen.getByLabelText('Event name'), 'Priya & Arjun');
  await user.type(screen.getByLabelText(/Event date/), future(200));
  await user.type(screen.getByLabelText(/City or town/), 'Jaipur');
  await nextStep(user, 'Guests & budget');
  await user.type(screen.getByLabelText(/Number of guests/), '300');
  await user.type(screen.getByLabelText(/Total budget/), '2500000');
  await user.click(screen.getByRole('button', { name: /Create my plan/ }));
}

describe('App end-to-end flow', () => {
  it('creates a plan, shows the overview and every planning section', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(apiResponder());
    const user = userEvent.setup();
    const { container } = render(<App />);
    expect(
      screen.getByRole('heading', { level: 1, name: /Plan celebrations people remember/ }),
    ).toBeInTheDocument();
    expect(await axeViolations(container)).toEqual([]);

    await fillForm(user);

    expect(await screen.findByRole('heading', { name: 'Priya & Arjun' })).toBeInTheDocument();
    // Overview dashboard.
    expect(await screen.findByText('Marigold')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Tasks done: 0%/ })).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: /Budget of ₹25,00,000 split across categories/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Share update on WhatsApp/ })).toHaveAttribute(
      'href',
      expect.stringContaining('https://wa.me/?text='),
    );
    expect(fetchSpy).toHaveBeenCalledWith('/api/generate', expect.objectContaining({ method: 'POST' }));
    expect(await axeViolations(container)).toEqual([]);

    await user.click(screen.getByRole('tab', { name: 'Ideas' }));
    expect(screen.getByText(/Generated with Google Gemini/)).toBeInTheDocument();

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
    expect(screen.getByText(/Try one of the suggestions below/)).toBeInTheDocument();
    await user.type(screen.getByLabelText('Your question'), 'What first?');
    await user.click(screen.getByRole('button', { name: 'Ask' }));
    expect(await screen.findByText('Book the venue first.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /plan for rain/ }));
    expect(await screen.findAllByText('Book the venue first.')).toHaveLength(2);
    expect(await axeViolations(container)).toEqual([]);
  });

  it('falls back to curated ideas when the AI is unavailable', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => jsonResponse({ error: 'x' }, 503));
    const user = userEvent.setup();
    render(<App />);
    await fillForm(user);
    await screen.findByRole('heading', { name: 'Priya & Arjun' });
    await user.click(screen.getByRole('tab', { name: 'Ideas' }));
    expect(await screen.findByText(/not configured on this deployment/)).toBeInTheDocument();
    expect(screen.getByText('Curated ideas')).toBeInTheDocument();
    expect(screen.getByText('Marigold Mela')).toBeInTheDocument();
  });

  it('restores a saved plan, supports editing, regenerating and starting over', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(apiResponder());
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
    await user.click(screen.getByRole('tab', { name: 'Ideas' }));
    await user.click(await screen.findByRole('button', { name: 'Generate new ideas' }));
    expect(await screen.findByText('Marigold')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Change details' }));
    expect(screen.getByLabelText(/City or town/)).toHaveValue('Indore');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByRole('heading', { name: 'Diwali Mela' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Change details' }));
    await user.click(screen.getByLabelText(/Birthday/));
    await user.click(screen.getByRole('button', { name: /Update my plan/ }));
    const summary = await screen.findByRole('region', { name: 'Diwali Mela' });
    expect(within(summary).getByText('Birthday')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Start a new plan' }));
    expect(
      screen.getByRole('heading', { level: 1, name: /Plan celebrations people remember/ }),
    ).toBeInTheDocument();
  });

  it('ignores corrupt saved data', () => {
    window.localStorage.setItem('utsav-ai:v1:details', '{"eventType":"hack"}');
    render(<App />);
    expect(screen.getByRole('button', { name: /Next/ })).toBeInTheDocument();
  });
});

describe('landing shortcuts', () => {
  it('opens a full sample plan in one click', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(apiResponder());
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: /Try: 7th birthday/ }));
    expect(await screen.findByRole('heading', { name: 'Meera turns 7' })).toBeInTheDocument();
    expect(screen.getByText(/Opened the sample plan/)).toBeInTheDocument();
  });

  it('fills the form from a free-text description for the user to check', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(apiResponder());
    const user = userEvent.setup();
    render(<App />);
    await user.type(
      screen.getByLabelText(/Write it like you would to a friend/),
      'Bhai ki shaadi Lucknow mein, 250 log, 18 lakh',
    );
    await user.click(screen.getByRole('button', { name: /Fill the form with AI/ }));
    expect(await screen.findByText(/AI filled 4 details from your description/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Wedding/)).toBeChecked();
    expect(screen.getByLabelText(/City or town/)).toHaveValue('Lucknow');
  });

  it('explains when nothing could be extracted', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => jsonResponse({}, 503));
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByLabelText(/Write it like you would to a friend/), 'something about a party');
    await user.click(screen.getByRole('button', { name: /Fill the form with AI/ }));
    expect(await screen.findByText(/AI is not configured here/)).toBeInTheDocument();
  });
});

describe('chat-driven changes and undo', () => {
  it('proposes a change, applies it only on request, and can undo it', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(apiResponder());
    saveJson('details', birthdayDetails);
    const user = userEvent.setup();
    const { container } = render(<App />);
    await screen.findByRole('heading', { name: /Your birthday|birthday/i });
    await user.click(screen.getByRole('tab', { name: 'Ask AI' }));
    await user.click(screen.getByRole('button', { name: 'We now have 50 more guests' }));

    expect(await screen.findByText(/Suggested change: 50 more guests/)).toBeInTheDocument();
    expect(screen.getByText(/Guests: 40 → 90 \(\+50\)/)).toBeInTheDocument();
    expect(await axeViolations(container)).toEqual([]);
    await user.click(screen.getByRole('button', { name: /Apply change/ }));

    const change = await screen.findByRole('region', { name: /Plan updated/ });
    expect(change).toHaveTextContent('Guests: 40 → 90');
    expect(screen.getByText(/✓ Applied/)).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Event details' })).toHaveTextContent('90 guests');

    await user.click(within(change).getByRole('button', { name: /Undo/ }));
    expect(screen.getByRole('list', { name: 'Event details' })).toHaveTextContent('40 guests');
    expect(screen.getByRole('region', { name: /Plan updated/ })).toHaveTextContent('Undone');
  });

  it('can dismiss a proposal', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(apiResponder());
    saveJson('details', birthdayDetails);
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('tab', { name: 'Ask AI' }));
    await user.click(screen.getByRole('button', { name: 'We now have 50 more guests' }));
    await user.click(await screen.findByRole('button', { name: /No thanks/ }));
    expect(screen.getByText('Not applied.')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Event details' })).toHaveTextContent('40 guests');
  });
});

describe('shared plan links', () => {
  it('offers to open a plan shared by link', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(apiResponder());
    const url = shareUrl({ ...birthdayDetails, title: 'Shared party' }, 'http://localhost/');
    window.history.replaceState(null, '', url.slice(url.indexOf('#')));
    const user = userEvent.setup();
    render(<App />);
    const banner = screen.getByRole('region', { name: 'Shared plan' });
    expect(banner).toHaveTextContent('Shared party');
    await user.click(within(banner).getByRole('button', { name: 'Open shared plan' }));
    expect(await screen.findByRole('heading', { name: 'Shared party' })).toBeInTheDocument();
    expect(window.location.hash).toBe('');
  });

  it('can be dismissed', async () => {
    const url = shareUrl(birthdayDetails, 'http://localhost/');
    window.history.replaceState(null, '', url.slice(url.indexOf('#')));
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Not now' }));
    expect(screen.queryByRole('region', { name: 'Shared plan' })).not.toBeInTheDocument();
  });
});

describe('plans saved by older versions', () => {
  it('upgrades a v1 plan without the newer fields instead of crashing', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(apiResponder());
    window.localStorage.setItem(
      'utsav-ai:v1:details',
      JSON.stringify({
        eventType: 'birthday',
        title: 'Old plan',
        date: future(50),
        city: 'Pune',
        guests: 40,
        budget: 60000,
      }),
    );
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Old plan' })).toBeInTheDocument();
    expect(await screen.findByText('Marigold')).toBeInTheDocument();
  });
});
