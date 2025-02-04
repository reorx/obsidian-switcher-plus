import { mock, mockReset } from 'jest-mock-extended';
import { Chooser, Hotkey, KeymapContext, KeymapEventListener, Scope } from 'obsidian';
import { Keymap } from 'src/switcherPlus';
import { AnySuggestion, Mode } from 'src/types';

describe('keymap', () => {
  const mockScope = mock<Scope>();
  const mockChooser = mock<Chooser<AnySuggestion>>();
  const mockModalContainer = mock<HTMLElement>();

  describe('isOpen property', () => {
    let sut: Keymap;

    beforeAll(() => {
      sut = new Keymap(mockScope, mockChooser, mockModalContainer);
    });

    it('should save the value provided for isOpen', () => {
      sut.isOpen = true;
      const result = sut.isOpen;
      expect(result).toBe(true);
    });
  });

  describe('Next/Previous keyboard navigation', () => {
    beforeEach(() => {
      mockReset(mockScope);
      mockReset(mockChooser);
    });

    it('should register ctrl-n/p for navigating forward/backward', () => {
      new Keymap(mockScope, null, null);

      expect(mockScope.register).toHaveBeenCalledWith(
        expect.arrayContaining(['Ctrl']),
        'n',
        expect.anything(),
      );

      expect(mockScope.register).toHaveBeenCalledWith(
        expect.arrayContaining(['Ctrl']),
        'p',
        expect.anything(),
      );
    });

    test('when Open, it should change the selected item with ctrl-n/p keyboard navigation', () => {
      const selectedIndex = 1;
      const navPairs: Record<string, KeymapEventListener> = {
        n: null,
        p: null,
      };

      mockScope.register.mockImplementation((_m, key, func) => {
        if (key in navPairs) {
          navPairs[key] = func;
        }

        return null;
      });

      mockChooser.selectedItem = selectedIndex;

      const sut = new Keymap(mockScope, mockChooser, null);
      sut.isOpen = true; // here

      navPairs.n(mock<KeyboardEvent>(), mock<KeymapContext>({ key: 'n' }));
      navPairs.p(mock<KeyboardEvent>(), mock<KeymapContext>({ key: 'p' }));

      expect(mockChooser.setSelectedItem).toHaveBeenCalledWith(selectedIndex + 1, true);
      expect(mockChooser.setSelectedItem).toHaveBeenCalledWith(selectedIndex - 1, true);
    });

    test('when not Open, it should not change the selected item with ctrl-n/p keyboard navigation', () => {
      const selectedIndex = 1;
      const navPairs: Record<string, KeymapEventListener> = {
        n: null,
        p: null,
      };

      mockScope.register.mockImplementation((_m, key, func) => {
        if (key in navPairs) {
          navPairs[key] = func;
        }

        return null;
      });

      mockChooser.selectedItem = selectedIndex;

      const sut = new Keymap(mockScope, mockChooser, null);
      sut.isOpen = false; // here

      navPairs.n(mock<KeyboardEvent>(), mock<KeymapContext>({ key: 'n' }));
      navPairs.p(mock<KeyboardEvent>(), mock<KeymapContext>({ key: 'p' }));

      expect(mockChooser.setSelectedItem).not.toHaveBeenCalled();
      expect(mockChooser.setSelectedItem).not.toHaveBeenCalled();
    });
  });

  describe('updateKeymapForMode', () => {
    const selector = '.prompt-instructions';
    const mockInstructionsEl = mock<HTMLElement>();
    const mockMetaEnter = mock<Hotkey>({
      modifiers: ['Meta'],
      key: 'Enter',
    });
    const mockShiftEnter = mock<Hotkey>({
      modifiers: ['Shift'],
      key: 'Enter',
    });

    beforeEach(() => {
      mockReset(mockScope);
      mockReset(mockModalContainer);
    });

    it('should do nothing if the helper text (prompt instructions) element is not found', () => {
      const mockQuerySelector =
        mockModalContainer.querySelector.mockReturnValueOnce(null);

      const sut = new Keymap(mockScope, mockChooser, mockModalContainer);

      expect(() => sut.updateKeymapForMode(Mode.Standard)).not.toThrow();
      expect(mockQuerySelector).toHaveBeenCalledWith(selector);
    });

    it('should hide the helper text (prompt instructions) in non-standard modes', () => {
      const mockQuerySelector =
        mockModalContainer.querySelector.mockReturnValueOnce(mockInstructionsEl);

      const sut = new Keymap(mockScope, mockChooser, mockModalContainer);

      sut.updateKeymapForMode(Mode.EditorList);

      expect(mockQuerySelector).toHaveBeenCalledWith(selector);
      expect(mockInstructionsEl.style.display).toBe('none');
    });

    it('should show the helper text (prompt instructions) in standard modes', () => {
      const mockQuerySelector =
        mockModalContainer.querySelector.mockReturnValueOnce(mockInstructionsEl);

      const sut = new Keymap(mockScope, mockChooser, mockModalContainer);

      sut.updateKeymapForMode(Mode.Standard);

      expect(mockQuerySelector).toHaveBeenCalledWith(selector);
      expect(mockInstructionsEl.style.display).toBe('');
    });

    it('should not remove Enter hotkey without shift/meta modifier', () => {
      const mockEnter = mock<Hotkey>({
        modifiers: [],
        key: 'Enter',
      });

      mockScope.keys = [mockEnter];
      const sut = new Keymap(mockScope, null, mockModalContainer);

      sut.updateKeymapForMode(Mode.EditorList);

      expect(mockScope.keys).toContain(mockEnter);
    });

    it('should remove the shift/meta-enter hotkey in non-standard modes', () => {
      mockScope.keys = [mockMetaEnter, mockShiftEnter];
      const sut = new Keymap(mockScope, null, mockModalContainer);

      sut.updateKeymapForMode(Mode.EditorList);

      expect(mockScope.keys).toHaveLength(0);
    });

    it('should restore the shift/meta hotkey in standard mode', () => {
      mockScope.keys = [mockMetaEnter, mockShiftEnter];
      const sut = new Keymap(mockScope, null, mockModalContainer);
      sut.updateKeymapForMode(Mode.EditorList);
      // should first remove in non-standard mode
      expect(mockScope.keys).toHaveLength(0);

      sut.updateKeymapForMode(Mode.Standard);
      expect(mockScope.keys).toContain(mockMetaEnter);
      expect(mockScope.keys).toContain(mockShiftEnter);
    });
  });
});
