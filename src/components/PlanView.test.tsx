import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { buildPlan } from '../lib/plan';
import { TODAY, weddingDetails } from '../test/fixtures';
import PlanView, { type PlanViewProps } from './PlanView';

function setup(overrides: Partial<PlanViewProps> = {}) {
  const props: PlanViewProps = {
    plan: buildPlan(weddingDetails, TODAY),
    ideas: null,
    ideasLoading: true,
    onRegenerateIdeas: vi.fn(),
    done: {},
    onToggleTask: vi.fn(),
    spent: {},
    onSpentChange: vi.fn(),
    onEdit: vi.fn(),
    onReset: vi.fn(),
    ...overrides,
  };
  render(<PlanView {...props} />);
  return props;
}

describe('PlanView', () => {
  it('shows a loading state for ideas', () => {
    setup();
    expect(screen.getByText(/Gemini is crafting ideas/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generating…' })).toBeDisabled();
  });

  it('exports the timeline as an .ics file and links to Google Calendar', async () => {
    const createUrl = vi.fn(() => 'blob:plan');
    const revokeUrl = vi.fn();
    Object.assign(URL, { createObjectURL: createUrl, revokeObjectURL: revokeUrl });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'Download timeline (.ics)' }));
    expect(createUrl).toHaveBeenCalledWith(expect.any(Blob));
    expect(click).toHaveBeenCalled();
    expect(revokeUrl).toHaveBeenCalledWith('blob:plan');
    expect(screen.getByRole('link', { name: /Add to Google Calendar/ })).toHaveAttribute(
      'href',
      expect.stringContaining('calendar.google.com'),
    );
  });

  it('prints and forwards spend changes', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    const props = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Print / save PDF' }));
    expect(print).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('tab', { name: 'Budget' }));
    await userEvent.type(screen.getByLabelText('Amount spent on Catering'), '5');
    expect(props.onSpentChange).toHaveBeenCalledWith('catering', 5);
  });

  it('shows compressed-timeline guidance and countdown states', async () => {
    setup({ plan: buildPlan({ ...weddingDetails, date: TODAY }, TODAY) });
    await userEvent.click(screen.getByRole('tab', { name: 'Timeline' }));
    expect(screen.getByText(/compressed/)).toBeInTheDocument();
  });
});
