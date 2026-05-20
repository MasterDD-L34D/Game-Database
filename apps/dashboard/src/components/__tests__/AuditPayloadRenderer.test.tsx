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
});
