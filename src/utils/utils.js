
import update from 'immutability-helper';
import {range} from 'range';

function bisect (a, x) {
  let lo = 0, hi = a.length, mid;
  while (lo < hi) {
    mid = (lo + hi) / 2 | 0;
    if (x < a[mid]) {
      hi = mid;
    } else {
      lo = mid + 1;
    }
  }
  return lo;
}

export function selectTaskData (state) {
  const {taskData: {alphabet, cipherText, hints, answerKeys}} = state;
  return {alphabet, cipherText, hints, answerKeys};
}

export function changeSelection (values, value, selected) {
  const index = bisect(values, value);
  if (selected) {
    return values[index - 1] === value ? {} : {$splice: [[index, 0, value]]};
  } else {
    return values[index - 1] !== value ? {} : {$splice: [[index - 1, 1]]};
  }
}

export function sortedArrayHasElement (a, x) {
  const i = bisect(a, x) - 1;
  return a[i] === x;
}


export function updateGridGeometry (grid) {
  const {width, height, cellWidth, cellHeight, scrollTop, nbCells} = grid;
  const scrollBarWidth = 20;
  const pageColumns = Math.max(40, Math.floor((width - scrollBarWidth) / cellWidth));
  const pageRows = Math.max(8, Math.ceil(height / cellHeight));
  const bottom = Math.ceil(nbCells / pageColumns) * cellHeight - 1;
  const maxTop = Math.max(0, bottom + 1 - pageRows * cellHeight);
  return {...grid, pageColumns, pageRows, scrollTop: Math.min(maxTop, scrollTop), bottom, maxTop};
}

export function updateGridVisibleRows (grid, options) {
  options = options || {};
  const {nbCells, cellHeight, pageColumns, pageRows, cells, scrollTop} = grid;
  if (typeof scrollTop !== 'number') {
    return grid;
  }
  const firstRow = Math.floor(scrollTop / cellHeight);
  const lastRow = Math.min(firstRow + pageRows - 1, Math.ceil(nbCells / pageColumns) - 1);
  const rows = [];
  const getCell = options.getCell || (cells ? (index => ({cell: cells[index]})) : (_index => null));
  for (let rowIndex = firstRow; rowIndex <= lastRow; rowIndex += 1) {
    const rowStartPos = rowIndex * pageColumns;
    const rowCells = [];
    for (let colIndex = 0; colIndex < pageColumns; colIndex += 1) {
      rowCells.push({index: colIndex, ...getCell(rowStartPos + colIndex)});
    }
    rows.push({index: rowIndex, columns: rowCells});
  }
  return {...grid, visible: {rows}};
}

export function updateGridVisibleColumns (grid, options) {
  options = options || {};
  const {cellHeight, pageColumns, pageRows, cells, scrollTop, selectedColumns} = grid;
  if (typeof scrollTop !== 'number') {
    return grid;
  }
  const firstRow = Math.floor(scrollTop / cellHeight);
  const lastRow = firstRow + pageRows - 1;
  const columns = [];
  const getCell = options.getCell || (cells ? (index => ({cell: cells[index]})) : (_index => null));
  for (let colIndex = 0; colIndex < pageColumns; colIndex += 1) {
    const colCells = [];
    for (let rowIndex = firstRow; rowIndex <= lastRow; rowIndex += 1) {
      colCells.push({index: rowIndex, ...getCell(rowIndex * pageColumns + colIndex)});
    }
    const selected = selectedColumns && sortedArrayHasElement(selectedColumns, colIndex);
    columns.push({index: colIndex, selected, rows: colCells});
  }
  return {...grid, visible: {columns}};
}

export function updateGridVisibleArea (grid, options) {
  /* TODO: build a cache key, store it in the grid, use it to skip computation when unchanged */
  if (grid.mode === 'rows') {
    return updateGridVisibleRows(grid, options);
  }
  if (grid.mode === 'columns') {
    return updateGridVisibleColumns(grid, options);
  }
  return grid;
}

/* SUBSTITUTION functions */


