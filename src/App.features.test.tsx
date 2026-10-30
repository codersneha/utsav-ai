import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import App from './App';
import { saveJson } from './lib/storage';
import { axeViolations } from './test/axe';
import { apiResponder } from './test/fixtures';
import type { EventDetails } from './types';

/** Clicks Next and waits until focus has moved to the new step's heading. */
async function nextStep(user: ReturnType<typeof userEvent.setup>, title: string) {
  await user.click(screen.getByRole('button', { name: /Next/ }));
  await vi.waitFor(() => expect(screen.getByRole('heading', { name: title })).toHaveFocus());
}

const future = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

const birthday: EventDetails = {
  eventType: 'birthday',
  title: 'Meera turns 7',
  date: future(45),
  city: 'Pune',
  guests: 40,
  budget: 60_000,
  preferences: '',
  priorities: [],
  venueType: 'home',
  diets: ['jain'],
  ageGroup: 'kids',
  colors: '',
  language: 'en',
  tradition: 'modern',
  ceremonies: [],
  venueName: '',
  venuePreference: '',
  wantsDecor: true,
};

/** Renders the app with a saved plan and a working (mocked) API. */
async function openPlan(details: EventDetails = birthday) {
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(apiResponder('Start with the venue.'));
  saveJson('details', details);
  const user = userEvent.setup();
  const view = render(<App />);
  await screen.findByRole('heading', { name: details.title });
  await screen.findByText('Marigold');
  return { user, fetchSpy, ...view };
}

