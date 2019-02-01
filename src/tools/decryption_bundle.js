
import React from 'react';
import {connect} from 'react-redux';
import classnames from 'classnames';
import {range} from 'range';
import update from 'immutability-helper';
import {put, select, takeEvery} from 'redux-saga/effects';

import {wrapAround, editDecryptionCell, lockDecryptionCell, selectTaskData, makeBigramCells} from '../utils/utils';
import {getSubstitutionFromCells} from '../utils/bigram_circle';

function appInitReducer (state, _action) {
  return {
    ...state, editing: {}
  };
}

function decryptionCellEditStartedReducer (state, {payload: {cellRank}}) {
  let {taskData: {alphabet}} = state;
  cellRank = wrapAround(cellRank, alphabet.length);
  return update(state, {editing: {$set: {cellRank}}});
}

function decryptionCellEditMovedReducer (state, {payload: {cellMove}}) {
  let {taskData: {alphabet}, decryption, editing: {cellRank}} = state;
  let cellStop = cellRank;
  if (cellRank === undefined) return state;
  let cell;
  do {
    cellRank = wrapAround(cellRank + cellMove, alphabet.length);
    cell = decryption.cells[cellRank];
    /* If we looped back to the starting point, the move is impossible. */
    if (cellStop == cellRank) return state;
  } while (cell.hint || cell.locked);
  return update(state, {editing: {$set: {cellRank}}});
}

function decryptionCellEditCancelledReducer (state, _action) {
  return update(state, {editing: {$set: {}}});
}

function decryptionCellCharChangedReducer (state, {payload: {rank, symbol}}) {
  let {taskData: {alphabet}, decryption} = state;
  if (symbol.length !== 1 || -1 === alphabet.indexOf(symbol)) {
    symbol = null;
  }
  decryption = editDecryptionCell(decryption, rank, symbol);
  return update(state, {decryption: {$set: decryption}});
}

function decryptionCellBigramChangedReducer (state, {payload}) {
  return update(state, {decryption: {selectedBigram: {$merge: payload}}});
}

function decryptionBigramCellsChangedReducer (state, {payload: {bigramL1Cells, bigramL2Cells}}) {
  return update(state, {decryption: {bigramL1Cells: {$set: bigramL1Cells}, bigramL2Cells: {$set: bigramL2Cells}}});
}

function decryptionCellLockChangedReducer (state, {payload: {rank, isLocked}}) {
  const decryption = lockDecryptionCell(state.decryption, rank, isLocked);
  return update(state, {decryption: {$set: decryption}});
}

function taskInitReducer (state, _action) {
  const {alphabet} = selectTaskData(state);
  const bigramCells = new Array(alphabet.length).fill({});
  bigramCells[0] = {isMiddle: true, isEnd: true};
  return update(state, {decryption: {selectedBigram: {$set: {l1: 0, l2: 0}}, bigramL1Cells: {$set: bigramCells}, bigramL2Cells: {$set: bigramCells}}});
}

function* bigramChanged () {
  const {actions, alphabet, selectedBigram: {l1, l2}} = yield select(({actions, taskData: {alphabet}, decryption: {selectedBigram}}) => ({actions, alphabet, selectedBigram}));
  const diff = Math.abs(l2 - l1);
  const bigramL1Cells = makeBigramCells(alphabet, l1, diff);
  const bigramL2Cells = makeBigramCells(alphabet, l2, diff);
  yield put({type: actions.decryptionBigramCellsChanged, payload: {bigramL1Cells, bigramL2Cells}});
}

function decryptionLateReducer (state, _action) {

  const {decryption, alphabet} = state;
  if (!state.taskReady) {
    return state;
  }
  let decryptedLetters = 0;
  const decryptionCells = decryption.cells.map(({editable, hint, locked}) => {
    if (editable) {
      const index = alphabet.ranks[editable];
      decryptedLetters++;
      if (hint) {
        return {'q': 'hint', 'l': index};
      } else {
        if (locked) {
          return {'q': 'locked', 'l': index};
        } else {
          return {'q': 'guess', 'l': index};
        }
      }
    } else {
      return {'q': 'unknown'};
    }
  });
  if (decryptedLetters.length < 2) {
    return state;
  }
  const substitution = getSubstitutionFromCells(decryptionCells);
  return update(state, {decryption: {substitution: {$set: substitution}}});
}

