
const getDstCoords = function (c1, c2) {
	const l1 = (c2 + (c2 - c1) + 29) % 29;
	const l2 = (c1 - (c2 - c1) + 29) % 29;
	return [l1, l2];
};

const addToSubstitution = function (cells, substitution, c1, c2) {
	const cellSrc1 = cells[c1];
	const cellSrc2 = cells[c2];
	if ((cellSrc1.l === undefined) || (cellSrc2.l === undefined)) {
		return undefined;
	}
	const dstCoords = getDstCoords(c1, c2);
	const cellDst1 = cells[dstCoords[0]];
	const cellDst2 = cells[dstCoords[1]];

	if ((cellDst1.l === undefined) && (cellDst2.l === undefined)) {
		return undefined;
	}
	if (substitution[cellSrc1.l] === undefined) {
		substitution[cellSrc1.l] = [];
	}
	if (substitution[cellSrc2.l] === undefined) {
		substitution[cellSrc2.l] = [];
	}
	substitution[cellSrc1.l][cellSrc2.l] = {
		src: [{l: cellSrc1.l, q: cellSrc1.q}, {l: cellSrc2.l, q: cellSrc2.q}],
		dst: [{l: cellDst1.l, q: cellDst1.q}, {l: cellDst2.l, q: cellDst2.q}]
	};
	substitution[cellSrc2.l][cellSrc1.l] = {
		src: [{l: cellSrc2.l, q: cellSrc2.q}, {l: cellSrc1.l, q: cellSrc1.q}],
		dst: [{l: cellDst2.l, q: cellDst2.q}, {l: cellDst1.l, q: cellDst1.q}]
	};
};

export const getSubstitutionFromCells = function (cells) {
	const substitution = [];
	let nbRows = cells.length;
	for (let c1 = 0; c1 < nbRows; c1++) {
		for (let c2 = 0; c2 < nbRows; c2++) {
			addToSubstitution(cells, substitution, c1, c2);
		}
	}
	return substitution;
};
