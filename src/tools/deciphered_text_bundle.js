/*
- shows a slice of the clearText
- adds deciphered characters from start up to the "current" animation position
  (lazily computed)
- scrolling does not affect the current animation position
*/


import React from 'react';
import {connect} from 'react-redux';

import {updateGridGeometry, updateGridVisibleRows, selectTaskData} from '../utils/utils';
import {getTextAsBigrams} from '../utils/bigram';
import {applySubstitution} from '../utils/bigram_subst';

function appInitReducer (state, _action) {
  return {
    ...state, decipheredText: {
      cellWidth: 15,
      cellHeight: 46,
      scrollTop: 0,
      nbCells: 0
    }
  };
}

function taskInitReducer (state, _action) {
  let {decipheredText} = state;
  const {cipherText} = selectTaskData(state);
  decipheredText = {...decipheredText, nbCells: cipherText.length};
  return {...state, decipheredText};
}

function decipheredTextResizedReducer (state, {payload: {width}}) {
  let {decipheredText} = state;
  decipheredText = {...decipheredText, width, height: 4 * decipheredText.cellHeight};
  decipheredText = updateGridGeometry(decipheredText);
  return {...state, decipheredText};
}

function decipheredTextScrolledReducer (state, {payload: {scrollTop}}) {
  let {decipheredText} = state;
  decipheredText = {...decipheredText, scrollTop};
  return {...state, decipheredText};
}

function decipheredTextLateReducer (state, _action) {
  if (!state.taskReady) return state;
  let {decipheredText} = state;
  const {alphabet, cipherText} = selectTaskData(state);
  const position = cipherText.length - 1;
  const {bigramAlphabet} = state;
  const inputSubstitution = state.editSubstitution.outputSubstitution;
  const letterInfos = getTextAsBigrams(cipherText, bigramAlphabet).letterInfos;
  const outputText = applySubstitution(inputSubstitution, letterInfos);

  function getCell (index) {
    const ciphered = cipherText[index];
    const cell = {position: index, ciphered};
    let rank = alphabet.indexOf(ciphered);
    if (rank === -1) {
      cell.clear = ciphered;
    } else if (index <= position) {
      const $cell = outputText[index];
      if ($cell.l !== undefined) {
        cell.rank = $cell.l;
        if ($cell.q === 'hint' || $cell.q === 'filled') {
          cell.isHint = true;
        } else {
          if ($cell.q === 'confirmed') {
            cell.locked = true;
          }
        }
        cell.clear = alphabet[$cell.l];
      }
    }
    return cell;
  }
  decipheredText = updateGridVisibleRows(decipheredText, {getCell});
  return {...state, decipheredText};
}

function DecipheredTextViewSelector (state) {
  const {actions, decipheredText} = state;
  const {decipheredTextResized, decipheredTextScrolled, schedulingJump} = actions;
  const {width, height, cellWidth, cellHeight, bottom, pageRows, pageColumns, visible} = decipheredText;
  return {
    decipheredTextResized, decipheredTextScrolled, schedulingJump,
    width, height, visibleRows: visible.rows, cellWidth, cellHeight, bottom, pageRows, pageColumns
  };
}

class DecipheredTextView extends React.PureComponent {
  render () {
    const {width, height, visibleRows, cellWidth, cellHeight, bottom} = this.props;
    return (
      <div ref={this.refTextBox} onScroll={this.onScroll} style={{position: 'relative', width: width && `${width}px`, height: height && `${height}px`, overflowY: 'scroll'}}>
        {(visibleRows || []).map(({index, columns}) =>
          <div key={index} style={{position: 'absolute', top: `${index * cellHeight}px`}}>
            {columns.map(({index, position, ciphered, clear, isHint, locked}) =>
              <TextCell key={index} column={index} position={position} ciphered={ciphered} clear={clear} isHint={isHint} locked={locked} cellWidth={cellWidth} />)}
          </div>)}
        <div style={{position: 'absolute', top: `${bottom}px`, width: '1px', height: '1px'}} />
      </div>
    );
  }
  refTextBox = (element) => {
    this._textBox = element;
    const width = element.clientWidth;
    const height = element.clientHeight;
    this.props.dispatch({type: this.props.decipheredTextResized, payload: {width, height}});
  };
  onScroll = () => {
    const scrollTop = this._textBox.scrollTop;
    this.props.dispatch({type: this.props.decipheredTextScrolled, payload: {scrollTop}});
  };
}

class TextCell extends React.PureComponent {
  render () {
    const {column, ciphered, clear, isHint, locked, cellWidth} = this.props;
    const cellStyle = {
      position: 'absolute',
      left: `${column * cellWidth}px`,
      width: `${cellWidth}px`,
      height: `42px`,
      border: 'solid #777',
      borderWidth: '1px 0',
      backgroundColor: (isHint || locked) ? ((locked) ? '#e2e2e2' : '#a2a2a2') : '#fff',
      cursor: 'pointer'
    };
    return (
      <div style={cellStyle}>
        <div style={{width: '100%', height: '20px', borderBottom: '1px solid #ccc', textAlign: 'center'}}>{ciphered || ' '}</div>
        <div style={{width: '100%', height: '20px', textAlign: 'center'}}>{clear || ' '}</div>
      </div>
    );
  }
}

export default {
  actions: {
    decipheredTextResized: 'DecipheredText.Resized' /* {width: number, height: number} */,
    decipheredTextScrolled: 'DecipheredText.Scrolled' /* {scrollTop: number} */,
  },
  actionReducers: {
    appInit: appInitReducer,
    taskInit: taskInitReducer,
    decipheredTextResized: decipheredTextResizedReducer,
    decipheredTextScrolled: decipheredTextScrolledReducer,
  },
  lateReducer: decipheredTextLateReducer,
  views: {
    DecipheredText: connect(DecipheredTextViewSelector)(DecipheredTextView),
  }
};
