import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import AuditPayloadRenderer from '../AuditPayloadRenderer';

describe('AuditPayloadRenderer', () => {
  it('renders Italian caption for CREATE action', () => {
    render(
      <AuditPayloadRenderer
        action="CREATE"
        payload={{ id: 't-1', slug: 'foo', name: 'Foo' }}
      />,
    );
    expect(screen.getByText("Campi dell'entità creata")).toBeInTheDocument();
  });

  it('renders Italian caption for UPDATE action', () => {
    render(
      <AuditPayloadRenderer action="UPDATE" payload={{ name: 'New Name' }} />,
    );
    expect(screen.getByText('Campi modificati (patch)')).toBeInTheDocument();
  });

  it('renders Italian caption for DELETE action', () => {
    render(
      <AuditPayloadRenderer
        action="DELETE"
        payload={{ id: 't-1', slug: 'gone', name: 'Gone' }}
      />,
    );
    expect(screen.getByText("Campi dell'entità eliminata")).toBeInTheDocument();
  });

  it('renders table with key + value cells from object payload', () => {
    render(
      <AuditPayloadRenderer
        action="CREATE"
        payload={{ slug: 'lupus', name: 'Lupus rufus', dataType: 'TEXT' }}
      />,
    );
    // Column headers
    expect(screen.getByText('Campo')).toBeInTheDocument();
    expect(screen.getByText('Valore')).toBeInTheDocument();
    // Field names + values
    expect(screen.getByText('slug')).toBeInTheDocument();
    expect(screen.getByText('lupus')).toBeInTheDocument();
    expect(screen.getByText('name')).toBeInTheDocument();
    expect(screen.getByText('Lupus rufus')).toBeInTheDocument();
    expect(screen.getByText('dataType')).toBeInTheDocument();
    expect(screen.getByText('TEXT')).toBeInTheDocument();
  });

  it('renders null values as (nullo) placeholder', () => {
    render(
      <AuditPayloadRenderer
        action="UPDATE"
        payload={{ category: null, description: null }}
      />,
    );
    const nullCells = screen.getAllByText('(nullo)');
    expect(nullCells).toHaveLength(2);
  });

  it('renders empty string values as (vuoto) placeholder', () => {
    render(
      <AuditPayloadRenderer
        action="UPDATE"
        payload={{ description: '' }}
      />,
    );
    expect(screen.getByText('(vuoto)')).toBeInTheDocument();
  });

  it('renders array values with element count', () => {
    render(
      <AuditPayloadRenderer
        action="UPDATE"
        payload={{ allowedValues: ['a', 'b', 'c'] }}
      />,
    );
    expect(screen.getByText('(array, 3 elementi)')).toBeInTheDocument();
  });

  it('renders boolean values correctly', () => {
    render(
      <AuditPayloadRenderer
        action="UPDATE"
        payload={{ playableUnit: true, archived: false }}
      />,
    );
    expect(screen.getByText('true')).toBeInTheDocument();
    expect(screen.getByText('false')).toBeInTheDocument();
  });

  it('renders numeric values correctly', () => {
    render(
      <AuditPayloadRenderer
        action="UPDATE"
        payload={{ rangeMin: 0, rangeMax: 100 }}
      />,
    );
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('highlights _revertedFrom marker as separate chip (not table row)', () => {
    render(
      <AuditPayloadRenderer
        action="CREATE"
        payload={{
          id: 't-2',
          slug: 'restored',
          name: 'Restored',
          _revertedFrom: 'audit-original-99',
        }}
      />,
    );
    // Chip label (audit-trail visualization)
    expect(screen.getByText('Ripristino dalla voce audit-original-99')).toBeInTheDocument();
    // _revertedFrom key NOT in the table
    expect(screen.queryByText('_revertedFrom')).not.toBeInTheDocument();
    // Regular fields still rendered
    expect(screen.getByText('slug')).toBeInTheDocument();
    expect(screen.getByText('restored')).toBeInTheDocument();
  });

  it('falls back to raw JSON pretty-print for non-object payload (array)', () => {
    render(<AuditPayloadRenderer action="CREATE" payload={[1, 2, 3]} />);
    // No table headers for non-object → falls back to pre-formatted JSON
    expect(screen.queryByText('Campo')).not.toBeInTheDocument();
    expect(screen.getByText(/\[\s*1,\s*2,\s*3\s*\]/)).toBeInTheDocument();
  });

  it('falls back to raw JSON for null payload', () => {
    render(<AuditPayloadRenderer action="DELETE" payload={null} />);
    // null payload: empty entries → render JSON.stringify(null) = "null"
    // Caption + headers should NOT appear (no entries to table)
    expect(screen.queryByText('Campo')).not.toBeInTheDocument();
    expect(screen.getByText('null')).toBeInTheDocument();
  });

  it('renders nested object value with JSON preview', () => {
    render(
      <AuditPayloadRenderer
        action="UPDATE"
        payload={{ flags: { canSpawn: true, locked: false } }}
      />,
    );
    expect(screen.getByText('(oggetto)')).toBeInTheDocument();
    // JSON preview rendered inline
    expect(screen.getByText(/canSpawn/)).toBeInTheDocument();
  });

  // ---- Diff mode (UPDATE with previousPayload) ----------------------------

  it('renders diff columns when UPDATE + previousPayload provided', () => {
    render(
      <AuditPayloadRenderer
        action="UPDATE"
        payload={{ name: 'New Name', description: 'New desc' }}
        previousPayload={{ name: 'Old Name', description: 'Old desc', category: 'cat-1' }}
      />,
    );
    // Caption flips to diff-aware variant
    expect(screen.getByText('Campi modificati (con confronto entry precedente)')).toBeInTheDocument();
    // 3-column headers
    expect(screen.getByText('Campo')).toBeInTheDocument();
    expect(screen.getByText('Valore precedente')).toBeInTheDocument();
    expect(screen.getByText('Nuovo valore')).toBeInTheDocument();
    // Field values + prior values both visible
    expect(screen.getByText('Old Name')).toBeInTheDocument();
    expect(screen.getByText('New Name')).toBeInTheDocument();
    expect(screen.getByText('Old desc')).toBeInTheDocument();
    expect(screen.getByText('New desc')).toBeInTheDocument();
  });

  it('renders (non disponibile) for keys missing from prior payload', () => {
    render(
      <AuditPayloadRenderer
        action="UPDATE"
        payload={{ newField: 'new', existing: 'updated' }}
        previousPayload={{ existing: 'old' }}
      />,
    );
    // newField is in patch but absent in prior → "(non disponibile)" placeholder
    expect(screen.getByText('(non disponibile)')).toBeInTheDocument();
    expect(screen.getByText('new')).toBeInTheDocument();
    expect(screen.getByText('old')).toBeInTheDocument();
    expect(screen.getByText('updated')).toBeInTheDocument();
  });

  it('renders (invariato) marker when prior value equals new value', () => {
    render(
      <AuditPayloadRenderer
        action="UPDATE"
        payload={{ status: 'active', description: 'changed' }}
        previousPayload={{ status: 'active', description: 'original' }}
      />,
    );
    // status unchanged → (invariato) appears once in the new-value cell
    const unchangedCells = screen.getAllByText('(invariato)');
    expect(unchangedCells).toHaveLength(1);
    // The "active" prior value still rendered
    expect(screen.getByText('active')).toBeInTheDocument();
    // Description shows both old + new
    expect(screen.getByText('original')).toBeInTheDocument();
    expect(screen.getByText('changed')).toBeInTheDocument();
  });

  it('does NOT activate diff mode for CREATE action even if previousPayload passed', () => {
    render(
      <AuditPayloadRenderer
        action="CREATE"
        payload={{ slug: 'new-entity' }}
        previousPayload={{ slug: 'should-be-ignored' }}
      />,
    );
    // Caption stays CREATE — not diff variant
    expect(screen.getByText("Campi dell'entità creata")).toBeInTheDocument();
    expect(screen.queryByText('Valore precedente')).not.toBeInTheDocument();
    // Single Valore column header only
    expect(screen.getByText('Valore')).toBeInTheDocument();
  });

  it('does NOT activate diff mode when previousPayload is not an object', () => {
    render(
      <AuditPayloadRenderer
        action="UPDATE"
        payload={{ slug: 'changed' }}
        previousPayload={null}
      />,
    );
    // Falls back to single-value caption
    expect(screen.getByText('Campi modificati (patch)')).toBeInTheDocument();
    expect(screen.queryByText('Valore precedente')).not.toBeInTheDocument();
  });

  it('handles deep-equal objects as unchanged in diff mode', () => {
    render(
      <AuditPayloadRenderer
        action="UPDATE"
        payload={{ config: { a: 1, b: 2 } }}
        previousPayload={{ config: { a: 1, b: 2 } }}
      />,
    );
    expect(screen.getByText('(invariato)')).toBeInTheDocument();
  });
});
