import { describe, expect, it } from 'vitest';
import { TODAY, weddingDetails } from '../test/fixtures.js';
import { isValidImage, parseExtracted, parseInspiration, parseProposal } from './assistant.js';

describe('parseExtracted', () => {
  it('keeps only valid fields', () => {
    expect(
      parseExtracted(
        {
          eventType: 'party',
          title: '<b>Aarav</b>',
          date: '2020-01-01',
          city: 'X',
          guests: -5,
          budget: '60000',
          priorities: ['food', 'hack'],
          venueType: 'undecided',
          ageGroup: 'kids',
          colors: 'blue',
          preferences: 'superhero theme',
        },
        TODAY,
      ),
    ).toEqual({
      title: 'b Aarav /b',
      budget: 60000,
      priorities: ['food'],
      ageGroup: 'kids',
      colors: 'blue',
      preferences: 'superhero theme',
    });
  });

  it('drops placeholder text the model writes instead of omitting a field', () => {
    expect(
      parseExtracted({ city: 'Pune', colors: 'not specified', title: 'N/A', preferences: 'Unknown' }, TODAY),
    ).toEqual({
      city: 'Pune',
    });
  });

  it('returns null for empty or unusable output', () => {
    expect(parseExtracted('nope', TODAY)).toBeNull();
    expect(parseExtracted({ venueType: 'undecided', ageGroup: 'mixed' }, TODAY)).toBeNull();
  });
});

describe('parseProposal', () => {
  it('keeps real, valid changes and a fallback summary', () => {
    expect(parseProposal({ date: '2027-04-06' }, weddingDetails, TODAY)).toEqual({
      date: '2027-04-06',
      summary: 'Update the plan',
    });
  });

  it('drops no-ops, invalid plans and non-objects', () => {
    expect(parseProposal({ guests: 300, summary: 'same' }, weddingDetails, TODAY)).toBeUndefined();
    expect(parseProposal({ date: '2020-01-01', summary: 'past' }, weddingDetails, TODAY)).toBeUndefined();
    expect(parseProposal(null, weddingDetails, TODAY)).toBeUndefined();
  });
});

describe('photo inspiration', () => {
  const b64 = (bytes: string) => btoa(bytes + 'x'.repeat(24));

  it('accepts real JPEG, PNG and WebP bytes only', () => {
    expect(isValidImage(b64('\xff\xd8\xff\xe0'), 'image/jpeg', 1000)).toBe(true);
    expect(isValidImage(b64('\x89PNG\r\n'), 'image/png', 1000)).toBe(true);
    expect(isValidImage(b64('RIFF\0\0\0\0WEBP'), 'image/webp', 1000)).toBe(true);
    expect(isValidImage(b64('\x89PNG\r\n'), 'image/jpeg', 1000)).toBe(false);
    expect(isValidImage(b64('GIF89a'), 'image/gif', 1000)).toBe(false);
    expect(isValidImage('not base64 !!', 'image/jpeg', 1000)).toBe(false);
    expect(isValidImage(b64('\xff\xd8\xff\xe0'), 'image/jpeg', 10)).toBe(false);
  });

  it('keeps a theme only with valid colours and cleans the text', () => {
    const look = parseInspiration({
      theme: '<b>Garden</b> haldi',
      mood: 'Bright',
      palette: [
        { name: 'Yellow', hex: '#FFD700' },
        { name: 'Oops', hex: 'javascript:1' },
      ],
      elements: ['Marigold umbrellas'],
    });
    expect(look?.theme).not.toContain('<');
    expect(look?.palette).toEqual([{ name: 'Yellow', hex: '#ffd700' }]);
    expect(parseInspiration({ theme: 'x', palette: [{ name: 'a', hex: 'bad' }] })).toBeNull();
  });
});
