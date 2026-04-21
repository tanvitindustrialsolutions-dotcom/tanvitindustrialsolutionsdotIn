/**
 * Shared client business rules (main app + register).
 * Rule 1: If another client under the same company already has this GSTIN (meaningful length), block.
 * Rule 2: If client name matches another but GSTIN differs (mismatch / one missing), warn — caller may confirm and proceed.
 */
(function (global) {
  const MIN_GST_LEN = 10;

  function normGstin(s) {
    return String(s || '').trim().toUpperCase().replace(/\s/g, '');
  }

  function normName(s) {
    return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function gstMeaningful(g) {
    return normGstin(g).length >= MIN_GST_LEN;
  }

  /**
   * @param {Array<{id?:string,name?:string,gstin?:string}>} clientsList same company
   * @param {{name:string,gstin?:string}} candidate
   * @param {{excludeId?:string}} [options] client id to skip (editing that row)
   * @returns {{block?:string,warn?:string}}
   */
  function check(clientsList, candidate, options) {
    const excludeId = options && options.excludeId ? String(options.excludeId) : '';
    const cg = normGstin(candidate.gstin);
    const nm = normName(candidate.name);
    const list = Array.isArray(clientsList) ? clientsList : [];

    for (const c of list) {
      if (excludeId && String(c.id || '') === excludeId) continue;
      const og = normGstin(c.gstin);
      if (gstMeaningful(cg) && gstMeaningful(og) && cg === og) {
        return {
          block: `This GSTIN is already saved for client "${(c.name || '').trim() || '—'}". You cannot add or save another client with the same GST number.`,
        };
      }
    }

    for (const c of list) {
      if (excludeId && String(c.id || '') === excludeId) continue;
      const og = normGstin(c.gstin);
      const on = normName(c.name);
      if (!nm || !on || on !== nm) continue;

      const cHas = gstMeaningful(og);
      const nHas = gstMeaningful(cg);

      if (nHas && cHas && cg !== og) {
        return {
          warn: `A client named "${(c.name || '').trim()}" already exists with GSTIN ${og}. You entered a different GSTIN (${cg}). If this is the same organization, update that client instead of creating a new one.`,
        };
      }
      if (nHas && !cHas) {
        return {
          warn: `A client named "${(c.name || '').trim()}" exists without a full GSTIN on file. You entered GSTIN ${cg}. Confirm this is not the same party before continuing.`,
        };
      }
      if (!nHas && cHas) {
        return {
          warn: `A client named "${(c.name || '').trim()}" already exists with GSTIN ${og}. You did not enter a full GSTIN. Confirm you are not creating a duplicate.`,
        };
      }
      if (!nHas && !cHas) {
        return {
          warn: `Another client named "${(c.name || '').trim()}" exists with no GSTIN on file. Confirm this is a different client before continuing.`,
        };
      }
    }

    return {};
  }

  global.QGClientRules = { normGstin, normName, gstMeaningful, check, MIN_GST_LEN };
})(typeof window !== 'undefined' ? window : this);
