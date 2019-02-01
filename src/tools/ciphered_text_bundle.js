import React from 'react';
import {connect} from 'react-redux';

import {updateGridGeometry, updateGridVisibleRows, selectTaskData} from '../utils/utils';

function appInitReducer (state, _action) {
  return {
    ...state, cipheredText: {
      cellWidth: 15,
      cellHeight: 18,
      scrollTop: 0,
      nbCells: 0
    }
  };
}

function taskInitReducer (state) {
  let {cipheredText} = state;
  if (!cipheredText) {
    return state;
  }
  const {cipherText} = selectTaskData(state);
  cipheredText = {...cipheredText, cells: cipherText, nbCells: cipherText.length};
  cipheredText = updateGridVisibleRows(cipheredText);
  return {...state, cipheredText};
}

function taskRefreshReducer (state) {
  let {cipheredText} = state;
  if (!cipheredText) {
    return state;
  }
  const {cipherText} = selectTaskData(state);
  cipheredText = {...cipheredText, cells: cipherText, nbCells: cipherText.length};
  cipheredText = updateGridVisibleRows(cipheredText);
  return {...state, cipheredText};
}

function cipheredTextResizedReducer (state, {payload: {width}}) {
  let {cipheredText} = state;
  cipheredText = {...cipheredText, width, height: 8 * cipheredText.cellHeight};
  cipheredText = updateGridGeometry(cipheredText);
  cipheredText = updateGridVisibleRows(cipheredText);
  return {...state, cipheredText};
}

function cipheredTextScrolledReducer (state, {payload: {scrollTop}}) {
  let {cipheredText} = state;
  cipheredText = {...cipheredText, scrollTop};
  cipheredText = updateGridVisibleRows(cipheredText);
  return {...state, cipheredText};
}

function CipherTextViewSelector (state) {
  const {actions, cipheredText} = state;
  const {cipheredTextResized, cipheredTextScrolled} = actions;
  const {width, height, cellWidth, cellHeight, bottom, pageRows, pageColumns, visible, scrollTop} = cipheredText;
  return {
    cipheredTextResized, cipheredTextScrolled,
    width, height, visibleRows: visible.rows, cellWidth, cellHeight, bottom, pageRows, pageColumns, scrollTop
  };
}

class CipherTextView extends React.PureComponent {
  render () {
    const {width, height, visibleRows, cellWidth, cellHeight, bottom} = this.props;
    const getClassNames = (colorClass, borderClass) => {
      let classNames = null;
      if (colorClass) { classNames = colorClass; }
      if (borderClass) { classNames = classNames ? (classNames + " " + borderClass) : borderClass; }
      return classNames;
    };
    return (
      <div>
        <div ref={this.refTextBox} onScroll={this.onScroll} style={{position: 'relative', width: width && `${width}px`, height: height && `${height}px`, overflowY: 'scroll'}}>
          {(visibleRows || []).map(({index, columns}) =>
            <div key={index} style={{position: 'absolute', top: `${index * cellHeight}px`, textAlign: 'center'}}>
              {columns.map(({index, cell, colorClass, borderClass}) =>
                <span key={index} className={`${getClassNames(colorClass, borderClass)}`} style={{position: 'absolute', left: `${index * cellWidth}px`, width: `${cellWidth}px`, height: `${cellHeight}px`/*, backgroundColor: color || "#fff"*/}}>
                  {cell || ' '}
                </span>)}
            </div>)}
          <div style={{position: 'absolute', top: `${bottom}px`, width: '1px', height: '1px'}} />
        </div>
      </div>
    );
  }
  refTextBox = (element) => {
    this._textBox = element;
    const width = element.clientWidth;
    const height = element.clientHeight;
    this.props.dispatch({type: this.props.cipheredTextResized, payload: {width, height}});
  };
  onScroll = () => {
    const scrollTop = this._textBox.scrollTop;
    this.props.dispatch({type: this.props.cipheredTextScrolled, payload: {scrollTop}});
  };
  componentDidUpdate () {
    this._textBox.scrollTop = this.props.scrollTop;
  }
}

export default {
  actions: {
    cipheredTextResized: 'CipheredText.Resized' /* {width: number, height: number} */,
    cipheredTextScrolled: 'CipheredText.Scrolled' /* {scrollTop: number} */,
  },
  actionReducers: {
    appInit: appInitReducer,
    taskInit: taskInitReducer,
    taskRefresh: taskRefreshReducer,
    cipheredTextResized: cipheredTextResizedReducer,
    cipheredTextScrolled: cipheredTextScrolledReducer,
  },
  views: {
    CipheredText: connect(CipherTextViewSelector)(CipherTextView),
  }
};
