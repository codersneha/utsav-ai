import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import App from './App';
import { axeViolations } from './test/axe';
import { apiResponder, birthdayDetails } from './test/fixtures';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- request bodies are free-form JSON
type Body = Record<string, any>;

const sentBodies = (spy: { mock: { calls: unknown[][] } }): Body[] =>
  spy.mock.calls.map((c) => JSON.parse(String((c[1] as RequestInit | undefined)?.body)) as Body);

async function openBengaliSample() {
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(apiResponder());
  const user = userEvent.setup();
  const view = render(<App />);
  await user.click(screen.getByRole('button', { name: /Try: Bengali wedding/ }));
  await screen.findByRole('heading', { name: /Ananya & Rohan/ });
  await screen.findByText('Marigold');
  return { user, fetchSpy, ...view };
}

describe('culture-grounded ideas', () => {
  it('shows each Bengali function and a served, course-by-course menu', async () => {
    const { user, container } = await openBengaliSample();
    await user.click(screen.getByRole('tab', { name: 'Ideas' }));

    const decor = screen.getByRole('region', { name: 'Ceremonies & décor' });
    expect(within(decor).getByRole('heading', { name: 'Marigold' })).toBeInTheDocument();
    expect(within(decor).getAllByRole('listitem').length).toBeGreaterThan(3);
    expect(decor).toHaveTextContent(/Gaye holud/i);
    expect(decor).not.toHaveTextContent(/Mehendi/);

    const menu = screen.getByRole('region', { name: 'The menu' });
    expect(menu).toHaveTextContent(/Never a buffet/);
    expect(menu).toHaveTextContent('Phuchka');
    expect(menu).toHaveTextContent('Mishti paan');
    expect(container.querySelectorAll('.dish img')).toHaveLength(0);
    expect(within(menu).getByRole('group', { name: 'Menu cost' })).toHaveTextContent(/per plate/);
    expect(await axeViolations(container)).toEqual([]);
  });

  it('changes the menu without touching the décor', async () => {
    const { user, fetchSpy } = await openBengaliSample();
    await user.click(screen.getByRole('tab', { name: 'Ideas' }));
    const menuForm = screen.getByRole('form', { name: 'Change the menu' });
    await user.type(within(menuForm).getByRole('textbox'), 'add ilish');
    await user.click(within(menuForm).getByRole('button', { name: /Change/ }));

    await vi.waitFor(() =>
      expect(sentBodies(fetchSpy).at(-1)).toMatchObject({ section: 'menu', refinement: 'add ilish' }),
    );
    // The décor (themed "Marigold" by the AI) is still there.
    expect(await screen.findByRole('heading', { name: 'Marigold' })).toBeInTheDocument();
  });
});

describe('venues', () => {
  it('finds venues near the city and lets the user choose one', async () => {
    const { user, container } = await openBengaliSample();
    await user.click(screen.getByRole('tab', { name: 'Vendors' }));
    await user.type(screen.getByLabelText('What kind of place would you like?'), 'garden with banquet hall');
    await user.click(screen.getByRole('button', { name: 'Find places' }));
    const choose = await screen.findByRole('button', { name: 'Choose Rajbari Banquet as the venue' });
    expect(screen.getByRole('link', { name: /Photos & reviews on Google Maps/ })).toHaveAttribute(
      'href',
      expect.stringContaining('https://www.google.com/maps/search/'),
    );
    expect(await axeViolations(container)).toEqual([]);
    await user.click(choose);
    expect(await screen.findByText(/“Rajbari Banquet” is your venue/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Choose .* as the venue/ })).not.toBeInTheDocument();
  });
});

describe('photo inspiration', () => {
  it('reads a photo and applies its colours to the décor only', async () => {
    const { user, fetchSpy } = await openBengaliSample();
    await user.click(screen.getByRole('tab', { name: 'Ideas' }));
    const photo = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4])], 'decor.jpg', {
      type: 'image/jpeg',
    });
    await user.upload(screen.getByLabelText(/Choose a photo/), photo);
    expect(await screen.findByRole('heading', { name: 'Garden marigold' })).toBeInTheDocument();
    expect(sentBodies(fetchSpy).some((b) => b.mode === 'vision' && b.mimeType === 'image/jpeg')).toBe(true);

    await user.click(screen.getByRole('button', { name: /Use this look for my décor/ }));
    await vi.waitFor(() => {
      const last = sentBodies(fetchSpy).at(-1);
      expect(last).toMatchObject({ mode: 'ideas', section: 'decor' });
      expect(last?.details.colors).toBe('Marigold #f2a900, Leaf green #3a7d44');
    });
  });

  it('refuses files that are not photos', async () => {
    const { user } = await openBengaliSample();
    await user.click(screen.getByRole('tab', { name: 'Ideas' }));
    const input = screen.getByLabelText(/Choose a photo/);
    fireEvent.change(input, {
      target: { files: [new File(['hello'], 'notes.txt', { type: 'text/plain' })] },
    });
    expect(await screen.findByText(/JPG, PNG or WebP/)).toBeInTheDocument();
  });
});