export function makeDecryption (alphabet) {
  const size = alphabet.length;
  const cells = alphabet.split('').map(function (c, rank) {
    return {rank, rotating: c, editable: null, locked: false, conflict: false};
  });
  const nullPerm = new Array(size).fill(-1);
  return {alphabet, size, cells, forward: nullPerm, backward: nullPerm};
}

export function dumpDecryption (alphabet, decryption) {
  return decryption.cells.map(({editable, locked}) =>
      [alphabet.indexOf(editable), locked ? 1 : 0]);
}

export function loadDecryption (alphabet, answerKeys, hints, cells=[]) {
    const $cells = [];
    cells.forEach((cell, cellIndex) => {
      /* Locking information is not included in the answer. */
      if (typeof cell === 'number') cell = [cell, 0];
      const [rank, locked] = cell;
      $cells[cellIndex] = {
        editable: {$set: rank === -1 ? null : alphabet[rank]},
        locked: {$set: locked !== 0},
      };
    });
    hints.forEach(({cellRank: j, symbol}) => {
        $cells[j] = {
          editable: {$set: symbol},
          hint: {$set: true},
        };
    });
    answerKeys.forEach(({cellRank: j, symbol}) => {
        $cells[j] = {
          editable: {$set: symbol},
          filled: {$set: true},
        };
    });
    let decryption = makeDecryption(alphabet);
    decryption = update(decryption, {cells: $cells});
    decryption = markDecryptionConflicts(updatePerms(decryption));
    return decryption;
}

export function editDecryptionCell (decryption, rank, symbol) {
  decryption = update(decryption, {cells: {[rank]: {editable: {$set: symbol}}}});
  return updatePerms(markDecryptionConflicts(decryption));
}

export function lockDecryptionCell (decryption, rank, locked) {
  return update(decryption, {cells: {[rank]: {locked: {$set: locked}}}});
}

function markDecryptionConflicts (decryption) {
  const counts = new Map();
  const changes = {};
  for (let {rank, editable, conflict} of decryption.cells) {
    if (conflict) {
      changes[rank] = {conflict: {$set: false}};
    }
    if (editable !== null) {
      if (!counts.has(editable)) {
        counts.set(editable, [rank]);
      } else {
        counts.get(editable).push(rank);
      }
    }
  }
  for (let ranks of counts.values()) {
    if (ranks.length > 1) {
      for (let rank of ranks) {
        changes[rank] = {conflict: {$set: true}};
      }
    }
  }
  return update(decryption, {cells: changes});
}

export function updatePerms (decryption) {
  const {size, alphabet, cells} = decryption;
  const backward = new Array(size).fill(-1);
  for (let cell of cells) {
    if (cell.editable !== null && !cell.conflict) {
      const source = alphabet.indexOf(cell.editable);
      backward[cell.rank] = source;
    }
  }
  return {...decryption, backward};
}

export function applySubstitutions (decryption, rank) {
  const result = {rank, locks: 0, trace: []};
  applySubstitution(decryption, result);
  return result;
}

export function wrapAround (value, mod) {
  return ((value % mod) + mod) % mod;
}

export function applySubstitution (decryption, result) {
  let rank = result.rank, cell;
  cell = decryption.cells[rank];
  rank = decryption.backward[rank];
  result.rank = rank;
  if (cell) {
    result.trace.push(cell);
    if (cell.locked) {
      result.locked = true;
    }
    if (cell.hint) {
      result.isHint = true;
    }
    if (cell.collision) {
      result.collision = true;
    }
  }
}

const replaceStarMatches = (index, matched) => " ".repeat(matched[index].length);
// place *, ? with " " and "-" to help with highlight coloring them
const replacer = (transformer, regexMatch) => {
  const charsList = [];
  const fullText = transformer.reduce((str, item) => {
    if (typeof item === 'number') {
      const letter = regexMatch[item];
      str += letter; // replace a,b,c,d
      if (charsList.indexOf(letter) === -1) {
        charsList.push(letter);
      }
    } else if (typeof item === 'function') {
      str += item(regexMatch); // replace *
    } else {
      str += item; // replace ?
    }
    return str;
  }, "");
  return [fullText, charsList];
};

