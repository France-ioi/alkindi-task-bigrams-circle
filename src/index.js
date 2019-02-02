
import update from 'immutability-helper';
import algoreaReactTask from './algorea_react_task';
import {selectTaskData} from './utils/utils';

import 'font-awesome/css/font-awesome.css';
import 'bootstrap/dist/css/bootstrap.css';
import './style.css';
import './platform.css';

import SubstitutionBundle from './tools/substitution_bundle';
import EditSubstitutionBundle from './tools/edit_substitution';
import BigramFrequencyAnalysisBundle from './tools/bigram_frequency_analysis';

import CipheredTextBundle from './tools/ciphered_text_bundle';
import DecryptionBundle from './tools/decryption_bundle';
import DecipheredTextBundle from './tools/deciphered_text_bundle';
import HintsBundle from './tools/hints_bundle';
import WorkspaceBundle from './workspace_bundle';

import {dumpDecryption, loadDecryption} from './utils/utils';
import {makeAlphabet} from './utils/cell';
import {makeBigramAlphabet} from './utils/bigram';


const TaskBundle = {
  actionReducers: {
    appInit: appInitReducer,
    taskInit: taskInitReducer /* possibly move to algorea-react-task */,
    taskRefresh: taskRefreshReducer /* possibly move to algorea-react-task */,
    taskAnswerLoaded: taskAnswerLoaded,
    taskStateLoaded: taskStateLoaded,
  },
  includes: [
    WorkspaceBundle,
    CipheredTextBundle,
    HintsBundle,
    DecryptionBundle,
    EditSubstitutionBundle,
    SubstitutionBundle,
    BigramFrequencyAnalysisBundle,
    DecipheredTextBundle,
  ],
  selectors: {
    getTaskState,
    getTaskAnswer,
  }
};

if (process.env.NODE_ENV === 'development') {
  /* eslint-disable no-console */
  TaskBundle.earlyReducer = function (state, action) {
    console.log('ACTION', action.type, action);
    return state;
  };
}

function appInitReducer (state, _action) {
  const taskMetaData = {
    "id": "http://concours-alkindi.fr/tasks/2018/enigma",
    "language": "fr",
    "version": "fr.01",
    "authors": "Sébastien Carlier",
    "translators": [],
    "license": "",
    "taskPathPrefix": "",
    "modulesPathPrefix": "",
    "browserSupport": [],
    "fullFeedback": true,
    "acceptedAnswers": [],
    "usesRandomSeed": true
  };
  return {...state, taskMetaData};
}

function taskInitReducer (state, _action) {
  const {alphabet: taskAlphabet, hints} = selectTaskData(state);
  const alphabet = makeAlphabet(taskAlphabet);
  const bigramAlphabet = makeBigramAlphabet(alphabet);
  const decryption = loadDecryption(taskAlphabet, hints);
  return {
    ...state,
    taskReady: true,
    decryption,
    alphabet,
    bigramAlphabet,
    hintsGrid: {},
    mostFrequentFrench: mostFrequentFrench.map(function (p) {
      return {...bigramAlphabet.bigrams[p.v], r: p.r};
    })
  };
}

function taskRefreshReducer (state, _action) {
  const {alphabet, hints} = selectTaskData(state);
  const {selectedBigram, bigramL1Cells, bigramL2Cells} = state.decryption;
  const dump = dumpDecryption(alphabet, state.decryption);
  const decryption = loadDecryption(alphabet, hints, dump);
  return {...state, decryption: {...decryption, selectedBigram, bigramL1Cells, bigramL2Cells}};
}

function getTaskAnswer (state) {
  const {taskData: {alphabet}} = state;
  const keys = state.decryption.cells.map(({editable}) => alphabet.indexOf(editable));
  return {
    keys
  };
}

function taskAnswerLoaded (state, {payload: {answer}}) {
  const {alphabet, hints} = selectTaskData(state);
  const {selectedBigram, bigramL1Cells, bigramL2Cells} = state.decryption;
  const decryption = loadDecryption(alphabet, hints, answer.keys);
  return update(state, {decryption: {$set:  {...decryption, selectedBigram, bigramL1Cells, bigramL2Cells}}});
}

function getTaskState (state) {
  const {taskData: {alphabet}} = state;
  return {
    decryption: dumpDecryption(alphabet, state.decryption),
    substitutionEdits: state.editSubstitution.substitutionEdits,
  };
}

function taskStateLoaded (state, {payload: {dump}}) {
  const {alphabet, hints} = selectTaskData(state);
  const {selectedBigram, bigramL1Cells, bigramL2Cells} = state.decryption;
  const decryption = loadDecryption(alphabet, hints, dump.decryption);
  return update(state, {
    decryption: {$set: {...decryption, selectedBigram, bigramL1Cells, bigramL2Cells}},
    editSubstitution: {substitutionEdits: {$set: dump.substitutionEdits}},
  });
}

export function run (container, options) {
  return algoreaReactTask(container, options, TaskBundle);
}

const mostFrequentFrench = [
  {v: "ES", r: 3.1},
  {v: "LE", r: 2.2},
  {v: "DE", r: 2.2},
  {v: "RE", r: 2.1},
  {v: "EN", r: 2.1},
  {v: "ON", r: 1.6},
  {v: "NT", r: 1.6},
  {v: "ER", r: 1.5},
  {v: "TE", r: 1.5},
  {v: "ET", r: 1.4},
  {v: "EL", r: 1.4},
  {v: "AN", r: 1.4},
  {v: "SE", r: 1.3},
  {v: "LA", r: 1.3},
  {v: "AI", r: 1.2},
  {v: "NE", r: 1.1},
  {v: "OU", r: 1.1},
  {v: "QU", r: 1.1},
  {v: "ME", r: 1.1},
  {v: "IT", r: 1.1},
  {v: "IE", r: 1.1},
  {v: "ED", r: 1.0},
  {v: "EM", r: 1.0},
  {v: "UR", r: 1.0},
  {v: "IS", r: 1.0},
  {v: "EC", r: 1.0},
  {v: "UE", r: 0.9},
  {v: "TI", r: 0.9},
  {v: "RA", r: 0.9},
  {v: "IN", r: 0.8}
];
