var seedrandom = require("seedrandom");
var {shuffle} = require("shuffle");
var {generate} = require("../bebras-modules/pemFioi/sentences_2");

/**
 * Default constants
 */
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ:.?";

/**
 * task module export...
 */

/* prefer JSON config file at project root?  depend on NODE_ENV? */
module.exports.config = {
  cache_task_data: false
};

module.exports.taskData = function (args, callback) {
  const version = parseInt(args.task.params.version);
  // hints array
  const hintsRequested = getHintsRequested(args.task.hints_requested);
  const {publicData} = generateTaskData(args.task.random_seed, hintsRequested, version);
  callback(null, publicData);
};

module.exports.requestHint = function (args, callback) {
  const request = args.request;
  const hints_requested = args.task.hints_requested
    ? JSON.parse(args.task.hints_requested)
    : [];
  for (var hintRequest of hints_requested) {
    if (hintRequest === null) {
      /* XXX Happens, should not. */
      /* eslint-disable-next-line no-console */
      console.log("XXX", args.task.hints_requested);
      continue;
    }
    if (typeof hintRequest === "string") {
      hintRequest = JSON.parse(hintRequest);
    }
    if (hintRequestEqual(hintRequest, request)) {
      return callback(new Error("hint already requested"));
    }
  }
  callback(null, args.request);
};

module.exports.gradeAnswer = function (args, task_data, callback) {

  // hints array
  const hintsRequested = getHintsRequested(args.answer.hints_requested);

  const {
    publicData: {
      alphabet,
    },
    privateData: {
      encodingKey
    }
  } = generateTaskData(args.task.random_seed, hintsRequested);

  let {keys} = JSON.parse(args.answer.value);
  const answerKey = keys.map(i => (i === -1 ? " " : alphabet[i])).join("");

  const nHints = hintsRequested.length;

  let score = 0, message = ` Vous avez utilisé ${nHints} indice${
    nHints > 1 ? "s" : ""
    }.`;

  const encodingBigrams = makeSubstitutionBigramAlphabet(alphabet, encodingKey);
  const answerBigrams = makeSubstitutionBigramAlphabet(alphabet, answerKey);
  var same = true;
  for (var key in encodingBigrams) {
    if (encodingBigrams[key] != answerBigrams[key]) {
      same = false;
    }
  }
  if (same) {
    score = Math.max(0, 100 - (nHints * 5));
    message = "Bravo, vous avez retrouvé la clé de déchiffrement." + message;
  } else {
    score = 0;
    message = "La clé de déchiffrement est incorrecte." + message;
  }

  callback(null, {
    score,
    message,
  });
};

/**
 * task methods
 */
function generateMessageData (alphabet, seedInt, hintsRequested) {
  const rng0 = seedrandom(seedInt + 17);
  const rngKeys = seedrandom(rng0());
  const rngText = seedrandom(rng0());

  const clearText = generate(rngText, 5000, 5100, true);
  // const clearText = alphabet.repeat(10);
  const encodingKey = generateKey(alphabet, rngKeys); // encoding keys in decoding order
  const decodingKey = inversePermutation(alphabet, encodingKey);
  const cipherText = bigramCircleEncode(alphabet, encodingKey, clearText);
  const hints = grantHints(alphabet, encodingKey, decodingKey, hintsRequested);
  return {cipherText, hints, clearText, encodingKey, decodingKey};
}

function getHintsRequested (hints_requested) {
  return (hints_requested
    ? JSON.parse(hints_requested)
    : []
  )
    .filter(hr => hr !== null);
}

function generateTaskData (random_seed, hintsRequested, version) {

  let answerKeys = 0;

  switch (version) {
    case 1: {
      answerKeys = 15;
      break;
    }
    case 2: {
      answerKeys = 1;
      break;
    }
  }

  const {
    cipherText,
    hints,
    clearText,
    encodingKey,
    decodingKey
  } = generateMessageData(
    alphabet,
    random_seed,
    hintsRequested
  );

  const privateData = {clearText, encodingKey, decodingKey};
  const publicData = {
    alphabet,
    cipherText,
    hints,
    answerKeys: encodingKey.substring(0, answerKeys).split('').map((symbol, i) => ({cellRank: i, symbol})),
  };

  return {publicData, privateData};
}

function generateKey (alphabet, rngKeys) {
  let key = shuffle({random: rngKeys, deck: alphabet.split("")}).cards.join("");
  // if (process.env.DEV_MODE) {
  //   key = "HIJKLMNOPQRSTUVWXYZABCDEFG,.?"; //for dev mode testing
  // }
  return key;
}

function makeSubstitutionBigramAlphabet (alphabet, encodingKey) {
  const bigrams = {};
  const charRanks = encodingKey.split('').reduce((obj, char, index) => {
    obj[char] = index;
    return obj;
  }, {});

  function pos (char) {
    return charRanks[char];
  }

  function getSubstitutionForBigram (c1, c2) {
    let l1 = '', l2 = '';
    l1 = encodingKey[((pos(c2) + (pos(c2) - pos(c1)) + 29) % 29)];
    l2 = encodingKey[((pos(c1) - (pos(c2) - pos(c1)) + 29) % 29)];
    return l1 + l2;
  }
  const alphabetSymbols = alphabet.split('');
  alphabetSymbols.forEach(function (c1) {
    alphabetSymbols.forEach(function (c2) {
      const symbol = c1 + c2;
      bigrams[getSubstitutionForBigram(c1, c2)] = symbol;
    });
  });

  return bigrams;
}

function bigramCircleEncode (alphabet, encodingKey, clearText) {
  const encodingBigrams = makeSubstitutionBigramAlphabet(alphabet, encodingKey);
  let cipherText = '';
  let nonAlphabetText = '';

  const charRanks = alphabet.split('').reduce((obj, char, index) => {
    obj[char] = index;
    return obj;
  }, {});

  let iLetter = 0;
  let curBigram = '';

  while (iLetter < clearText.length) {
    const letter = clearText.charAt(iLetter);
    const rank = charRanks[letter];
    if (rank !== undefined) {
      curBigram += letter;
      if (curBigram.length == 2) {
        cipherText += (nonAlphabetText === '') ? encodingBigrams[curBigram] : encodingBigrams[curBigram].split('').join(nonAlphabetText);
        curBigram = "";
        nonAlphabetText = "";
      }
    } else {
      if (curBigram.length === 1) {
        nonAlphabetText += letter;
      } else {
        cipherText += letter;
      }
    }
    iLetter++;
  }
  cipherText += nonAlphabetText;
  return cipherText;
}

function inversePermutation (alphabet, key) {
  const result = new Array(alphabet.length).fill(" ");
  for (let i = 0; i < alphabet.length; i += 1) {
    let pos = alphabet.indexOf(key[i]);
    if (pos !== -1) {
      result[pos] = alphabet[i];
    }
  }
  return result.join("");
}

function hintRequestEqual (h1, h2) {
  return (
    h1.cellRank === h2.cellRank &&
    h1.type == h2.type
  );
}

function grantHints (alphabet, encodingKey, decodingKey, hintRequests) {
  return hintRequests.map(function (hintRequest) {
    let symbol;
    let {cellRank, type} = hintRequest;
    if (type === "type_1") {
      symbol = encodingKey[cellRank];
    } else {
      symbol = alphabet[cellRank];
      cellRank = alphabet.indexOf(decodingKey[cellRank]);
    }

    return {cellRank, symbol, type};
  });
}