function DecryptionSelector (state) {
  const {
    actions: {
      decryptionCellLockChanged, decryptionCellCharChanged, decryptionCellBigramChanged,
      decryptionCellEditCancelled, decryptionCellEditStarted, decryptionCellEditMoved
    },
    decryption, editing
  } = state;
  const {cells, bigramL1Cells, bigramL2Cells} = decryption;
  return {
    decryptionCellEditStarted, decryptionCellEditCancelled, decryptionCellEditMoved,
    decryptionCellLockChanged, decryptionCellCharChanged, decryptionCellBigramChanged,
    cells, bigramL1Cells, bigramL2Cells, editingRank: editing.cellRank
  };
}

class DecryptionView extends React.PureComponent {
  render () {
    const {cells, bigramL1Cells, bigramL2Cells, editingRank} = this.props;
    const nbCells = cells.length;
    return (
      <div style={{width: "100%"}}>
        <div className='clearfix' style={{marginLeft: "130px"}}>
          {range(0, nbCells).map(rank => {
            const {editable, locked, conflict, hint} = cells[rank];
            const isActive = false;
            const isEditing = editingRank === rank && !locked && !hint;
            const isLast = nbCells === rank + 1;
            const l1Cell = bigramL1Cells[rank];
            const l2Cell = bigramL2Cells[rank];
            return (
              <DecryptionCell key={rank} rank={rank} isLast={isLast}
                l1Cell={l1Cell} l2Cell={l2Cell}
                editableChar={editable} isLocked={locked} isHint={hint} isEditing={isEditing} isActive={isActive}
                onChangeChar={this.onChangeChar} onChangeLocked={this.onChangeLocked}
                onEditingStarted={this.onEditingStarted} onEditingCancelled={this.onEditingCancelled}
                onChangeBigram={this.onChangeBigram}
                onEditingMoved={this.editingMoved} isConflict={conflict} />);
          })}
        </div>
      </div>
    );
  }
  onEditingStarted = (rank) => {
    this.props.dispatch({type: this.props.decryptionCellEditStarted, payload: {cellRank: rank}});
  };
  onEditingCancelled = () => {
    this.props.dispatch({type: this.props.decryptionCellEditCancelled});
  };
  onChangeChar = (rank, symbol) => {
    symbol = symbol.toUpperCase();
    this.props.dispatch({type: this.props.decryptionCellCharChanged, payload: {rank, symbol}});
  };
  onChangeLocked = (rank, isLocked) => {
    this.props.dispatch({type: this.props.decryptionCellLockChanged, payload: {rank, isLocked}});
  };
  onChangeBigram = (side, rank) => {
    this.props.dispatch({type: this.props.decryptionCellBigramChanged, payload: {[side]: rank}});
  };
  editingMoved = (decryptionMove, cellMove) => {
    this.props.dispatch({type: this.props.decryptionCellEditMoved, payload: {decryptionMove, cellMove}});
  };
}

