import { describe, expect, it } from 'vitest';
import { TODAY, weddingDetails } from '../test/fixtures.js';
import { buildPlan } from './plan.js';
import { familyUpdate, readSharedPlan, shareUrl, whatsappUrl } from './share.js';

describe('share links', () => {
  it('round-trips event details, including non-Latin text', () => {
    const details = { ...weddingDetails, title: 'प्रिया & Arjun 💍' };
    const url = shareUrl(details, 'https://utsav.example/');
    expect(url.startsWith('https://utsav.example/#plan=')).toBe(true);
    expect(readSharedPlan(url.slice(url.indexOf('#')))).toEqual(details);
  });

  it('rejects missing, corrupt or invalid shared plans', () => {
    expect(readSharedPlan('')).toBeNull();
    expect(readSharedPlan('#plan=!!!not-base64')).toBeNull();
    expect(readSharedPlan(`#plan=${btoa(JSON.stringify({ eventType: 'hack' }))}`)).toBeNull();
    expect(readSharedPlan(`#plan=${'a'.repeat(5000)}`)).toBeNull();
  });
});

describe('family update', () => {
  it('summarises the plan from its own facts', () => {
    const plan = buildPlan(weddingDetails, TODAY);
    const text = familyUpdate(plan, { budget: true }, TODAY);
    expect(text).toContain('Priya & Arjun — 20 Apr 2027, Jaipur');
    expect(text).toContain('173 days to go · 300 guests');
    expect(text).toContain(`✅ 1 of ${plan.timeline.milestones.length} planning tasks done`);
    expect(text).toContain('Next up:');
    expect(familyUpdate(plan, {}, '2027-04-20')).toContain('It’s here!');
  });

  it('builds a WhatsApp click-to-chat link', () => {
    expect(whatsappUrl('Hi & bye')).toBe('https://wa.me/?text=Hi%20%26%20bye');
  });
});
