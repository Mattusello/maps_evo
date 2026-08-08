/**
 * Eliminazione di un itinerario provata come la usa una persona: scopro l'azione sulla riga,
 * premo Elimina, e solo la conferma cancella davvero.
 *
 * Il **gesto** di swipe non è simulabile qui (gesture-handler ascolta eventi puntatore reali):
 * quello che si prova è il resto della catena, cioè l'azione scoperta, la conferma con il
 * titolo giusto, e il fatto che annullare non cancelli nulla. Come importScreen, sta in
 * `src/test/` perché expo-router trasformerebbe in rotta qualsiasi file dentro `src/app/`.
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, screen } from '@testing-library/react-native';

import { ConfirmSheet, SwipeableRow, Text } from '@/ui/components';
import { renderWithProviders } from './renderWithProviders';

// Il foglio nativo di gorhom non monta in ambiente Node: qui conta il contenuto, non il
// pannello che lo ospita.
jest.mock('@/ui/components/Sheet', () => {
  const { View } = require('react-native');
  return {
    Sheet: ({ open, children }: { open: boolean; children: unknown }) =>
      open ? <View>{children}</View> : null,
  };
});

const onAction = jest.fn();
const onConfirm = jest.fn();
const onCancel = jest.fn();

beforeEach(() => {
  onAction.mockClear();
  onConfirm.mockClear();
  onCancel.mockClear();
});

describe('eliminazione di un itinerario', () => {
  it("espone l'azione sulla riga con un nome leggibile", async () => {
    await renderWithProviders(
      <SwipeableRow actionLabel="Elimina" onAction={onAction}>
        <Text>sicilia</Text>
      </SwipeableRow>
    );

    const azione = screen.getByLabelText('Elimina');
    await fireEvent.press(azione);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('la riga resta premibile: lo swipe scopre, non cancella', async () => {
    await renderWithProviders(
      <SwipeableRow actionLabel="Elimina" onAction={onAction}>
        <Text>sicilia</Text>
      </SwipeableRow>
    );

    // Il contenuto è ancora lì e visibile: nessuna eliminazione ottimistica.
    expect(screen.getByText('sicilia')).toBeTruthy();
    expect(onAction).not.toHaveBeenCalled();
  });

  it('la conferma nomina l\'itinerario e cancella solo se confermata', async () => {
    await renderWithProviders(
      <ConfirmSheet
        open
        title="Eliminare «sicilia»?"
        body="Spariscono anche i giorni, le tappe e i prezzi che hai segnalato. Non si può annullare."
        confirmLabel="Elimina itinerario"
        destructive
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    expect(screen.getByText('Eliminare «sicilia»?')).toBeTruthy();

    await fireEvent.press(screen.getByText('Annulla'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByText('Elimina itinerario'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
