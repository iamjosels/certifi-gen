import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { useAppStore } from '../../src/ui/store/app-store';
import { ParticipantsStep } from '../../src/ui/steps/ParticipantsStep';
import { renderWithServices, textFile } from './test-utils';

const LIST = [
  'Ana Ruiz',
  '',
  'Luis  Pérez',
  'ANA RUIZ',
  '   ',
  ...Array.from({ length: 25 }, (_, i) => `Persona ${String(i + 1)}`),
].join('\n');

async function upload(file: File) {
  const user = userEvent.setup();
  renderWithServices(<ParticipantsStep />);
  await user.upload(screen.getByLabelText('Elegir lista de participantes'), file);
  await screen.findByText('Participantes válidos');
  return user;
}

describe('ParticipantsStep', () => {
  it('reads a TXT list and reports valid, empty and repeated names', async () => {
    await upload(textFile('lista.txt', LIST));
    expect(screen.getByText('Participantes válidos').nextElementSibling).toHaveTextContent('28');
    expect(screen.getByText('Filas vacías descartadas').nextElementSibling).toHaveTextContent('2');
    expect(screen.getByText('Nombres repetidos').nextElementSibling).toHaveTextContent('1');
    expect(screen.getByText('Hay 1 nombre repetido')).toBeVisible();
    expect(screen.getByText('Luis Pérez')).toBeVisible();
  });

  it('paginates and searches without accents or case', async () => {
    const user = await upload(textFile('lista.txt', LIST));
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(21);
    expect(screen.getByText('Página 1 de 2')).toBeVisible();
    await user.click(screen.getByRole('button', { name: /Siguiente/ }));
    expect(screen.getByText('Página 2 de 2')).toBeVisible();
    expect(within(table).getAllByRole('row')).toHaveLength(9);

    await user.type(screen.getByRole('searchbox', { name: 'Buscar participante' }), 'luis perez');
    expect(within(table).getAllByRole('row')).toHaveLength(2);
    expect(screen.getByText('1 de 28')).toBeVisible();
  });

  it('filters the repeated names', async () => {
    const user = await upload(textFile('lista.txt', LIST));
    await user.click(screen.getByRole('button', { name: 'Ver repetidos' }));
    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    expect(rows.map((row) => within(row).getAllByRole('cell')[1]?.textContent)).toEqual([
      'Ana Ruiz',
      'ANA RUIZ',
    ]);
  });

  it('edits a name inline and recomputes duplicates', async () => {
    const user = await upload(textFile('lista.txt', LIST));
    await user.click(screen.getByRole('button', { name: 'Editar el nombre de ANA RUIZ' }));
    const input = screen.getByRole('textbox', { name: 'Nuevo nombre para ANA RUIZ' });
    await user.clear(input);
    await user.type(input, 'Ana María Ruiz{Enter}');
    expect(screen.getByText('Ana María Ruiz')).toBeVisible();
    expect(useAppStore.getState().participants?.list.participants[2]?.name).toBe('Ana María Ruiz');
    expect(useAppStore.getState().participants?.list.report.duplicateCount).toBe(0);
  });

  it('does not accept an empty name and Escape cancels', async () => {
    const user = await upload(textFile('lista.txt', LIST));
    await user.click(screen.getByRole('button', { name: 'Editar el nombre de Ana Ruiz' }));
    await user.clear(screen.getByRole('textbox', { name: 'Nuevo nombre para Ana Ruiz' }));
    expect(screen.getByRole('button', { name: 'Guardar nombre' })).toBeDisabled();
    await user.keyboard('{Escape}');
    expect(screen.getByText('Ana Ruiz')).toBeVisible();
  });

  it('lets the user pick the name column of a CSV', async () => {
    const csv = 'Correo;Nombre completo;Curso\na@x.pe;Ana Ruiz;Diseño\nb@x.pe;Luis Pérez;Web\n';
    const user = await upload(textFile('lista.csv', csv, 'text/csv'));
    const select = screen.getByRole('combobox', { name: 'Columna con el nombre' });
    expect(select).toHaveDisplayValue('Nombre completo');
    expect(screen.getByRole('columnheader', { name: 'Correo' })).toBeVisible();
    await user.selectOptions(select, 'Curso');
    expect(useAppStore.getState().participants?.list.participants.map((p) => p.name)).toEqual([
      'Diseño',
      'Web',
    ]);
    await user.click(screen.getByRole('checkbox', { name: 'La primera fila es el encabezado' }));
    expect(useAppStore.getState().participants?.list.report.valid).toBe(3);
  });

  it('explains unsupported and empty lists', async () => {
    const user = userEvent.setup({ applyAccept: false });
    renderWithServices(<ParticipantsStep />);
    await user.upload(
      screen.getByLabelText('Elegir lista de participantes'),
      textFile('lista.json', '{}', 'application/json'),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(/Formato de lista no soportado/);
    await user.upload(
      screen.getByLabelText('Elegir lista de participantes'),
      textFile('vacia.txt', '\n  \n'),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(/no tiene ningún nombre/);
  });
});