class DecryptionCell extends React.PureComponent {
  /* XXX Clicking in the editable div and entering the same letter does not
         trigger a change event.  This behavior is unfortunate. */
  render () {
    const {l1Cell, l2Cell, editableChar, isLocked, isHint, isActive, isEditing, isLast, isConflict} = this.props;
    const columnStyle = {
      float: 'left',
      width: '20px',
    };
    const staticCellStyle = {
      border: '1px solid black',
      borderRightWidth: isLast ? '1px' : '0',
      textAlign: 'center',
    };
    const editableCellStyle = {
      border: '1px solid black',
      borderRightWidth: isLast ? '1px' : '0',
      textAlign: 'center',
      cursor: 'text',
      backgroundColor: isHint ? '#afa' : (isConflict ? '#fcc' : '#fff')
    };
    /* Apply active-status separation border style. */
    const bottomCellStyle = staticCellStyle;
    if (isActive) {
      bottomCellStyle.marginTop = '0';
      bottomCellStyle.borderTopWidth = '3px';
    } else {
      bottomCellStyle.marginTop = '2px';
      bottomCellStyle.borderTopWidth = '1px'; /* needed because react */
    }
    const bigramL1Style = this.getBigramStyles(l1Cell);
    const bigramL1Cell = (
      <div className={bigramL1Style}  onClick={this.bigramL1Selected}>
        {'\u00A0'}
      </div>
    );
    const bigramL2Style = this.getBigramStyles(l2Cell);
    const bigramL2Cell = (
      <div className={bigramL2Style}  onClick={this.bigramL2Selected}>
        {'\u00A0'}
      </div>
    );
    const editableCell = (
      <div style={editableCellStyle} onClick={this.startEditing}>
        {isEditing
          ? <input ref={this.refInput} onChange={this.cellChanged} onKeyDown={this.keyDown}
            type='text' value={editableChar || ''} style={{width: '19px', height: '20px', border: 'none', textAlign: 'center'}} />
          : (editableChar || '\u00A0')}
      </div>
    );
    const lock = (
      <div style={{marginTop: '2px', textAlign: 'center', cursor: 'pointer'}} onClick={this.lockClicked}>
        {isHint ? '\u00A0' : <i className={classnames(['fa', isLocked ? 'fa-lock' : 'fa-unlock-alt'])} />}
      </div>
    );
    return (
      <div style={columnStyle}>
        {bigramL2Cell}{editableCell}{lock}{bigramL1Cell}
      </div>
    );
  }
  componentDidUpdate () {
    if (this._input) {
      this._input.select();
      this._input.focus();
    }
  }
  getBigramStyles (cell) {
    let className = "";
    if (cell.isMiddle) {
      className = 'bigram-cell-middle';
    }
    if (cell.leftEnd) {
      className = 'bigram-cell-left';
    }
    if (cell.rightEnd) {
      className = 'bigram-cell-right';
    }
    if (cell.isActive) {
      className += ' bigram-cell-active';
    }
    return className;
  }
  startEditing = () => {
    if (!this.props.isLocked && !this.props.isEditing) {
      this.props.onEditingStarted(this.props.rank);
    }
  };
  keyDown = (event) => {
    let handled = true;
    if (event.key === 'ArrowRight') {
      this.props.onEditingMoved(0, 1);
    } else if (event.key === 'ArrowLeft') {
      this.props.onEditingMoved(0, -1);
    } else if (event.key === 'ArrowUp') {
      this.props.onEditingMoved(-1, 0);
    } else if (event.key === 'ArrowDown') {
      this.props.onEditingMoved(1, 0);
    } else if (event.key === 'Escape' || event.key === 'Enter') {
      this.props.onEditingCancelled();
    } else {
      handled = false;
    }
    if (handled) {
      event.preventDefault();
      event.stopPropagation();
    }
  };
  cellChanged = () => {
    const value = this._input.value.substr(-1); /* /!\ IE compatibility */
    this.props.onChangeChar(this.props.rank, value);
  };
  lockClicked = () => {
    this.props.onChangeLocked(this.props.rank, !this.props.isLocked);
  };
  bigramL1Selected = () => {
    this.props.onChangeBigram('l1', this.props.rank);
  };
  bigramL2Selected = () => {
    this.props.onChangeBigram('l2', this.props.rank);
  };
  refInput = (element) => {
    this._input = element;
  };
}

export default {
  actions: {
    decryptionCellEditStarted: 'Decryption.Cell.Edit.Started',
    decryptionCellEditMoved: 'Decryption.Cell.Edit.Moved',
    decryptionCellEditCancelled: 'Decryption.Cell.Edit.Cancelled',
    decryptionCellLockChanged: 'Decryption.Cell.Lock.Changed',
    decryptionCellCharChanged: 'Decryption.Cell.Char.Changed',
    decryptionCellBigramChanged: 'Decryption.Cell.Bigram.Changed',
    decryptionBigramCellsChanged: 'Decryption.Bigram.Cells.Changed',
    // decryptionKeyLoaded: 'Decryption.Key.Loaded',
  },
  actionReducers: {
    appInit: appInitReducer,
    taskInit: taskInitReducer,
    decryptionCellEditStarted: decryptionCellEditStartedReducer,
    decryptionCellEditMoved: decryptionCellEditMovedReducer,
    decryptionCellEditCancelled: decryptionCellEditCancelledReducer,
    decryptionCellLockChanged: decryptionCellLockChangedReducer,
    decryptionCellCharChanged: decryptionCellCharChangedReducer,
    decryptionCellBigramChanged: decryptionCellBigramChangedReducer,
    decryptionBigramCellsChanged: decryptionBigramCellsChangedReducer,
    // decryptionKeyLoaded: decryptionKeyLoadedReducer,
  },
  lateReducer: decryptionLateReducer,
  saga: function* () {
    const actions = yield select(({actions}) => actions);
    yield takeEvery(actions.decryptionCellEditStarted, function* () {
      yield put({type: actions.hintRequestFeedbackCleared});
    });
    yield takeEvery(actions.decryptionCellBigramChanged, bigramChanged);
  },
  views: {
    Decryption: connect(DecryptionSelector)(DecryptionView)
  }
};
