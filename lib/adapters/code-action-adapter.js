// @flow

import type LinterPushV2Adapter from './linter-push-v2-adapter';

import invariant from 'assert';
import {LanguageClientConnection, type ServerCapabilities} from '../languageclient';
import Convert from '../convert';

export default class CodeActionAdapter {
  // Returns a {Boolean} indicating this adapter can adapt the server based on the
  // given serverCapabilities.
  static canAdapt(serverCapabilities: ServerCapabilities): boolean {
    return serverCapabilities.codeActionProvider === true;
  }

  // Public: Retrieves code actions for a given editor, range, and context (diagnostics).
  // Throws an error if codeActionProvider is not a registered capability.
  //
  // * `connection` A {LanguageClientConnection} to the language server that provides highlights.
  // * `serverCapabilities` The {ServerCapabilities} of the language server that will be used.
  // * `editor` The Atom {TextEditor} containing the diagnostics.
  // * `range` The Atom {Range} to fetch code actions for.
  // * `diagnostics` An {Array<atomIde$Diagnostic>} to fetch code actions for.
  //                 This is typically a list of diagnostics intersecting `range`.
  //
  // Returns a {Promise} of an {Array} of {atomIde$CodeAction}s to display.
  static async getCodeActions(
    connection: LanguageClientConnection,
    serverCapabilities: ServerCapabilities,
    linterAdapter: ?LinterPushV2Adapter,
    editor: atom$TextEditor,
    range: atom$Range,
    diagnostics: Array<atomIde$Diagnostic>,
  ): Promise<Array<atomIde$CodeAction>> {
    if (linterAdapter == null) {
      return [];
    }
    invariant(serverCapabilities.codeActionProvider, 'Must have the textDocument/codeAction capability');
    const commands = await connection.codeAction({
      textDocument: Convert.editorToTextDocumentIdentifier(editor),
      range: Convert.atomRangeToLSRange(range),
      context: {
        diagnostics: diagnostics.map(diagnostic => {
          // Retrieve the stored diagnostic code if it exists.
          // Until the Linter API provides a place to store the code,
          // there's no real way for the code actions API to give it back to us.
          const converted = Convert.atomIdeDiagnosticToLSDiagnostic(diagnostic);
          if (diagnostic.range != null && diagnostic.text != null) {
            const code = linterAdapter.getDiagnosticCode(editor, diagnostic.range, diagnostic.text);
            if (code != null) {
              converted.code = code;
            }
          }
          return converted;
        }),
      },
    });
    return commands.map(command => ({
      async apply() {
        await connection.executeCommand({
          command: command.command,
          arguments: command.arguments,
        });
      },
      getTitle() {
        return Promise.resolve(command.title);
      },
      dispose() {},
    }));
  }
}
