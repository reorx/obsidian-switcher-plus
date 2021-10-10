import {
  App,
  CachedMetadata,
  fuzzySearch,
  PreparedQuery,
  prepareQuery,
  TFile,
  WorkspaceLeaf,
} from 'obsidian';
import { HeadingsHandler } from 'src/Handlers';
import { SwitcherPlusSettings } from 'src/settings';
import {
  getCachedMetadata,
  headingsTrigger,
  makeFuzzyMatch,
  makeHeading,
  makeLoc,
  makePreparedQuery,
} from '@fixtures';
import { InputInfo } from 'src/switcherPlus';
import {
  HeadingSuggestion,
  FileSuggestion,
  Mode,
  AliasSuggestion,
  UnresolvedSuggestion,
} from 'src/types';
import {
  isAliasSuggestion,
  isFileSuggestion,
  isHeadingSuggestion,
  isUnresolvedSuggestion,
} from 'src/utils';

describe('headingsHandler', () => {
  let settings: SwitcherPlusSettings;
  let app: App;
  let sut: HeadingsHandler;

  beforeAll(() => {
    app = new App();
    settings = new SwitcherPlusSettings(null);
    jest.spyOn(settings, 'headingsListCommand', 'get').mockReturnValue(headingsTrigger);
    sut = new HeadingsHandler(app, settings);
  });

  describe('commandString', () => {
    it('should return headingsListCommand trigger', () => {
      expect(sut.commandString).toBe(headingsTrigger);
    });
  });

  describe('validateCommand', () => {
    it('should validate parsed input for headings mode', () => {
      const filterText = 'foo';
      const inputText = `${headingsTrigger}${filterText}`;
      const startIndex = headingsTrigger.length;
      const inputInfo = new InputInfo(inputText);

      sut.validateCommand(inputInfo, startIndex, filterText, null, null);
      expect(inputInfo.mode).toBe(Mode.HeadingsList);

      const headingsCmd = inputInfo.parsedCommand();
      expect(headingsCmd.parsedInput).toBe(filterText);
      expect(headingsCmd.isValidated).toBe(true);
    });
  });

  describe('getSuggestions', () => {
    const mockPrepareQuery = prepareQuery as jest.MockedFunction<typeof prepareQuery>;
    const mockFuzzySearch = fuzzySearch as jest.MockedFunction<typeof fuzzySearch>;
    let getLastOpenFilesSpy: jest.SpyInstance;
    let getAbstractFileByPathSpy: jest.SpyInstance;
    let getFilesSpy: jest.SpyInstance;
    let isExtensionRegisteredSpy: jest.SpyInstance;
    let getFileCacheSpy: jest.SpyInstance;
    let builtInSystemOptionsSpy: jest.SpyInstance;

    beforeAll(() => {
      getLastOpenFilesSpy = jest.spyOn(app.workspace, 'getLastOpenFiles');
      getAbstractFileByPathSpy = jest.spyOn(app.vault, 'getAbstractFileByPath');
      getFilesSpy = jest.spyOn(app.vault, 'getFiles');
      getFileCacheSpy = jest.spyOn(app.metadataCache, 'getFileCache');
      isExtensionRegisteredSpy = jest
        .spyOn(app.viewRegistry, 'isExtensionRegistered')
        .mockReturnValue(true);
      builtInSystemOptionsSpy = jest
        .spyOn(settings, 'builtInSystemOptions', 'get')
        .mockReturnValue({
          showAllFileTypes: true,
          showAttachments: true,
          showExistingOnly: false,
        });
    });

    test('with falsy input, it should return an empty array', () => {
      const results = sut.getSuggestions(null);

      expect(results).not.toBeNull();
      expect(results).toBeInstanceOf(Array);
      expect(results).toHaveLength(0);
    });

    test('without any filter text, it should return most recent opened file suggestions for headings mode', () => {
      const fileData: Record<string, TFile> = {};
      let file = new TFile();
      fileData[file.path] = file;

      file = new TFile();
      fileData[file.path] = file;

      file = new TFile();
      fileData[file.path] = file;

      const fileDataKeys = Object.keys(fileData);
      getLastOpenFilesSpy.mockReturnValueOnce(fileDataKeys);
      getAbstractFileByPathSpy.mockImplementation((path: string) => fileData[path]);
      getFileCacheSpy.mockImplementation((f: TFile) => {
        return f === file ? {} : getCachedMetadata();
      });

      const inputInfo = new InputInfo(headingsTrigger);
      const results = sut.getSuggestions(inputInfo);

      expect(results).toHaveLength(fileDataKeys.length);

      const expectedFiles = new Set(Object.values(fileData));
      const headingSuggestions = results.filter((sugg) =>
        isHeadingSuggestion(sugg),
      ) as HeadingSuggestion[];
      expect(headingSuggestions).toHaveLength(2);
      expect(headingSuggestions.every((sugg) => expectedFiles.has(sugg.file))).toBe(true);

      const fileSuggestions = results.filter((sugg) =>
        isFileSuggestion(sugg),
      ) as FileSuggestion[];
      expect(fileSuggestions).toHaveLength(1);
      expect(fileSuggestions.every((sugg) => expectedFiles.has(sugg.file))).toBe(true);

      expect(getLastOpenFilesSpy).toHaveBeenCalled();
      expect(getAbstractFileByPathSpy).toHaveBeenCalled();
      expect(getFileCacheSpy).toHaveBeenCalled();
      expect(builtInSystemOptionsSpy).toHaveBeenCalled();
      expect(isExtensionRegisteredSpy).toHaveBeenCalled();

      getLastOpenFilesSpy.mockRestore();
      getAbstractFileByPathSpy.mockRestore();
      getFileCacheSpy.mockRestore();
    });

    test('with filter search term, it should return matching suggestions for all headings', () => {
      const expected = new TFile();
      const files = [new TFile(), new TFile(), expected];
      const h1 = makeHeading('foo heading H1', 1, makeLoc(1));
      const h2 = makeHeading('foo heading H2', 2, makeLoc(2));
      const filterText = 'foo';

      mockPrepareQuery.mockReturnValue(makePreparedQuery(filterText));
      getFilesSpy.mockReturnValue(files);

      getFileCacheSpy.mockImplementation((f: TFile) => {
        return f === expected ? { headings: [h1, h2] } : getCachedMetadata();
      });

      mockFuzzySearch.mockImplementation((_q: PreparedQuery, text: string) => {
        const match = makeFuzzyMatch([[0, 5]], -0.0115);
        return text.startsWith(filterText) ? match : null;
      });

      const inputInfo = new InputInfo(`${headingsTrigger}${filterText}`);
      sut.validateCommand(inputInfo, 0, filterText, null, null);

      const results = sut.getSuggestions(inputInfo);
      expect(results).toHaveLength(2);

      expect(results.every((r) => isHeadingSuggestion(r))).toBe(true);
      expect(
        results.every((r: HeadingSuggestion) => r.item === h1 || r.item === h2),
      ).toBe(true);

      let result = results[0];
      result = result as HeadingSuggestion;
      expect(result.file).toBe(expected);

      expect(mockFuzzySearch).toHaveBeenCalled();
      expect(mockPrepareQuery).toHaveBeenCalled();
      expect(getFilesSpy).toHaveBeenCalled();
      expect(getFileCacheSpy).toHaveBeenCalled();
      expect(builtInSystemOptionsSpy).toHaveBeenCalled();
      expect(isExtensionRegisteredSpy).toHaveBeenCalled();

      getFilesSpy.mockRestore();
      getFileCacheSpy.mockRestore();
      mockFuzzySearch.mockRestore();
      mockPrepareQuery.mockRestore();
    });

    test('with filter search term, and searchAllHeadings set to false, it should return only matching suggestions using first H1 in file', () => {
      const expected = new TFile();
      const files = [new TFile(), new TFile(), expected];
      const expectedHeading = makeHeading('foo heading H1', 1, makeLoc(1));
      const heading2 = makeHeading('foo heading H1', 1, makeLoc(2));
      const filterText = 'foo';

      const searchAllHeadingsSpy = jest
        .spyOn(settings, 'searchAllHeadings', 'get')
        .mockReturnValue(false);

      mockPrepareQuery.mockReturnValue(makePreparedQuery(filterText));
      getFilesSpy.mockReturnValue(files);

      getFileCacheSpy.mockImplementation((f: TFile) => {
        return f === expected
          ? { headings: [expectedHeading, heading2] }
          : getCachedMetadata();
      });

      mockFuzzySearch.mockImplementation((_q: PreparedQuery, text: string) => {
        const match = makeFuzzyMatch([[0, 5]], -0.0115);
        return text.startsWith(filterText) ? match : null;
      });

      const inputInfo = new InputInfo(`${headingsTrigger}${filterText}`);
      sut.validateCommand(inputInfo, 0, filterText, null, null);

      const results = sut.getSuggestions(inputInfo);
      expect(results).toHaveLength(1);

      let result = results[0];
      expect(isHeadingSuggestion(result)).toBe(true);

      result = result as HeadingSuggestion;
      expect(result.file).toBe(expected);
      expect(result.item).toBe(expectedHeading);

      expect(mockFuzzySearch).toHaveBeenCalled();
      expect(mockPrepareQuery).toHaveBeenCalled();
      expect(getFilesSpy).toHaveBeenCalled();
      expect(getFileCacheSpy).toHaveBeenCalled();
      expect(builtInSystemOptionsSpy).toHaveBeenCalled();
      expect(isExtensionRegisteredSpy).toHaveBeenCalled();

      getFilesSpy.mockRestore();
      getFileCacheSpy.mockRestore();
      mockFuzzySearch.mockRestore();
      mockPrepareQuery.mockRestore();
      searchAllHeadingsSpy.mockRestore();
    });

    test("with filter search term, it should return only matching suggestions using file name (leaf segment) when H1 doesn't exist", () => {
      const expected = new TFile();
      expected.path = 'path/to/bar/foo filename.md'; // only path matters for this test

      const files = [new TFile(), new TFile(), expected];
      const filterText = 'foo';

      mockPrepareQuery.mockReturnValue(makePreparedQuery(filterText));
      getFilesSpy.mockReturnValue(files);

      getFileCacheSpy.mockImplementation((f: TFile) => {
        // don't return any heading metadata for expected
        return f === expected ? {} : getCachedMetadata();
      });

      mockFuzzySearch.mockImplementation((_q: PreparedQuery, text: string) => {
        const match = makeFuzzyMatch([[0, 5]], -0.0115);
        return text.startsWith(filterText) ? match : null;
      });

      const inputInfo = new InputInfo(`${headingsTrigger}${filterText}`);
      sut.validateCommand(inputInfo, 0, filterText, null, null);

      const results = sut.getSuggestions(inputInfo);
      expect(results).toHaveLength(1);

      const result = results[0];
      expect(isFileSuggestion(result)).toBe(true);
      expect((result as FileSuggestion).file).toBe(expected);

      expect(mockFuzzySearch).toHaveBeenCalled();
      expect(mockPrepareQuery).toHaveBeenCalled();
      expect(getFilesSpy).toHaveBeenCalled();
      expect(getFileCacheSpy).toHaveBeenCalled();
      expect(builtInSystemOptionsSpy).toHaveBeenCalled();
      expect(isExtensionRegisteredSpy).toHaveBeenCalled();

      getFilesSpy.mockRestore();
      getFileCacheSpy.mockRestore();
      mockFuzzySearch.mockRestore();
      mockPrepareQuery.mockRestore();
    });

    test('with filter search term, it should fallback match against file path when there is no H1 and no match against the filename (leaf segment)', () => {
      const expected = new TFile();
      expected.path = 'foo/path/to/filename.md'; // only path matters for this test

      const files = [new TFile(), new TFile(), expected];
      const filterText = 'foo';

      mockPrepareQuery.mockReturnValue(makePreparedQuery(filterText));
      getFilesSpy.mockReturnValue(files);
      getFileCacheSpy.mockReturnValue({});

      mockFuzzySearch.mockImplementation((_q: PreparedQuery, text: string) => {
        const match = makeFuzzyMatch([[0, 5]], -0.0115);
        return text.startsWith(filterText) ? match : null;
      });

      const inputInfo = new InputInfo(`${headingsTrigger}${filterText}`);
      sut.validateCommand(inputInfo, 0, filterText, null, null);

      const results = sut.getSuggestions(inputInfo);
      expect(results).toHaveLength(1);

      const result = results[0];
      expect(isFileSuggestion(result)).toBe(true);
      expect((result as FileSuggestion).file).toBe(expected);

      expect(mockFuzzySearch).toHaveBeenCalled();
      expect(mockPrepareQuery).toHaveBeenCalled();
      expect(getFilesSpy).toHaveBeenCalled();
      expect(getFileCacheSpy).toHaveBeenCalled();
      expect(builtInSystemOptionsSpy).toHaveBeenCalled();
      expect(isExtensionRegisteredSpy).toHaveBeenCalled();

      getFilesSpy.mockRestore();
      getFileCacheSpy.mockRestore();
      mockFuzzySearch.mockRestore();
      mockPrepareQuery.mockRestore();
    });

    test('with filter search term and shouldShowAlias set to true, it should match against aliases', () => {
      const expected = new TFile();
      const files = [new TFile(), new TFile(), expected];
      const filterText = 'foo';

      mockPrepareQuery.mockReturnValue(makePreparedQuery(filterText));
      getFilesSpy.mockReturnValue(files);
      settings.shouldShowAlias = true;

      const fm: CachedMetadata = {
        frontmatter: {
          aliases: ['bar', 'foo'],
          position: null,
        },
      };

      getFileCacheSpy.mockImplementation((f: TFile) => {
        return f === expected ? fm : getCachedMetadata();
      });

      mockFuzzySearch.mockImplementation((_q: PreparedQuery, text: string) => {
        const match = makeFuzzyMatch([[0, 5]], -0.0115);
        return text.startsWith(filterText) ? match : null;
      });

      const inputInfo = new InputInfo(`${headingsTrigger}${filterText}`);
      sut.validateCommand(inputInfo, 0, filterText, null, null);

      const results = sut.getSuggestions(inputInfo);
      expect(results).toHaveLength(1);

      const result = results[0];
      expect(isAliasSuggestion(result)).toBe(true);
      expect((result as AliasSuggestion).file).toBe(expected);

      expect(mockFuzzySearch).toHaveBeenCalled();
      expect(mockPrepareQuery).toHaveBeenCalled();
      expect(getFilesSpy).toHaveBeenCalled();
      expect(getFileCacheSpy).toHaveBeenCalled();
      expect(builtInSystemOptionsSpy).toHaveBeenCalled();
      expect(isExtensionRegisteredSpy).toHaveBeenCalled();

      settings.shouldShowAlias = false;
      getFilesSpy.mockRestore();
      getFileCacheSpy.mockRestore();
      mockFuzzySearch.mockRestore();
      mockPrepareQuery.mockRestore();
    });

    test('with filter search term and showExistingOnly set to false, it should match against unresolved linktext', () => {
      const expected = new TFile();
      const files = [new TFile(), new TFile(), expected];
      const filterText = 'foo';

      mockPrepareQuery.mockReturnValue(makePreparedQuery(filterText));
      getFilesSpy.mockReturnValue(files);

      app.metadataCache.unresolvedLinks[expected.path] = {
        'foo link noexist': 1,
        'another link': 1,
      };

      mockFuzzySearch.mockImplementation((_q: PreparedQuery, text: string) => {
        const match = makeFuzzyMatch([[0, 5]], -0.0115);
        return text.startsWith(filterText) ? match : null;
      });

      const inputInfo = new InputInfo(`${headingsTrigger}${filterText}`);
      sut.validateCommand(inputInfo, 0, filterText, null, null);

      const results = sut.getSuggestions(inputInfo);
      expect(results).toHaveLength(1);

      const result = results[0];
      expect(isUnresolvedSuggestion(result)).toBe(true);
      expect((result as UnresolvedSuggestion).linktext).toBe('foo link noexist');

      expect(mockFuzzySearch).toHaveBeenCalled();
      expect(mockPrepareQuery).toHaveBeenCalled();
      expect(getFilesSpy).toHaveBeenCalled();
      expect(builtInSystemOptionsSpy).toHaveBeenCalled();
      expect(isExtensionRegisteredSpy).toHaveBeenCalled();

      getFilesSpy.mockRestore();
      mockFuzzySearch.mockRestore();
      mockPrepareQuery.mockRestore();
      app.metadataCache.unresolvedLinks = {};
    });

    test('with filter search term and strictHeadingsOnly enabled, it should not match against file name, or path when there is no H1', () => {
      const expected = new TFile();
      expected.path = 'foo/path/to/filename.md'; // only path matters for this test

      const files = [new TFile(), new TFile(), expected];
      const filterText = 'foo';

      mockPrepareQuery.mockReturnValue(makePreparedQuery(filterText));
      getFilesSpy.mockReturnValue(files);
      getFileCacheSpy.mockReturnValue({});

      const strictHeadingsOnlySpy = jest
        .spyOn(settings, 'strictHeadingsOnly', 'get')
        .mockReturnValue(true);

      const inputInfo = new InputInfo(`${headingsTrigger}${filterText}`);
      sut.validateCommand(inputInfo, 0, filterText, null, null);

      const results = sut.getSuggestions(inputInfo);
      expect(results).toHaveLength(0);

      expect(mockPrepareQuery).toHaveBeenCalled();
      expect(getFilesSpy).toHaveBeenCalled();
      expect(getFileCacheSpy).toHaveBeenCalled();
      expect(builtInSystemOptionsSpy).toHaveBeenCalled();
      expect(isExtensionRegisteredSpy).toHaveBeenCalled();
      expect(strictHeadingsOnlySpy).toHaveBeenCalled();

      getFilesSpy.mockRestore();
      getFileCacheSpy.mockRestore();
      mockPrepareQuery.mockRestore();
      strictHeadingsOnlySpy.mockRestore();
    });
  });

  describe('renderSuggestion', () => {
    it('should not throw an error with a null suggestion', () => {
      expect(() => sut.renderSuggestion(null, null)).not.toThrow();
    });

    test.todo('with HeadingCache, it should render a suggestion with match offsets');
  });

  describe('onChooseSuggestion', () => {
    it('should open the file associated with the suggestion', () => {
      const workspaceLeaf = new WorkspaceLeaf();
      const file = new TFile();
      const sugg: HeadingSuggestion = {
        item: makeHeading('foo heading', 1),
        file,
        match: null,
        type: 'heading',
      };

      const getLeafSpy = jest
        .spyOn(app.workspace, 'getLeaf')
        .mockImplementation((_newLeaf) => workspaceLeaf);
      const openFileSpy = jest.spyOn(workspaceLeaf, 'openFile').mockResolvedValue();

      sut.onChooseSuggestion(sugg, null);

      expect(getLeafSpy).toHaveBeenCalled();
      expect(openFileSpy).toHaveBeenCalled();

      getLeafSpy.mockRestore();
      openFileSpy.mockRestore();
    });

    it('should not throw an error with a null suggestion', () => {
      expect(() => sut.onChooseSuggestion(null, null)).not.toThrow();
    });

    it('should catch and log errors to the console', () => {
      const workspaceLeaf = new WorkspaceLeaf();
      const sugg: HeadingSuggestion = {
        item: makeHeading('foo heading', 1),
        file: new TFile(),
        match: null,
        type: 'heading',
      };

      const getLeafSpy = jest
        .spyOn(app.workspace, 'getLeaf')
        .mockImplementation((_newLeaf) => workspaceLeaf);

      // Promise used to trigger the error condition
      const openFilePromise = Promise.resolve();
      const openFileSpy = jest
        .spyOn(workspaceLeaf, 'openFile')
        .mockImplementation((_f, _o) => {
          // throw to simulate openFile() failing. This happens first
          return openFilePromise.then(() => {
            throw new Error('openFile() unit test error');
          });
        });

      let consoleLogPromiseResolveFn: (value: void | PromiseLike<void>) => void;

      // Promise used to track the call to console.log
      const consoleLogPromise = new Promise<void>((resolve, _reject) => {
        consoleLogPromiseResolveFn = resolve;
      });

      const consoleLogSpy = jest
        .spyOn(console, 'log')
        .mockImplementation((message: string) => {
          if (message.startsWith('Switcher++: unable to open file')) {
            // resolve the consoleLogPromise. This happens second and will allow
            // allPromises to resolve itself
            consoleLogPromiseResolveFn();
          }
        });

      // wait for the other promises to resolve before this promise can resolve
      const allPromises = Promise.all([openFilePromise, consoleLogPromise]);

      // internally calls openFile(), which the spy will cause to fail, and then will call console.log
      sut.onChooseSuggestion(sugg, null);

      // when all the promises are resolved check expectations and clean up
      return allPromises.finally(() => {
        expect(getLeafSpy).toHaveBeenCalled();
        expect(openFileSpy).toHaveBeenCalled();
        expect(consoleLogSpy).toHaveBeenCalled();

        getLeafSpy.mockRestore();
        openFileSpy.mockRestore();
        consoleLogSpy.mockRestore();
      });
    });
  });
});
