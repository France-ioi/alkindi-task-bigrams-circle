
import React from 'react';
import {connect} from 'react-redux';

function WorkspaceSelector (state) {
  const {
    views: {
      CipheredText, Decryption, DecipheredText, Hints,
      Substitution, EditSubstitution, BigramFrequencyAnalysis
    },
  } = state;

  return {
    CipheredText, Decryption, DecipheredText, Hints,
    Substitution, EditSubstitution, BigramFrequencyAnalysis,
  };
}

class Workspace extends React.PureComponent {
  render () {
    const {
      CipheredText, Decryption, DecipheredText, Hints,
      Substitution, EditSubstitution, BigramFrequencyAnalysis,
    } = this.props;
    return (
      <div>
        <br />
        <h2>Encrypted message</h2>
        <CipheredText />
        <h2>Encryption key</h2>
        <div className='panel-body'>
          <Decryption />
        </div>
        <Hints />
        <h2>Generated bigram substitutions</h2>
        <div className='panel-body'>
          <Substitution />
        </div>
        <h2>Applying generated substitutions and adding manual substitutions</h2>
        <EditSubstitution nbLettersPerRow={29} />
        <h2>Most frequent bigrams</h2>
        <div className='panel-body'>
          <BigramFrequencyAnalysis
            editable={false}
            nBigrams={10} />
        </div>
        <h2>Decrypted message</h2>
        <div className='panel-body'>
          <DecipheredText />
        </div>
      </div>
    );
  }

}

export default {
  views: {
    Workspace: connect(WorkspaceSelector)(Workspace)
  }
};
