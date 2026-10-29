import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import App from './App';
import { axeViolations } from './test/axe';
import { apiResponder } from './test/fixtures';

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
    expect(container.querySelectorAll('.dish img').length).toBeGreaterThan(0);
    expect(within(menu).getByText(/Dish photo credits/)).toBeInTheDocument();
    expect(within(menu).getAllByRole('link', { name: /photo source/ })[0]).toHaveAttribute(
      'href',
      expect.stringMatching(/^https:\/\/commons\.wikimedia\.org\//),
    );
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
    await user.click(screen.getByRole('button', { name: 'Find venues near Kolkata' }));
    const choose = await screen.findByRole('button', { name: 'Choose Rajbari Banquet as the venue' });
    expect(screen.getByRole('link', { name: /Photos & reviews on Google Maps/ })).toHaveAttribute(
      'href',
      expect.stringContaining('https://www.google.com/maps/search/'),
    );
    expect(await axeViolations(container)).toEqual([]);
    await user.click(choose);
    expect(await screen.findByText('“Rajbari Banquet” is on the map.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rajbari Banquet is your venue' })).toBeDisabled();
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
      expect(last?.details.colors).toBe('Marigold, Leaf green');
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