export function patternToRegex (pattern) {
  let regex = "";
  const charRegex = "([A-Z])";
  // const starRegex = "(.{0,12}?)";
  const starRegex = "([A-Z]*?)";
  const dotRegex = "[A-Z]"; // for ? in pattern
  const charList = [];
  const transformer = [];

  for (let index = 0; index < pattern.length; index++) {
    const curChar = pattern[index];
    switch (curChar) {
      case '?': {
        regex += dotRegex;
        transformer.push("-");
        break;
      }
      case '*': {
        regex += starRegex;
        charList.push("*");
        transformer.push(replaceStarMatches.bind(null, charList.length));
        break;
      }
      default: {
        const pos = charList.indexOf(curChar);
        if (pos === -1) { //new group
          charList.push(curChar);
          transformer.push(charList.length);
          regex += charRegex;
        } else {
          const groupIndex = pos + 1;
          regex += "\\" + (groupIndex).toString(); // previous group reference
          transformer.push(groupIndex);
        }
      }
    }
  }
  return [new RegExp(regex, 'gm'), replacer.bind(null, transformer)];
}

export function calulateHighlightIndexes (match, replacerFn, charColors, starColor, dotColor) {
  let start = match.index;
  const [fullMatch, chars] = replacerFn(match);
  const end = start + fullMatch.length - 1;
  const colors = {};
  let c = 0;
  for (let index = start; index <= end; index++) {
    const colorIndex = chars.indexOf(fullMatch[c]);
    colors[index] = colorIndex === -1 ? (fullMatch[c] === " " ? starColor : dotColor) : charColors[colorIndex];
    c++;
  }
  return [start, end, colors];
}

export function regexSearch (regex, text) {
  const matches = [];
  let m;
  while ((m = regex.exec(text)) !== null) {
    // This is necessary to avoid infinite loops with zero-width matches
    // if (m.index === regex.lastIndex) {
    //   regex.lastIndex++;
    // }
    regex.lastIndex = m.index + 1;
    matches.push(m);
  }
  return matches;
}

export function getStartEndOfVisibleRows (props) {
  const {scrollTop, cellHeight, nbCells, pageRows, pageColumns} = props;
  const firstRow = Math.floor(scrollTop / cellHeight);
  const lastRow = Math.min(firstRow + pageRows - 1, Math.ceil(nbCells / pageColumns) - 1);
  const rowStartPos = firstRow * pageColumns;
  const rowEndPos = (lastRow * pageColumns) + pageColumns - 1;
  return [rowStartPos, rowEndPos];
}

export function makeBigramCells (alphabet, rank, diff) {
	const $cells = range(0, alphabet.length).map(() => ({}));
  $cells[rank].isMiddle = true;
  if (diff === 0) {
    return $cells;
  }
	//calculate line-ends
	const leftEnd = wrapAround(rank - diff, alphabet.length);
	const rightEnd = wrapAround(rank + diff, alphabet.length);
	//set line-ends to cells
	$cells[leftEnd].leftEnd = true;
	$cells[rightEnd].rightEnd = true;
	//calculate out-of-ranges,
	const leftOutOfRange = leftEnd > rank;
	const rightOutOfRange = rightEnd < rank;
	//calculate cells included in the line
	//update left side active cells
	let start = 0, end = 0;
  start = leftEnd + 1;
	if (leftOutOfRange) {
		end = $cells.length;
	} else {
		if (rightOutOfRange) {
			end = $cells.length;
		} else {
			start = leftEnd + 1;
			end = rank;
		}
	}
	for (let i = start; i < end; i++) {
    if (i === rank) {
      continue;
    }
		$cells[i].isActive = true;
	}
	//update right side active cells
	if (rightOutOfRange) {
    start = 0;
    end = rightEnd;
	} else {
		if (leftOutOfRange) {
      start = 0;
			end = rightEnd;
		} else {
			start = rank + 1;
			end = rightEnd;
		}
	}
	for (let i = start; i < end; i++) {
    if (i === rank) {
      continue;
    }
		$cells[i].isActive = true;
	}
	return $cells;
}