describe('budget: estimates, edits and trade-offs', () => {
  it('lets the user apply a trade-off and explains what changed', async () => {
    const { user, container } = await openPlan({
      ...birthday,
      title: 'Big party',
      guests: 400,
      budget: 60_000,
    });
    await user.click(screen.getByRole('tab', { name: 'Budget' }));
    expect(screen.getByText(/These are estimates, not quotes/)).toBeInTheDocument();
    const options = screen.getByRole('region', { name: 'Your options — you choose' });
    expect(await axeViolations(container)).toEqual([]);

    await user.click(within(options).getByRole('button', { name: /Apply: Invite up to \d+ guests/ }));
    const change = await screen.findByRole('region', { name: /Plan updated/ });
    expect(change).toHaveTextContent(/Guests: 400 → \d+/);
    expect(change).toHaveFocus();
    expect(await axeViolations(container)).toEqual([]);
    await user.click(within(change).getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('region', { name: /Plan updated/ })).not.toBeInTheDocument();
  });

  it('accepts the user’s own amount and can reset it to the estimate', async () => {
    const { user } = await openPlan();
    await user.click(screen.getByRole('tab', { name: 'Budget' }));
    const venue = screen.getByLabelText('Planned amount for Venue');
    await user.clear(venue);
    await user.type(venue, '5000{Enter}');
    expect(screen.getByLabelText('Planned amount for Venue')).toHaveValue('5000');
    expect(screen.getByLabelText('Planned amount for Venue')).toHaveAccessibleDescription('Your amount');
    // The rest of the budget moved to keep the total, and the change is summarised.
    expect(screen.getByText(/Balanced — everything adds up/)).toBeInTheDocument();
    expect(screen.getByText(/Venue −₹/)).toBeInTheDocument();
    expect(screen.getByText(/Guest-count impact/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reset to suggested split' }));
    expect(screen.getByLabelText('Planned amount for Venue')).toHaveAccessibleDescription('Estimate');
  });

  it('removes money to unallocated, places it elsewhere, and respects locks', async () => {
    const { user, container } = await openPlan();
    await user.click(screen.getByRole('tab', { name: 'Budget' }));
    const venueBefore = (screen.getByLabelText('Planned amount for Venue') as HTMLInputElement).value;
    await user.click(screen.getByRole('button', { name: 'Lock Venue' }));
    expect(screen.getByRole('button', { name: 'Lock Venue' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: 'Remove the money from Games & entertainment' }));
    expect(screen.getByText(/is unallocated — place it below/)).toBeInTheDocument();
    expect(screen.getByLabelText('Planned amount for Games & entertainment')).toHaveValue('0');
    expect(await axeViolations(container)).toEqual([]);

    await user.selectOptions(screen.getByLabelText(/Put the unallocated/), 'decor');
    await user.click(screen.getByRole('button', { name: 'Allocate' }));
    expect(screen.getByText(/Balanced — everything adds up/)).toBeInTheDocument();
    expect(screen.getByText(/Decor & balloons \+₹/)).toBeInTheDocument();
    // The locked venue never moved.
    expect(screen.getByLabelText('Planned amount for Venue')).toHaveValue(venueBefore);
  });

  it('shifts money to food through overrides when chosen', async () => {
    const { user } = await openPlan({ ...birthday, title: 'Tight budget', guests: 150, budget: 60_000 });
    await user.click(screen.getByRole('tab', { name: 'Budget' }));
    await user.click(screen.getByRole('button', { name: /Apply: Move ₹[\d,]+ to food/ }));
    expect(screen.getByLabelText('Planned amount for Food & cake')).toHaveAccessibleDescription(
      'Your amount',
    );
  });
});

describe('timeline: tracking, custom tasks and the day-of schedule', () => {
  it('tracks completion, adds and removes custom tasks, and shows the AI schedule', async () => {
    const { user, container } = await openPlan();
    await user.click(screen.getByRole('tab', { name: 'Timeline' }));
    expect(screen.getByText('Tasks done: 0%')).toBeInTheDocument();
    await user.click(screen.getByLabelText('Send invitations'));
    expect(screen.getByText(/Tasks done: [1-9]\d*%/)).toBeInTheDocument();
    expect(screen.getAllByText('High').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Add task' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Describe the task');
    await user.type(screen.getByLabelText('Task'), 'Buy candles');
    await user.click(screen.getByRole('button', { name: 'Add task' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Pick a due date');
    await user.type(screen.getByLabelText('Due date'), future(10));
    await user.selectOptions(screen.getByLabelText('Priority'), 'Low');
    await user.click(screen.getByRole('button', { name: 'Add task' }));
    expect(screen.getByLabelText('Buy candles')).toBeInTheDocument();
    expect(screen.getByText('Your task')).toBeInTheDocument();

    const schedule = screen.getByRole('region', { name: 'Event-day schedule' });
    expect(within(schedule).getByText(/Drafted by Google Gemini/)).toBeInTheDocument();
    expect(within(schedule).getAllByRole('listitem')[0]).toHaveTextContent('16:00');
    expect(await axeViolations(container)).toEqual([]);

    await user.click(screen.getByRole('button', { name: 'Remove task: Buy candles' }));
    expect(screen.queryByLabelText('Buy candles')).not.toBeInTheDocument();
  });
});

describe('vendors: AI advice and the user’s own records', () => {
  it('shows AI tasks and questions, and tracks vendors, quotes and status', async () => {
    const { user, container } = await openPlan();
    await user.click(screen.getByRole('tab', { name: 'Vendors' }));
    const caterer = screen.getByRole('group', { name: 'Caterer' });
    expect(caterer).toHaveTextContent('Not started');
    await user.click(within(caterer).getByText('Caterer'));
    expect(within(caterer).getByLabelText(/Confirm a separate Jain counter/)).toBeVisible();
    expect(within(caterer).getByText('Is Jain food cooked separately?')).toBeVisible();

    await user.click(within(caterer).getByRole('button', { name: /Add caterer/ }));
    await user.click(within(caterer).getByRole('button', { name: 'Save vendor' }));
    expect(within(caterer).getByRole('alert')).toHaveTextContent('Enter the vendor’s name');
    await user.type(within(caterer).getByLabelText('Name'), 'Annapurna Caterers');
    await user.type(within(caterer).getByLabelText('Phone or email'), '98xxxxxx10');
    await user.type(within(caterer).getByLabelText('Address'), 'Lake Town, Kolkata');
    await user.type(within(caterer).getByLabelText('Quote (₹, optional)'), '999999');
    await user.type(within(caterer).getByLabelText('Notes'), 'Two tastings included');
    await user.click(within(caterer).getByRole('button', { name: 'Save vendor' }));

    expect(within(caterer).getByText('Annapurna Caterers')).toBeInTheDocument();
    expect(within(caterer).getByText(/is over the/)).toBeInTheDocument();
    expect(within(caterer).getByText('Two tastings included')).toBeInTheDocument();
    expect(within(caterer).getByRole('link', { name: /Lake Town, Kolkata/ })).toHaveAttribute(
      'href',
      expect.stringContaining('google.com/maps/search'),
    );
    expect(caterer).toHaveTextContent('Quotes in');
    const status = within(caterer).getByLabelText('Status of Annapurna Caterers');
    expect(status).toHaveValue('quoted');
    await user.selectOptions(status, 'confirmed');
    expect(status).toHaveValue('confirmed');
    expect(caterer).toHaveTextContent('Booked');

    await user.click(within(caterer).getByRole('button', { name: 'Edit notes for Annapurna Caterers' }));
    const notes = within(caterer).getByLabelText('Notes about Annapurna Caterers');
    await user.clear(notes);
    await user.type(notes, 'Advance paid');
    await user.click(within(caterer).getByRole('button', { name: 'Save notes' }));
    expect(within(caterer).getByText('Advance paid')).toBeInTheDocument();
    expect(await axeViolations(container)).toEqual([]);

    await user.click(within(caterer).getByRole('button', { name: 'Remove Annapurna Caterers' }));
    expect(within(caterer).getByText(/No contacts yet/)).toBeInTheDocument();
  });

  it('can cancel adding a vendor', async () => {
    const { user } = await openPlan();
    await user.click(screen.getByRole('tab', { name: 'Vendors' }));
    const venue = screen.getByRole('group', { name: 'Venue' });
    await user.click(within(venue).getByText('Venue'));
    await user.click(within(venue).getByRole('button', { name: /Add venue/ }));
    await user.click(within(venue).getByRole('button', { name: 'Cancel' }));
    expect(within(venue).getByRole('button', { name: /Add venue/ })).toBeInTheDocument();
  });
});

describe('ideas refinement and the planner conversation', () => {
  it('refines ideas without starting over', async () => {
    const { user, fetchSpy } = await openPlan();
    await user.click(screen.getByRole('tab', { name: 'Ideas' }));
    await user.click(screen.getByRole('button', { name: 'Cheaper options' }));
    expect(await screen.findByText('Refined: Cheaper options')).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Tell the AI what to change/), 'small terrace venue');
    await user.click(screen.getByRole('button', { name: 'Refine' }));
    expect(await screen.findByText('Refined: small terrace venue')).toBeInTheDocument();
    const last = JSON.parse(String(fetchSpy.mock.calls.at(-1)?.[1]?.body));
    expect(last.previousThemes).toEqual(['Marigold']);
  });

  it('remembers the conversation and can clear it', async () => {
    const { user, fetchSpy } = await openPlan();
    await user.click(screen.getByRole('tab', { name: 'Ask AI' }));
    await user.type(screen.getByLabelText('Your question'), 'What first?');
    await user.click(screen.getByRole('button', { name: 'Ask' }));
    expect(await screen.findByText('Start with the venue.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'How do I plan for rain?' }));
    expect(await screen.findAllByText('Start with the venue.')).toHaveLength(2);
    const sent = JSON.parse(String(fetchSpy.mock.calls.at(-1)?.[1]?.body));
    expect(sent.history).toEqual([{ question: 'What first?', answer: 'Start with the venue.' }]);
    await user.click(screen.getByRole('button', { name: 'Clear conversation' }));
    expect(screen.queryByText('Start with the venue.')).not.toBeInTheDocument();
  });
});

describe('revising the plan and exporting it', () => {
  it('revises in place when guests, budget and date change, keeping the user’s work', async () => {
    const { user } = await openPlan();
    await user.click(screen.getByRole('tab', { name: 'Timeline' }));
    await user.click(screen.getByLabelText('Send invitations'));

    await user.click(screen.getByRole('button', { name: 'Change details' }));
    const date = screen.getByLabelText(/Event date/);
    await user.clear(date);
    await user.type(date, future(31));
    await nextStep(user, 'Guests & budget');
    const guests = screen.getByLabelText(/Number of guests/);
    await user.clear(guests);
    await user.type(guests, '90');
    const budget = screen.getByLabelText(/Total budget/);
    await user.clear(budget);
    await user.type(budget, '50000');
    await user.click(screen.getByRole('button', { name: /Update my plan/ }));

    const change = await screen.findByRole('region', { name: /Plan updated/ });
    expect(change).toHaveTextContent('Guests: 40 → 90 (+50)');
    expect(change).toHaveTextContent('Budget: ₹60,000 → ₹50,000');
    expect(change).toHaveTextContent('14 days earlier');
    expect(change).toHaveTextContent('Kept: your budget edits, completed tasks');
    await user.click(screen.getByRole('tab', { name: 'Timeline' }));
    expect(screen.getByLabelText('Send invitations')).toBeChecked();
  });

  it('exports the timeline as .ics, links to Google Calendar and prints', async () => {
    const createUrl = vi.fn(() => 'blob:plan');
    const revokeUrl = vi.fn();
    Object.assign(URL, { createObjectURL: createUrl, revokeObjectURL: revokeUrl });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    const { user } = await openPlan();

    await user.click(screen.getByRole('tab', { name: 'Timeline' }));
    await user.click(screen.getByRole('button', { name: 'Download reminders (.ics)' }));
    expect(createUrl).toHaveBeenCalledWith(expect.any(Blob));
    expect(click).toHaveBeenCalled();
    expect(revokeUrl).toHaveBeenCalledWith('blob:plan');
    expect(screen.getByRole('link', { name: /Add to Google Calendar/ })).toHaveAttribute(
      'href',
      expect.stringContaining('calendar.google.com'),
    );
    await user.click(screen.getByRole('button', { name: 'Print summary' }));
    expect(print).toHaveBeenCalled();

    // The clean summary exists only while printing.
    expect(screen.queryByText('UtsavAI · Celebration plan')).not.toBeInTheDocument();
    act(() => {
      window.dispatchEvent(new Event('beforeprint'));
    });
    expect(screen.getByText('UtsavAI · Celebration plan')).toBeInTheDocument();
    act(() => {
      window.dispatchEvent(new Event('afterprint'));
    });
    expect(screen.queryByText('UtsavAI · Celebration plan')).not.toBeInTheDocument();
  });

  it('shares a link to the plan from the header', async () => {
    const { user } = await openPlan();
    // user-event provides a clipboard; watch what is written to it.
    const writeText = vi.spyOn(navigator.clipboard, 'writeText');
    await user.click(screen.getByRole('button', { name: 'Share link' }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('#plan='));
    expect(((await screen.findByLabelText(/Link copied/)) as HTMLInputElement).value).toContain('#plan=');
    expect(screen.getByRole('progressbar', { name: 'Plan readiness' })).toHaveAttribute('aria-valuenow', '0');
  });
});