describe('guest ledger', () => {
  it('adds families, counts them and marks important guests', async () => {
    const { user, container } = await openBengaliSample();
    await user.click(screen.getByRole('tab', { name: 'Guests' }));
    await user.type(screen.getByLabelText('Family or guest name'), 'Sharma family');
    await user.type(screen.getByLabelText('Relation'), 'Mama’s family');
    await user.clear(screen.getByLabelText('Adults'));
    await user.type(screen.getByLabelText('Adults'), '4');
    await user.clear(screen.getByLabelText('Children'));
    await user.type(screen.getByLabelText('Children'), '2');
    await user.click(screen.getByLabelText('Important guest'));
    await user.click(screen.getByRole('button', { name: /Add to list/ }));

    const table = screen.getByRole('table');
    expect(within(table).getByText('Sharma family')).toBeInTheDocument();
    expect(within(table).getByText('6 people')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark Sharma family as important' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(screen.getByLabelText('Invitation sent to Sharma family'));
    await user.selectOptions(screen.getByLabelText('Reply from Sharma family'), 'confirmed');
    expect(screen.getByText('Confirmed', { selector: 'dt' }).nextSibling).toHaveTextContent('6');
    expect(await axeViolations(container)).toEqual([]);

    await user.click(screen.getByRole('button', { name: 'Remove Sharma family' }));
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

describe('what if', () => {
  it('prices extra guests and can re-plan for them with undo', async () => {
    const { user, container } = await openBengaliSample();
    await user.click(screen.getByRole('tab', { name: 'What if' }));
    const extra = screen.getByLabelText('Extra guests');
    await user.clear(extra);
    await user.type(extra, '50');
    expect(screen.getByRole('region', { name: 'More guests turn up' })).toHaveTextContent(/₹[\d,]+ more/);
    expect(await axeViolations(container)).toEqual([]);
    await user.click(screen.getByRole('button', { name: 'Plan for 350 guests' }));
    const change = await screen.findByRole('region', { name: /Plan updated/ });
    expect(change).toHaveTextContent('Guests: 300 → 350');
    await user.click(within(change).getByRole('button', { name: /Undo/ }));
    expect(screen.getByRole('list', { name: 'Event details' })).toHaveTextContent('300 guests');
  });

  it('shows next steps on the overview that open the right tab', async () => {
    const { user } = await openBengaliSample();
    const steps = screen.getByRole('article', { name: 'Your next steps' });
    await user.click(within(steps).getByRole('button', { name: /Open guests/ }));
    expect(screen.getByRole('tab', { name: 'Guests' })).toHaveAttribute('aria-selected', 'true');
  });
});

describe('choosing a café as the venue', () => {
  it('records the venue, clears the search, drops the caterer and plans from the menu photo', async () => {
    const { user, fetchSpy } = await openBengaliSample();
    await user.click(screen.getByRole('tab', { name: 'Vendors' }));
    expect(screen.getByRole('group', { name: 'Caterer' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Find places' }));
    await user.click(await screen.findByRole('button', { name: 'Choose Rajbari Banquet as the venue' }));

    // Search results are cleared and the venue shows in the Venue row as chosen.
    expect(screen.queryByRole('button', { name: /Choose .* as the venue/ })).not.toBeInTheDocument();
    expect(await screen.findByText(/“Rajbari Banquet” is your venue/)).toBeInTheDocument();
    const venueRow = screen.getByRole('group', { name: 'Venue' });
    expect(venueRow).toHaveTextContent('Chosen');
    expect(venueRow).toHaveTextContent('Rajbari Banquet');
    expect(sentBodies(fetchSpy).length).toBeGreaterThan(0);
  });

  it('reads a restaurant menu photo into a priced party order', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(apiResponder());
    window.localStorage.setItem(
      'utsav-ai:v1:details',
      JSON.stringify({
        ...birthdayDetails,
        title: 'Riya turns 16',
        date: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
        venueType: 'cafe',
        venueName: 'Boho The Sky Cafe',
      }),
    );
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Riya turns 16' });
    await user.click(screen.getByRole('tab', { name: 'Vendors' }));
    expect(screen.queryByRole('group', { name: 'Caterer' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Ideas' }));
    const card = await screen.findByRole('region', { name: /Party order from Boho The Sky Cafe/ });
    expect(within(card).getByRole('link', { name: /Open Boho The Sky Cafe on Google Maps/ })).toHaveAttribute(
      'href',
      expect.stringContaining('google.com/maps/search'),
    );
    const photo = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4])], 'menu.jpg', {
      type: 'image/jpeg',
    });
    await user.upload(within(card).getByLabelText(/Add a menu photo/), photo);
    expect(await within(card).findByText('Paneer Tikka')).toBeInTheDocument();
    expect(within(card).getByRole('group', { name: 'Order cost' })).toHaveTextContent('₹4,000');
    expect(sentBodies(fetchSpy).some((b) => b.mode === 'menuScan' && b.details.guests === 40)).toBe(true);
  });
});
